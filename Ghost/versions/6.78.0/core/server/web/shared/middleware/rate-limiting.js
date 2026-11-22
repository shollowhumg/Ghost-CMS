"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logging_1 = __importDefault(require("@tryghost/logging"));
const limits_1 = require("../../../services/limits");
// required, not imported, so tests can stub the limiters on the shared module
const spamPrevention = require('./api/spam-prevention');
/** Middleware for a limiter, built on first use once config and the database are ready. */
const use = (name) => (req, res, next) => spamPrevention[name]().middleware(req, res, next);
const rateLimiting = {
    staffInviteLimiter(req, res, next) {
        if (!limits_1.limitService.isLimited('inviteEmails')) {
            return next();
        }
        return use('staffInviteBlock')(req, res, next);
    },
    upgradeApiLimiter: use('upgradeApiBlock'),
    upgradeLimiter: use('upgradeBlock'),
    globalBlock: use('globalBlock'),
    globalReset: use('globalReset'),
    userLogin: use('userLogin'),
    userReset: use('userReset'),
    sendVerificationCode: use('sendVerificationCode'),
    userVerification: use('userVerification'),
    privateBlog: use('privateBlog'),
    // Only unauthorized requests count: a successful one resets the count
    contentApiKey(req, res, next) {
        const limiter = spamPrevention.contentApiKey();
        return limiter.middleware(req, res, (err) => {
            if (!err) {
                res.on('finish', () => {
                    if (res.statusCode < 400) {
                        limiter.resetRequest(req).catch((resetErr) => logging_1.default.error(resetErr));
                    }
                });
            }
            return next(err);
        });
    },
    membersAuth: use('membersAuth'),
    membersAuthEnumeration: use('membersAuthEnumeration'),
    checkoutSessionGlobal: use('checkoutSessionGlobal'),
    checkoutSessionEmail(req, res, next) {
        if (!req.body?.customerEmail) {
            return next();
        }
        return use('checkoutSessionEmail')(req, res, next);
    },
    // Runs after loadIdentityTokenMember. A request without a verified identity
    // token skips the limiter; the controller rejects it without sending anything
    memberEmailUpdateLimiter(req, res, next) {
        if (!spamPrevention.memberIdentityKey(req)) {
            return next();
        }
        return use('memberEmailUpdateBlock')(req, res, next);
    },
    otcVerificationEnumeration: use('otcVerificationEnumeration'),
    otcVerification: use('otcVerification'),
    webmentionsLimiter: use('webmentionsBlock'),
    previewEmailLimiter: use('emailPreviewBlock'),
};
// a plain object, not ES exports, so CommonJS callers read it directly
module.exports = rateLimiting;
