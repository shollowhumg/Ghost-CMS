"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
const memoize_1 = __importDefault(require("./memoize"));
/**
 * Parse a root URL, returning a cached immutable snapshot of the parts url-utils uses.
 * Throws the same errors as `new URL()` for invalid input (errors are not cached).
 *
 * Root URLs (site url, admin url, CDN base urls) are a tiny, near-static set of
 * strings that get re-parsed on almost every url-utils call. Parsing is a pure
 * function of the input string so results can't go stale.
 *
 * @param {string} rootUrl
 * @returns {ParsedRootUrl}
 */
const parseRootUrl = (0, memoize_1.default)(function parseRootUrl(rootUrl) {
    const url = new url_1.URL(rootUrl);
    return Object.freeze({
        href: url.href,
        origin: url.origin,
        protocol: url.protocol,
        host: url.host,
        hostname: url.hostname,
        pathname: url.pathname
    });
});
exports.default = parseRootUrl;
