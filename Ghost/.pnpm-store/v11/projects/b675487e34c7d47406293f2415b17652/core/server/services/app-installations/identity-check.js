"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIdentityChecker = createIdentityChecker;
exports.readTrustedOrigins = readTrustedOrigins;
const errors_1 = __importDefault(require("@tryghost/errors"));
const identity_1 = require("@tryghost/app-contracts/identity");
const manifest_1 = require("@tryghost/app-contracts/manifest");
const ANSWER_MAX_BYTES = 4 * 1024;
function challengeUnreachable(origin, failure, logging) {
    // Says only how the app answered, never why the request failed, so a review can't be
    // used to probe the server's network. The cause is logged for the operator.
    const status = 'status' in failure ? failure.status : undefined;
    const context = status ? `${origin} answered the challenge with HTTP ${status}` : origin;
    logging.warn(`Could not challenge the app at ${origin}`);
    logging.warn(failure.reason === 'unreachable' ? failure.cause : context);
    return new errors_1.default.ValidationError({
        message: 'Could not reach the app to confirm it comes from its developer.',
        code: 'APP_CHALLENGE_UNREACHABLE',
        context,
    });
}
function challengeFailed(origin, why) {
    return new errors_1.default.ValidationError({
        message: 'Ghost couldn’t confirm the app comes from its developer.',
        code: 'APP_CHALLENGE_FAILED',
        context: `${origin}: ${why}`,
    });
}
function createIdentityChecker({ fetchFromApp, logging, getTrustConfig, getManifestRules, }) {
    function isTrusted(origin) {
        const { trustedOrigins, trustLoopback } = getTrustConfig();
        return trustedOrigins.has(origin) || (trustLoopback && (0, manifest_1.isLocalhost)(new URL(origin).hostname));
    }
    async function send(origin) {
        if (isTrusted(origin)) {
            return { kind: 'trusted' };
        }
        const sent = (0, identity_1.createChallenge)(origin);
        const answered = await fetchFromApp((0, identity_1.challengeUrl)(origin), {
            maxBytes: ANSWER_MAX_BYTES,
            method: 'POST',
            body: sent,
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            // The answer has to come from the origin being checked.
            redirect: 'error',
        });
        if (!answered.success) {
            if (answered.failure.reason === 'too_large') {
                return {
                    kind: 'failed',
                    error: () => challengeFailed(origin, `The answer is larger than ${ANSWER_MAX_BYTES / 1024} KB`),
                };
            }
            const { failure } = answered;
            return { kind: 'failed', error: () => challengeUnreachable(origin, failure, logging) };
        }
        return { kind: 'answered', sent, text: answered.body.toString('utf8') };
    }
    function challenge(manifestUrl) {
        // Only an address Ghost would fetch the manifest from gets a request. Loading the
        // manifest refuses the rest with its own error.
        const address = (0, manifest_1.parseManifestUrl)(manifestUrl, getManifestRules());
        if (!address.success) {
            return { origin: null, outcome: Promise.resolve({ kind: 'skipped' }) };
        }
        const origin = new URL(address.manifestUrl).origin;
        const outcome = send(origin).catch((error) => ({
            kind: 'failed',
            error: () => error instanceof Error ? error : new errors_1.default.InternalServerError({ message: String(error) }),
        }));
        return { origin, outcome };
    }
    async function check(loaded, pinned, started) {
        if (pinned && loaded.identityKeyThumbprint !== pinned.identityKeyThumbprint) {
            // No detail: the publisher is told it isn't from the same developer, never about keys.
            throw new errors_1.default.ValidationError({
                message: 'This app doesn’t come from the same developer as the installed one.',
                code: 'APP_IDENTITY_MISMATCH',
            });
        }
        if (pinned?.retiredBackendKeys.has(loaded.backendKeyThumbprint)) {
            throw new errors_1.default.ValidationError({
                message: 'Ghost couldn’t confirm the app comes from its developer.',
                code: 'APP_BACKEND_KEY_RETIRED',
                context: 'backend_key has been replaced, and can’t be used again',
            });
        }
        const origin = new URL(loaded.manifestUrl).origin;
        // Always the same origin, as the manifest URL the challenge started from is the one the
        // manifest was loaded from; checked anyway, so a caller's mistake can't skip it.
        const outcome = await (started.origin === origin ? started.outcome : send(origin));
        switch (outcome.kind) {
            case 'trusted':
                return { trustedOrigins: [origin] };
            case 'failed':
                throw outcome.error();
            case 'skipped':
                throw challengeFailed(origin, 'The origin was not challenged');
            case 'answered': {
                const verified = await (0, identity_1.verifyChallengeAnswer)(outcome.sent, outcome.text, loaded.manifest.backend_key);
                if (!verified.success) {
                    throw challengeFailed(origin, verified.error);
                }
                return { trustedOrigins: [] };
            }
        }
    }
    return { challenge, check };
}
/**
 * Reads `apps.trustedOrigins` as a set of origins, or names the first entry that isn't one.
 * Anything more than an origin would read as trusting less than it does, and a wildcard
 * host, which the URL parser accepts, as trusting more.
 */
function readTrustedOrigins(entries) {
    if (!Array.isArray(entries)) {
        return { success: false, entry: entries };
    }
    const origins = new Set();
    for (const entry of entries) {
        const url = typeof entry === 'string' ? URL.parse(entry) : null;
        if (!url ||
            url.origin === 'null' ||
            url.href !== `${url.origin}/` ||
            url.hostname.includes('*')) {
            return { success: false, entry };
        }
        origins.add(url.origin);
    }
    return { success: true, origins };
}
