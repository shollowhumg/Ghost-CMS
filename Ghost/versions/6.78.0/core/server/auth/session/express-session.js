"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAllSessions = void 0;
exports.getSession = getSession;
const node_util_1 = __importDefault(require("node:util"));
const config_1 = __importDefault(require("../../../shared/config"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
const session_store_1 = __importDefault(require("./session-store"));
// express-session ships no types
const session = require('express-session');
const settingsCache = require('../../../shared/settings-cache');
const models = require('../../models');
const sessionStore = new session_store_1.default(models.Session);
let unoExpressSessionMiddleware;
function getExpressSessionMiddleware() {
    if (!unoExpressSessionMiddleware) {
        unoExpressSessionMiddleware = session({
            store: sessionStore,
            secret: settingsCache.get('admin_session_secret'),
            resave: false,
            saveUninitialized: false,
            name: 'ghost-admin-api-session',
            cookie: {
                maxAge: config_1.default.get('admin:sessionMaxAgeMs'),
                httpOnly: true,
                path: url_utils_1.default.getSubdir() + '/ghost',
                sameSite: url_utils_1.default.isSSL(config_1.default.get('url')) ? 'none' : 'lax',
                secure: url_utils_1.default.isSSL(config_1.default.get('url')),
            },
        });
    }
    return unoExpressSessionMiddleware;
}
async function getSession(req, res) {
    if (req.session) {
        return req.session;
    }
    const expressSessionMiddleware = getExpressSessionMiddleware();
    return new Promise((resolve, reject) => {
        expressSessionMiddleware(req, res, function (err) {
            if (err) {
                return reject(err);
            }
            resolve(req.session);
        });
    });
}
exports.deleteAllSessions = node_util_1.default.promisify(sessionStore.clear.bind(sessionStore));
