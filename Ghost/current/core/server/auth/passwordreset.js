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
const lodash_1 = __importDefault(require("lodash"));
const security_1 = __importDefault(require("@tryghost/security"));
const errors = __importStar(require("@tryghost/errors"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const moment_1 = __importDefault(require("moment"));
const url_utils_1 = __importDefault(require("../../shared/url-utils"));
const models = require('../models');
// require, not import: tests override config through the require graph
const { readPasswordHash, } = require('./better-auth/credential-password');
const ghostBookshelf = require('../models/base');
const mail = require('../lib/mail');
const messages = {
    userNotFound: 'User not found.',
    userSuspended: 'This account has been suspended.',
    resetPassword: 'Reset Password',
    expired: {
        message: 'Cannot reset password.',
        context: 'Password reset link expired.',
        help: 'Request a new password reset via the login form.',
    },
    invalidToken: {
        message: 'Cannot reset password.',
        context: 'Password reset link has already been used.',
        help: 'Request a new password reset via the login form.',
    },
    corruptedToken: {
        message: 'Cannot reset password.',
        context: 'Invalid password reset link.',
        help: 'Check if password reset link has been fully copied or request new password reset via the login form.',
    },
};
function generateToken(email, settingsAPI, transaction) {
    const options = { context: { internal: true }, transacting: transaction };
    let dbHash;
    let token;
    return settingsAPI
        .read(lodash_1.default.merge({ key: 'db_hash' }, options))
        .then((response) => {
        dbHash = response.settings[0].value;
        return models.User.getByEmail(email, options);
    })
        .then(async (user) => {
        if (!user) {
            throw new errors.NotFoundError({ message: (0, tpl_1.default)(messages.userNotFound) });
        }
        // Prevent suspended users from generating a reset token. This same check must appear
        // below in doReset() to account for password reset tokens that were generated prior
        // to suspension since they have a 24-hour lifetime.
        // Locked users must still be able to recover access by resetting their password.
        if (user.isInactive()) {
            throw new errors.NoPermissionError({ message: (0, tpl_1.default)(messages.userSuspended) });
        }
        token = security_1.default.tokens.resetToken.generateHash({
            expires: (0, moment_1.default)().add(1, 'days').valueOf(),
            email: email,
            dbHash: dbHash,
            passwordHash: await readPasswordHash(transaction || ghostBookshelf.knex, {
                id: user.id,
                password: user.get('password'),
            }),
        });
        return {
            email: email,
            resetToken: token,
        };
    });
}
function extractTokenParts(options) {
    options.data.password_reset[0].token = security_1.default.url.decodeBase64(options.data.password_reset[0].token);
    const tokenParts = security_1.default.tokens.resetToken.extract({
        token: options.data.password_reset[0].token,
    });
    if (!tokenParts) {
        return Promise.reject(new errors.UnauthorizedError({
            message: (0, tpl_1.default)(messages.corruptedToken.message),
            context: (0, tpl_1.default)(messages.corruptedToken.context),
            help: (0, tpl_1.default)(messages.corruptedToken.help),
        }));
    }
    return Promise.resolve({ options, tokenParts });
}
function doReset(options, tokenParts, settingsAPI) {
    const data = options.data.password_reset[0];
    const resetToken = data.token;
    const oldPassword = data.oldPassword;
    const newPassword = data.newPassword;
    return ghostBookshelf
        .transaction(async (transacting) => {
        const txOptions = { context: options.context, transacting };
        const settingsResponse = await settingsAPI.read({ key: 'db_hash', ...txOptions });
        const dbHash = settingsResponse.settings[0].value;
        const candidate = await models.User.getByEmail(tokenParts.email, txOptions);
        if (!candidate) {
            throw new errors.NotFoundError({ message: (0, tpl_1.default)(messages.userNotFound) });
        }
        const user = await new models.User({ id: candidate.id }).fetch({
            ...txOptions,
            forUpdate: true,
            require: true,
        });
        // Better Auth writes the credential row without touching users, so lock it too
        const passwordHash = await readPasswordHash(transacting, { id: user.id, password: user.get('password') }, { forUpdate: true });
        const compareResult = security_1.default.tokens.resetToken.compare({
            token: resetToken,
            dbHash: dbHash,
            passwordHash,
        });
        if (!compareResult.correct) {
            if (compareResult.reason === 'expired' || compareResult.reason === 'invalid_expiry') {
                throw new errors.BadRequestError({
                    message: (0, tpl_1.default)(messages.expired.message),
                    context: (0, tpl_1.default)(messages.expired.context),
                    help: (0, tpl_1.default)(messages.expired.help),
                });
            }
            else {
                throw new errors.BadRequestError({
                    message: (0, tpl_1.default)(messages.invalidToken.message),
                    context: (0, tpl_1.default)(messages.invalidToken.context),
                    help: (0, tpl_1.default)(messages.invalidToken.help),
                });
            }
        }
        if (user.isInactive()) {
            throw new errors.NoPermissionError({ message: (0, tpl_1.default)(messages.userSuspended) });
        }
        const updatedUser = await models.User.changePassword({
            oldPassword: oldPassword,
            newPassword: newPassword,
            user_id: user.id,
        }, txOptions);
        updatedUser.set('status', 'active');
        const savedUser = await updatedUser.save(null, txOptions);
        return { user: savedUser };
    })
        .catch((err) => {
        if (errors.utils.isGhostError(err)) {
            return Promise.reject(err);
        }
        return Promise.reject(new errors.UnauthorizedError({ err: err }));
    });
}
async function sendResetNotification(data, mailAPI) {
    const adminUrl = url_utils_1.default.urlFor('admin', true);
    const resetToken = security_1.default.url.encodeBase64(data.resetToken);
    const resetUrl = url_utils_1.default.urlJoin(adminUrl, 'reset', resetToken, '/');
    const emailData = {
        resetUrl: resetUrl,
        recipientEmail: data.email,
    };
    const content = await mail.utils.generateContent({
        data: emailData,
        template: 'reset-password',
    });
    const payload = {
        mail: [
            {
                message: {
                    to: data.email,
                    subject: (0, tpl_1.default)(messages.resetPassword),
                    html: content.html,
                    text: content.text,
                },
                options: {},
            },
        ],
    };
    return mailAPI.send(payload, { context: { internal: true } });
}
exports.default = {
    generateToken,
    extractTokenParts,
    doReset,
    sendResetNotification,
};
