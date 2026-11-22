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
const logging_1 = __importDefault(require("@tryghost/logging"));
const security = __importStar(require("@tryghost/security"));
const define_service_1 = require("../../../kernel/define-service");
const create_auth_1 = require("./create-auth");
const enabled_1 = require("./enabled");
// Boot initializes this after settings, which follows the database (and its
// in-development tables), and only when auth:engine is better-auth
exports.default = (0, define_service_1.defineService)('Better Auth', async () => {
    const config = require('../../../shared/config');
    const settingsCache = require('../../../shared/settings-cache');
    const urlUtils = require('../../../shared/url-utils').default;
    const { knex } = require('../../data/db');
    const spamPrevention = require('../../web/shared/middleware/api/spam-prevention');
    (0, create_auth_1.assertDatabaseSupported)({
        client: config.get('database:client'),
        usesBetterAuth: (0, enabled_1.usesBetterAuth)(),
    });
    const auth = (0, create_auth_1.createAuth)({
        db: knex,
        secret: settingsCache.get('admin_session_secret'),
        sessionMaxAgeMs: config.get('admin:sessionMaxAgeMs'),
        urlUtils,
        password: security.password,
        logger: logging_1.default,
        limiters: {
            globalBlock: spamPrevention.globalBlock,
            globalReset: spamPrevention.globalReset,
            userLogin: spamPrevention.userLogin,
            userReset: spamPrevention.userReset,
        },
    });
    // betterAuth() defers its setup to this promise; awaiting it fails boot, not the first request
    await auth.$context;
    return auth;
});
