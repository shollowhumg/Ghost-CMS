"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_manager_1 = __importDefault(require("../../services/adapter-manager"));
const session_service_1 = __importDefault(require("./session-service"));
const session_from_token_1 = require("./session-from-token");
const middleware_1 = __importDefault(require("./middleware"));
const expressSession = __importStar(require("./express-session"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
const config_1 = __importDefault(require("../../../shared/config"));
const errors = __importStar(require("@tryghost/errors"));
const moment_1 = __importDefault(require("moment"));
const node_url_1 = __importDefault(require("node:url"));
const settingsCache = require('../../../shared/settings-cache');
const { GhostMailer } = require('../../lib/mail');
const { t } = require('../../../shared/i18n');
const models = require('../../models');
const { blogIcon } = require('../../lib/image');
const spamPrevention = require('../../web/shared/middleware/api/spam-prevention');
// Share the email budget across sessions, IPs and Ghost instances.
async function limitVerificationEmailForUser(userId) {
    const result = await spamPrevention.verificationEmail().consume({ key: userId });
    if (!result.allowed) {
        throw new errors.TooManyRequestsError({
            message: `Too many verification emails requested, try again in ${moment_1.default.duration(result.retryAfterMs).humanize()}`,
            context: 'Too many attempts.',
        });
    }
}
function resetVerificationEmailForUser(userId) {
    return spamPrevention.verificationEmail().reset({ key: userId });
}
// TODO: We have too many lines here, should move functions out into a utils module
function getOriginOfRequest(req) {
    const getHeader = (name) => {
        if (req && typeof req.get === 'function') {
            return req.get(name);
        }
        const headers = req && req.headers ? req.headers : {};
        const normalizedName = name.toLowerCase();
        return headers[normalizedName];
    };
    const origin = getHeader('origin');
    const referrer = getHeader('referrer') ||
        getHeader('referer') ||
        url_utils_1.default.getAdminUrl() ||
        url_utils_1.default.getSiteUrl();
    if ((!origin && !referrer) || origin === 'null') {
        return null;
    }
    if (origin) {
        return origin;
    }
    const { protocol, host } = node_url_1.default.parse(referrer);
    if (protocol && host) {
        return `${protocol}//${host}`;
    }
    return null;
}
const mailer = new GhostMailer();
const sessionService = (0, session_service_1.default)({
    async consumeAuthCodeAttempt(challenge) {
        const result = await spamPrevention.userVerificationChallenge().consume({ key: challenge });
        if (!result.allowed) {
            throw new errors.TooManyRequestsError({
                message: 'Too many verification attempts. Please request a new code.',
                code: 'STAFF_VERIFICATION_ATTEMPTS_RATE_LIMITED',
            });
        }
    },
    getOriginOfRequest,
    getSession: expressSession.getSession,
    findUserById({ id }) {
        return models.User.findOne({ id, status: 'active' });
    },
    getSettingsCache(key) {
        return settingsCache.get(key);
    },
    isStaffDeviceVerificationDisabled() {
        // This config flag is set to true by default, so we need to check for false
        return config_1.default.get('security:staffDeviceVerification') !== true;
    },
    getBlogLogo() {
        return (blogIcon.getIconUrl({ absolute: true, fallbackToDefault: false }) ||
            'https://static.ghost.org/v4.0.0/images/ghost-orb-1.png');
    },
    limitVerificationEmailForUser,
    resetVerificationEmailForUser,
    mailer,
    urlUtils: url_utils_1.default,
    t,
});
// Looks funky but this is a "custom" piece of middleware
function createSessionFromToken() {
    const ssoAdapter = adapter_manager_1.default.getAdapter('sso');
    // Provide the SSO adapter with the user lookups it needs, backed by the User
    // model. This keeps the model coupling here in core and lets adapter
    // implementations resolve users via the base class helpers instead of
    // requiring Ghost's model layer directly.
    ssoAdapter.setUserRepository({
        async getByEmail(email) {
            const user = await models.User.findOne({ email });
            return user ? { id: user.id, email: user.get('email'), status: user.get('status') } : null;
        },
        async getOwner() {
            const owner = await models.User.findOne({ role: 'Owner', status: 'all' });
            return owner
                ? { id: owner.id, email: owner.get('email'), status: owner.get('status') }
                : null;
        },
    });
    return (0, session_from_token_1.sessionFromToken)({
        callNextWithError: false,
        // The service attaches req.session itself before reading it
        createSession: sessionService.createVerifiedSessionForUser,
        findUserByLookup: ssoAdapter.getUserForIdentity.bind(ssoAdapter),
        getLookupFromToken: ssoAdapter.getIdentityFromCredentials.bind(ssoAdapter),
        getTokenFromRequest: ssoAdapter.getRequestCredentials.bind(ssoAdapter),
    });
}
async function initSession(req, res, next) {
    try {
        await expressSession.getSession(req, res);
        next();
    }
    catch (err) {
        next(err);
    }
}
exports.default = {
    ...(0, middleware_1.default)({ sessionService }),
    createSessionFromToken,
    initSession,
    getOriginOfRequest,
    sessionService,
    deleteAllSessions: expressSession.deleteAllSessions,
};
