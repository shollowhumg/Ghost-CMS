"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMailgunError = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
/**
 * Mailgun clients reject with `{ error, messageData }`.
 *
 * If passed such an object, we wrap `error` with Mailgun context. Otherwise, we return the input value.
 */
const getMailgunError = (err) => typeof err === 'object' && err !== null && 'error' in err && err.error instanceof Error
    ? new errors_1.default.EmailError({
        message: `Mailgun error: ${err.error.message}`,
        err: err.error,
    })
    : err;
exports.getMailgunError = getMailgunError;
