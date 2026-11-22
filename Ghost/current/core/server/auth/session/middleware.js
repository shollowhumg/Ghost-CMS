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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SessionMiddleware;
const errors = __importStar(require("@tryghost/errors"));
function SessionMiddleware({ sessionService }) {
    async function createSession(req, res, next) {
        try {
            if (req.skipVerification) {
                await sessionService.createVerifiedSessionForUser(req, res, req.user);
            }
            else {
                await sessionService.createSessionForUser(req, res, req.user);
            }
            const isVerified = await sessionService.isVerifiedSession(req, res);
            if (isVerified) {
                res.sendStatus(201);
            }
            else {
                await sessionService.sendAuthCodeToUser(req, res);
                throw new errors.NoPermissionError({
                    code: sessionService.isVerificationRequired()
                        ? '2FA_TOKEN_REQUIRED'
                        : '2FA_NEW_DEVICE_DETECTED',
                    context: 'A 6-digit sign-in verification code has been sent to your email to keep your account safe.',
                    errorType: 'Needs2FAError',
                    message: 'User must verify session to login.',
                });
            }
        }
        catch (err) {
            next(err);
        }
    }
    async function logout(req, res, next) {
        try {
            await sessionService.removeUserForSession(req, res);
            res.sendStatus(204);
        }
        catch (err) {
            if (errors.utils.isGhostError(err)) {
                next(err);
            }
            else {
                next(new errors.InternalServerError({ err: err }));
            }
        }
    }
    async function authenticate(req, res, next) {
        try {
            const user = await sessionService.getUserForSession(req, res);
            if (user) {
                const isVerified = await sessionService.isVerifiedSession(req, res);
                if (!isVerified) {
                    return next();
                }
                // Do not nullify `req.user` as it might have been already set
                // in a previous middleware (authorize middleware).
                req.user = user;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    }
    async function sendAuthCode(req, res, next) {
        try {
            await sessionService.sendAuthCodeToUser(req, res);
            res.sendStatus(200);
        }
        catch (err) {
            next(err);
        }
    }
    async function verifyAuthCode(req, res, next) {
        try {
            const verified = await sessionService.verifyAuthCodeForUser(req, res);
            if (verified) {
                await sessionService.verifySession(req, res);
                res.sendStatus(200);
            }
            else {
                res.sendStatus(401);
            }
        }
        catch (err) {
            next(err);
        }
    }
    return {
        createSession: createSession,
        logout: logout,
        authenticate: authenticate,
        sendAuthCode: sendAuthCode,
        verifyAuthCode: verifyAuthCode,
    };
}
