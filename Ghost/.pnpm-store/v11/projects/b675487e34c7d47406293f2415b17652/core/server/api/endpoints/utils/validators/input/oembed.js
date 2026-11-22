"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const messages = {
    noUrlProvided: 'No url provided.',
};
module.exports = {
    read(apiConfig, frame) {
        if (!frame.data.url || !frame.data.url.trim()) {
            return Promise.reject(new errors_1.default.BadRequestError({
                message: (0, tpl_1.default)(messages.noUrlProvided),
            }));
        }
    },
};
