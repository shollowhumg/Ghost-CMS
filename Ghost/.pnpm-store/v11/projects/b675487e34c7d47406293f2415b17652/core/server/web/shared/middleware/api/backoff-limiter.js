"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackoffLimiter = void 0;
exports.backoffDelays = backoffDelays;
exports.normalizeIP = normalizeIP;
const node_crypto_1 = require("node:crypto");
const node_net_1 = require("node:net");
const errors_1 = __importDefault(require("@tryghost/errors"));
const ipaddr_js_1 = __importDefault(require("ipaddr.js"));
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
/** Waits of minWait, minWait, then each the sum of the two before, capped at maxWait. */
function backoffDelays(minWait, maxWait) {
    const delays = [minWait];
    while (delays[delays.length - 1] < maxWait) {
        delays.push(delays[delays.length - 1] + (delays[delays.length - 2] ?? 0));
    }
    delays[delays.length - 1] = maxWait;
    return delays;
}
/** Formats an IP as Better Auth does with `ipv6Subnet: 64`: IPv4-mapped IPv6 as IPv4, other IPv6 as its expanded /64. */
function normalizeIP(ip) {
    if (!(0, node_net_1.isIPv6)(ip)) {
        return ip;
    }
    const address = ipaddr_js_1.default.process(ip);
    if (!(address instanceof ipaddr_js_1.default.IPv6)) {
        return address.toString();
    }
    return new ipaddr_js_1.default.IPv6([...address.parts.slice(0, 4), 0, 0, 0, 0]).toFixedLengthString();
}
/**
 * Runs a store call again once if MySQL picked it as a deadlock victim. Each
 * call is its own transaction, which InnoDB has already rolled back.
 */
async function retryDeadlock(call) {
    try {
        return await call();
    }
    catch (err) {
        if (err?.code !== 'ER_LOCK_DEADLOCK') {
            throw err;
        }
        return call();
    }
}
const hashKey = (parts) => (0, node_crypto_1.createHash)('sha256')
    .update(parts.map((part) => part ?? '').join('\0'))
    .digest('base64url');
/**
 * Backoff rate limiting on rate-limiter-flexible's atomic counters.
 *
 * Each key gets `freeRetries` requests per `lifetime`. After that, every
 * request opens a wait - minWait, minWait, 2x, 3x, 5x... up to maxWait - and
 * the next request is blocked until it ends. Three counters per limiter:
 *
 * - `count` counts requests over a fixed `lifetime` window
 * - `wait` holds one point for the current wait, so only one request can open
 *   it, however many arrive at once
 * - `step` counts opened waits in the current `count` window, so blocked
 *   requests never advance the backoff
 *
 * Both increment in one statement, so concurrent requests cannot both slip
 * under a limit.
 */
class BackoffLimiter {
    name;
    options;
    delays;
    count;
    wait;
    step;
    constructor(name, factory, options) {
        // rate-limiter-flexible never expires a duration of 0, so no wait or lifetime may be 0
        const minWait = Math.max(options.minWait, 1);
        const maxWait = Math.max(options.maxWait, 1);
        const delays = backoffDelays(minWait, maxWait);
        // by default, just long enough to climb every wait back to back
        const lifetime = Math.max(options.lifetime ?? Math.ceil(delays.reduce((sum, delay) => sum + delay, 0) / 1000), 1);
        this.name = name;
        this.delays = delays;
        this.options = { ...options, minWait, maxWait, lifetime };
        this.count = factory({
            keyPrefix: `${name}:count`,
            points: options.freeRetries,
            duration: lifetime,
        });
        this.wait = factory({
            keyPrefix: `${name}:wait`,
            points: 1,
            duration: maxWait / 1000,
        });
        this.step = factory({
            keyPrefix: `${name}:step`,
            points: 1,
            duration: lifetime,
        });
    }
    middleware = (req, res, next) => {
        this.consume(this.keyFor(req))
            .then((result) => (result.allowed ? undefined : this.options.onBlocked(result.retryAfterMs, res)), (err) => new errors_1.default.InternalServerError({
            message: 'Unknown error',
            err: err instanceof Error ? err : undefined,
        }))
            .then(next, next);
    };
    /**
     * Counts one request outside Express, against the same counters `middleware`
     * uses for that IP and key. `ip` is ignored when the limiter ignores IP.
     */
    async consume(limiterKey) {
        const retryAfterMs = await this.attempt(this.hash(limiterKey));
        return retryAfterMs === null ? { allowed: true } : { allowed: false, retryAfterMs };
    }
    /** Clears the count and wait this request's key has built up. */
    resetRequest(req) {
        return this.reset(this.keyFor(req));
    }
    /** Clears a key's count and wait. `ip` is ignored when the limiter ignores IP. */
    reset(limiterKey) {
        return this.clear(this.hash(limiterKey));
    }
    keyFor(req) {
        return { ip: req.ip, key: this.options.key?.(req) };
    }
    hash({ ip, key }) {
        return hashKey([this.options.ignoreIP || !ip ? undefined : normalizeIP(ip), key]);
    }
    /** Milliseconds the request is blocked for, or null when it may continue. */
    async attempt(key) {
        // a wait outlives the count window that opened it, so check it first
        const waiting = await retryDeadlock(() => this.wait.get(key));
        if (waiting && waiting.msBeforeNext > 0) {
            return waiting.msBeforeNext;
        }
        let windowLeft;
        try {
            await retryDeadlock(() => this.count.consume(key));
            return null;
        }
        catch (result) {
            if (!(result instanceof rate_limiter_flexible_1.RateLimiterRes)) {
                throw result;
            }
            windowLeft = result.msBeforeNext;
        }
        const step = (await retryDeadlock(() => this.step.get(key)))?.consumedPoints ?? 0;
        const delay = this.delays[Math.min(step, this.delays.length - 1)];
        try {
            await retryDeadlock(() => this.wait.consume(key, 1, { customDuration: delay / 1000 }));
        }
        catch (result) {
            if (!(result instanceof rate_limiter_flexible_1.RateLimiterRes)) {
                throw result;
            }
            return result.msBeforeNext;
        }
        // only the request that opened the wait advances the backoff, and the
        // steps end with the count window, so a fresh window starts at minWait
        await retryDeadlock(() => this.step.penalty(key, 1, { customDuration: Math.max(windowLeft, 1) / 1000 }));
        return null;
    }
    async clear(key) {
        await Promise.all([this.count, this.wait, this.step].map((store) => retryDeadlock(() => store.delete(key))));
    }
}
exports.BackoffLimiter = BackoffLimiter;
