"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("@tryghost/debug"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const debug = (0, debug_1.default)('api:endpoints:utils:validators:input:updateSetup');
const messages = {
    notTheBlogOwner: 'You are not the site owner.',
};
module.exports = {
    updateSetup(apiConfig, frame) {
        debug('resetPassword');
        if (!frame.options.context || !frame.options.context.user) {
            throw new errors_1.default.NoPermissionError({ message: (0, tpl_1.default)(messages.notTheBlogOwner) });
        }
    },
};
