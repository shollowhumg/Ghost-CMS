"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usesBetterAuth = usesBetterAuth;
const errors_1 = __importDefault(require("@tryghost/errors"));
const config_1 = __importDefault(require("../../../shared/config"));
const in_development_1 = require("../../data/schema/in-development");
/**
 * Whether Ghost keeps Better Auth's data under either engine (auth:betterAuthDev):
 * boot seeds credential rows and the legacy engine stores passwords in them.
 * Opt-in, so an install that only has the in-development tables (an old
 * Ghost-CLI local install runs as development) leaves its passwords alone.
 * Boot's seeder calls this, so a misconfiguration fails boot.
 */
function usesBetterAuth() {
    if (config_1.default.get('auth:betterAuthDev') !== true) {
        return false;
    }
    if (!(0, in_development_1.shouldCreateInDevelopmentTables)()) {
        throw new errors_1.default.IncorrectUsageError({
            message: 'auth:betterAuthDev requires the in-development auth tables, which only exist in development and testing with createInDevelopmentTables enabled.',
            help: 'Set auth:betterAuthDev to false, or enable createInDevelopmentTables in development.',
        });
    }
    return true;
}
