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
Object.defineProperty(exports, "__esModule", { value: true });
exports.replace = void 0;
const html5parser_1 = require("html5parser");
const entities = __importStar(require("entities"));
/**
 * Replaces the links in the provided HTML
 */
const replace = async (html, replaceLink, options = {}) => {
    try {
        const tokens = (0, html5parser_1.tokenize)(html);
        const replacements = [];
        let inAnchor = false;
        let inHref = false;
        // const enum TokenKind {
        // 0  Literal,
        // 1  OpenTag, // trim leading '<'
        // 2  OpenTagEnd, // trim tailing '>', only could be '/' or ''
        // 3  CloseTag, // trim leading '</' and tailing '>'
        // 4  Whitespace, // the whitespace between attributes
        // 5  AttrValueEq,
        // 6  AttrValueNq,
        // 7  AttrValueSq,
        // 8  AttrValueDq,
        // }
        for (const token of tokens) {
            if (token.type === 1 && token.value === 'a') {
                inAnchor = true;
            }
            if (inAnchor) {
                if (token.type === 2) {
                    inAnchor = false;
                    inHref = false;
                }
                if (token.type === 6 && token.value === 'href') {
                    inHref = true;
                }
                if (inHref && token.type === 8) {
                    const path = entities.decode(token.value.substring(1, token.value.length - 1));
                    let url;
                    try {
                        url = new URL(path, options.base);
                    }
                    catch (e) {
                        // Ignore invalid URLs
                    }
                    if (url) {
                        const replacement = await replaceLink(url, path);
                        const str = replacement.toString();
                        replacements.push({ url: str, start: token.start + 1, end: token.end - 1 });
                    }
                    inHref = false;
                }
            }
        }
        let offsetAdjustment = 0;
        replacements.forEach(({ url, start, end }) => {
            const originalLength = end - start;
            const replacementLength = url.length;
            html = html.slice(0, start + offsetAdjustment) + url + html.slice(end + offsetAdjustment);
            offsetAdjustment += replacementLength - originalLength;
        });
        return html;
    }
    catch (e) {
        // do nothing in case of error,
        // we don't want to break the content for the sake of member attribution
        return html;
    }
};
exports.replace = replace;
