"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("@tryghost/debug"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const debug = (0, debug_1.default)('api:endpoints:utils:validators:input:users');
const messages = {
    newPasswordsDoNotMatch: 'Your new passwords do not match',
};
module.exports = {
    changePassword(apiConfig, frame) {
        debug('changePassword');
        const data = frame.data.password[0];
        if (data.newPassword !== data.ne2Password) {
            return Promise.reject(new errors_1.default.ValidationError({
                message: (0, tpl_1.default)(messages.newPasswordsDoNotMatch),
            }));
        }
    },
};
