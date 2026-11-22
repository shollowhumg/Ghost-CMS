"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inlineCss = inlineCss;
const juice_1 = __importDefault(require("juice"));
/** Inlines the stylesheet rules of an email's HTML into style attributes and drops the style tags. */
function inlineCss(html) {
    // resolveCSSVariables crashes on nameless declarations in user-authored style attributes
    return (0, juice_1.default)(html, {
        inlinePseudoElements: true,
        removeStyleTags: true,
        resolveCSSVariables: false,
    });
}
