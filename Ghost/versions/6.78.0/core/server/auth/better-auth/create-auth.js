"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE_NAME = exports.BASE_PATH = void 0;
exports.assertDatabaseSupported = assertDatabaseSupported;
exports.stripSessionTokens = stripSessionTokens;
exports.createAuth = createAuth;
// Minimal skips Kysely, which only serves direct connections and migrations;
// Ghost brings its own Knex adapter and knex-migrator
const minimal_1 = require("better-auth/minimal");
const api_1 = require("better-auth/api");
const errors_1 = __importDefault(require("@tryghost/errors"));
const client_ip_1 = require("./client-ip");
const knex_adapter_1 = require("./knex-adapter");
const rate_limit_1 = require("./rate-limit");
const ghost_models_1 = require("./ghost-models");
exports.BASE_PATH = '/ghost/api/admin/auth';
exports.SESSION_COOKIE_NAME = 'ghost-admin-api-session';
/**
 * Refuses a database Better Auth can't run on (plan §3.2): SQLite, or one
 * that doesn't keep Better Auth's data. `auth:betterAuthDev` only applies where
 * boot creates the in-development tables, so it stands in for a table check
 * until they graduate to a migration.
 */
function assertDatabaseSupported({ client, usesBetterAuth, }) {
    const help = 'Set auth:engine to legacy, or use MySQL in development with createInDevelopmentTables and auth:betterAuthDev enabled.';
    if (client !== 'mysql2') {
        throw new errors_1.default.IncorrectUsageError({
            message: 'auth:engine better-auth requires MySQL; SQLite is not supported.',
            help,
        });
    }
    if (!usesBetterAuth) {
        throw new errors_1.default.IncorrectUsageError({
            message: 'auth:engine better-auth requires auth:betterAuthDev and the in-development auth tables, which only exist in development and testing with createInDevelopmentTables enabled.',
            help,
        });
    }
}
const isPlainObject = (value) => typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
const omitToken = (value) => {
    const rest = { ...value };
    delete rest.token;
    return rest;
};
/**
 * Removes session tokens from a native response body (plan §10): a top-level
 * `token` (`/sign-in/email`, `/change-password`), `session.token`
 * (`/get-session`) and each session's `token` (`/list-sessions`). The cookie
 * is the only place a session token leaves the server.
 */
function stripSessionTokens(body) {
    if (Array.isArray(body)) {
        return body.map((item) => (isPlainObject(item) ? omitToken(item) : item));
    }
    if (!isPlainObject(body)) {
        return body;
    }
    const stripped = omitToken(body);
    if (isPlainObject(stripped.session)) {
        stripped.session = omitToken(stripped.session);
    }
    return stripped;
}
/** Builds the Better Auth instance with Ghost's options (plan §3.1). */
function createAuth(deps) {
    const { urlUtils } = deps;
    // Origin only: Better Auth ignores basePath when baseURL has a path, so the
    // subdirectory goes in basePath, matching where Ghost mounts the request
    const adminOrigin = urlUtils.getAdminOrigin();
    // The cookie lives on the admin origin, so its security follows the admin URL
    const ssl = urlUtils.isSSL(adminOrigin);
    return (0, minimal_1.betterAuth)({
        // Also Better Auth's only trusted origin, matching the legacy login-CSRF check
        baseURL: adminOrigin,
        basePath: `${urlUtils.getSubdir()}${exports.BASE_PATH}`,
        // `secrets` stops Better Auth reading BETTER_AUTH_SECRETS from the environment,
        // and `secret` keeps its legacy fallback off BETTER_AUTH_SECRET and AUTH_SECRET
        secret: deps.secret,
        secrets: [{ version: 1, value: deps.secret }],
        database: (0, knex_adapter_1.createKnexAdapter)({
            db: deps.db,
            virtualColumns: ghost_models_1.ghostVirtualColumns,
            createDefaults: ghost_models_1.ghostCreateDefaults,
        }),
        ...ghost_models_1.ghostModelOptions,
        user: {
            ...ghost_models_1.ghostModelOptions.user,
            // Never `password`: additional fields are returned on user objects
            additionalFields: {
                // Filled by column defaults and createDefaults, not by Better Auth
                status: { type: 'string', required: false, input: false },
                slug: { type: 'string', required: false, input: false },
                last_seen: { type: 'date', required: false, input: false },
            },
        },
        session: {
            ...ghost_models_1.ghostModelOptions.session,
            // Better Auth takes seconds
            expiresIn: deps.sessionMaxAgeMs / 1000,
            // Absolute expiry, as with the legacy session
            disableSessionRefresh: true,
            additionalFields: {
                verified: { type: 'boolean', defaultValue: false, input: false },
                origin: { type: 'string', required: false, input: false },
            },
        },
        emailAndPassword: {
            enabled: true,
            disableSignUp: true,
            // emailVerified is virtual and always true, so it proves nothing (plan §4.3)
            requireEmailVerification: false,
            password: {
                hash: (password) => deps.password.hash(password),
                verify: ({ hash, password }) => deps.password.compare(password, hash),
            },
        },
        // On by default in production only
        rateLimit: { enabled: true, customStorage: (0, rate_limit_1.rateLimitStorage)(deps.limiters) },
        disabledPaths: [
            '/sign-up/email',
            '/update-user',
            '/change-email',
            '/delete-user',
            '/sign-in/social',
        ],
        hooks: {
            after: (0, api_1.createAuthMiddleware)(async (ctx) => {
                // Server-side `auth.api` calls have no request and keep their tokens
                if (!ctx.request) {
                    return;
                }
                const returned = ctx.context.returned;
                // Clears this IP's failed sign-ins, as the compatibility routes do
                if (['/sign-in/email', '/reset-password'].includes(ctx.path) && !(0, api_1.isAPIError)(returned)) {
                    const ip = ctx.request.headers.get(client_ip_1.CLIENT_IP_HEADER) ?? undefined;
                    // Awaited, so the next request sees the cleared count
                    await deps.limiters
                        .userLogin()
                        .reset({ ip })
                        .catch((err) => deps.logger.error(err));
                }
                if (Array.isArray(returned) || isPlainObject(returned)) {
                    return ctx.json(stripSessionTokens(returned));
                }
            }),
        },
        telemetry: { enabled: false },
        logger: {
            log: (level, message, ...args) => deps.logger[level](message, ...args),
        },
        advanced: {
            database: { generateId: ghost_models_1.generateGhostId },
            // Express's req.ip, set by setClientIPHeader; IPv6 counts per /64, as Ghost's limiters key it
            ipAddress: { ipAddressHeaders: [client_ip_1.CLIENT_IP_HEADER], ipv6Subnet: 64 },
            // Pinned: Better Auth turns both checks off when NODE_ENV is test or TEST is set
            disableOriginCheck: false,
            disableCSRFCheck: false,
            // Sets `Secure` and the `__Secure-` name prefix together, on an HTTPS admin URL only
            useSecureCookies: ssl,
            cookies: {
                session_token: {
                    name: exports.SESSION_COOKIE_NAME,
                    attributes: {
                        path: `${urlUtils.getSubdir()}/ghost`,
                        sameSite: ssl ? 'none' : 'lax',
                        httpOnly: true,
                    },
                },
            },
        },
    });
}
