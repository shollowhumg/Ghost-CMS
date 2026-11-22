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
const errors = __importStar(require("@tryghost/errors"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const models = require('../../models');
const auth = require('../../auth');
const api = require('./index');
const spamPrevention = require('../../web/shared/middleware/api/spam-prevention');
const messages = {
    accessDenied: 'Access Denied.',
};
const controller = {
    add(frame) {
        const object = frame.data;
        if (!object || !object.username || !object.password) {
            return Promise.reject(new errors.UnauthorizedError({
                message: (0, tpl_1.default)(messages.accessDenied),
            }));
        }
        let skipVerification = false;
        return models.User.getByEmail(object.username)
            .then((user) => {
            if (user && !user.hasLoggedIn()) {
                skipVerification = true;
            }
            return models.User.check({
                email: object.username,
                password: object.password,
            });
        })
            .then((user) => {
            return Promise.resolve(function sessionMiddleware(req, res, next) {
                return spamPrevention
                    .userLogin()
                    .resetRequest(req)
                    .then(() => {
                    req.user = user;
                    req.skipVerification = skipVerification;
                    auth.session.createSession(req, res, next);
                }, next);
            });
        })
            .catch(async (err) => {
            if (!errors.utils.isGhostError(err)) {
                throw new errors.UnauthorizedError({
                    message: (0, tpl_1.default)(messages.accessDenied),
                    err,
                });
            }
            if (err.errorType === 'PasswordResetRequiredError') {
                await api.authentication.generateResetToken({
                    password_reset: [
                        {
                            email: object.username,
                        },
                    ],
                }, frame.options.context);
            }
            throw err;
        });
    },
    delete() {
        return Promise.resolve(function logoutSessionMw(req, res, next) {
            auth.session.logout(req, res, next);
        });
    },
    sendVerification() {
        return Promise.resolve(function sendAuthCodeMw(req, res, next) {
            auth.session.sendAuthCode(req, res, next);
        });
    },
    verify() {
        return Promise.resolve(function verifyAuthCodeMw(req, res, next) {
            auth.session.verifyAuthCode(req, res, next);
        });
    },
};
// module.exports (not export): api/endpoints/index.js loads controllers via require().
module.exports = controller;
