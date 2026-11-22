"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parse_root_url_1 = __importDefault(require("./parse-root-url"));
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const transformReadyToRelative = function (str = '', root, _options = {}) {
    const defaultOptions = {
        replacementStr: '__GHOST_URL__'
    };
    const options = Object.assign({}, defaultOptions, _options);
    if (!str || str.indexOf(options.replacementStr) === -1) {
        return str;
    }
    const rootURL = (0, parse_root_url_1.default)(root);
    // subdir with no trailing slash because we'll always have a trailing slash after the magic string
    const subdir = rootURL.pathname.replace(/\/$/, '');
    const replacementRegex = new RegExp(escapeRegExp(options.replacementStr), 'g');
    return str.replace(replacementRegex, subdir);
};
exports.default = transformReadyToRelative;
