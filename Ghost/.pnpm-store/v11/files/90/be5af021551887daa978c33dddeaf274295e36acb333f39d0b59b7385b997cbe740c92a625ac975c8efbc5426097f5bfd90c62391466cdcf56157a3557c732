"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memoize_1 = __importDefault(require("./memoize"));
const parse_root_url_1 = __importDefault(require("./parse-root-url"));
const buildSubdirRegex = (0, memoize_1.default)(function buildSubdirRegex(pathname) {
    const subdir = pathname.replace(/(^\/|\/$)+/g, '');
    // we can have subdirs that match TLDs so we need to restrict matches to
    // duplicates that start with a / or the beginning of the url
    return { subdir, regex: new RegExp(`(^|/)${subdir}/${subdir}(/|$)`) };
});
/**
 * Remove duplicated directories from the start of a path or url's path
 *
 * @param {string} url URL or pathname with possible duplicate subdirectory
 * @param {string} rootUrl Root URL with an optional subdirectory
 * @returns {string} URL or pathname with any duplicated subdirectory removed
 */
const deduplicateSubdirectory = function deduplicateSubdirectory(url, rootUrl) {
    // force root url to always have a trailing-slash for consistent behaviour
    if (!rootUrl.endsWith('/')) {
        rootUrl = `${rootUrl}/`;
    }
    const { pathname } = (0, parse_root_url_1.default)(rootUrl);
    // do nothing if rootUrl does not have a subdirectory
    if (pathname === '/') {
        return url;
    }
    const { subdir, regex } = buildSubdirRegex(pathname);
    return url.replace(regex, `$1${subdir}/`);
};
exports.default = deduplicateSubdirectory;
