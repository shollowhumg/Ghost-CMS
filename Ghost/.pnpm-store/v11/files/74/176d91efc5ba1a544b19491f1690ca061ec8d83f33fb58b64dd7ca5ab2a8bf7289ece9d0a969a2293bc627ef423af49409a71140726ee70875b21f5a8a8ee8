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
const moment = __importStar(require("moment-timezone"));
const memoize_1 = __importDefault(require("./memoize"));
// Intl uses the Julian calendar before 1582 and moment pads/formats years outside
// 4 digits differently, only use Intl for timestamps comfortably inside 1900-9999
const MIN_TIMESTAMP = Date.UTC(1900, 0, 2);
const MAX_TIMESTAMP = Date.UTC(9999, 11, 30);
// moment's default postformat, which leaves formatted digits as-is. Locales like
// 'ar' override it to output non-Latin digits
const DEFAULT_POSTFORMAT = moment.localeData('en').postformat;
// en-CA formats as YYYY-MM-DD. Throws for timezones moment doesn't know (it falls
// back to UTC for those, while Intl accepts some, e.g. '+01:00') or Intl doesn't support
const getFormatter = (0, memoize_1.default)(function getFormatter(timezone) {
    if (!moment.tz.zone(timezone)) {
        throw new RangeError(`Unknown timezone: ${timezone}`);
    }
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
});
function getDateParts(date, timezone) {
    const timestamp = date instanceof Date ? date.getTime() : date;
    const isIntlTimestamp = typeof timestamp === 'number' && timestamp >= MIN_TIMESTAMP && timestamp <= MAX_TIMESTAMP;
    // the active moment locale is global, so check it on every call
    const isDefaultLocale = moment.localeData().postformat === DEFAULT_POSTFORMAT;
    if (isIntlTimestamp && isDefaultLocale) {
        try {
            const formatted = getFormatter(timezone).format(timestamp);
            return { year: formatted.slice(0, 4), month: formatted.slice(5, 7), day: formatted.slice(8, 10) };
        }
        catch {
            // unknown or unsupported timezone, use moment below
        }
    }
    // moment handles everything Intl can't match exactly: strings (parsed in the
    // site timezone), invalid dates, years outside 1900-9999, unknown timezones and
    // locales that rewrite digits
    const publishedAt = moment.tz(date, timezone);
    return {
        year: publishedAt.format('YYYY'),
        month: publishedAt.format('MM'),
        day: publishedAt.format('DD')
    };
}
function getPublishedDateParts(resource, timezone) {
    return getDateParts(resource.published_at || Date.now(), timezone);
}
const Token = {
    Year: 0,
    Month: 1,
    Day: 2,
    Author: 3,
    PrimaryAuthor: 4,
    PrimaryTag: 5,
    Slug: 6,
    Id: 7
};
const TOKENS = new Map([
    [':year', Token.Year],
    [':month', Token.Month],
    [':day', Token.Day],
    [':author', Token.Author],
    [':primary_author', Token.PrimaryAuthor],
    [':primary_tag', Token.PrimaryTag],
    [':slug', Token.Slug],
    [':id', Token.Id]
]);
// Permalink patterns are a tiny set (one per collection/route), so parse each
// once rather than running the token regex on every call
const compilePermalink = (0, memoize_1.default)(function compilePermalink(permalink) {
    const parts = [];
    let lastIndex = 0;
    for (const match of permalink.matchAll(/:[a-z_]+/g)) {
        if (match.index > lastIndex) {
            parts.push(permalink.slice(lastIndex, match.index));
        }
        // unknown route segments are output as the string 'undefined'
        parts.push(TOKENS.get(match[0]) ?? 'undefined');
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < permalink.length) {
        parts.push(permalink.slice(lastIndex));
    }
    return parts;
});
/**
 * creates the url path for a post based on blog timezone and permalink pattern
 */
function replacePermalink(permalink, resource, timezone = 'UTC') {
    // used in place of a missing primary tag or author
    const fallbackSlug = 'all';
    // date parts are only computed if the permalink contains a date token
    let dateParts;
    let result = '';
    for (const part of compilePermalink(permalink)) {
        if (typeof part === 'string') {
            result += part;
            continue;
        }
        switch (part) {
            case Token.Year:
                dateParts ??= getPublishedDateParts(resource, timezone);
                result += dateParts.year;
                break;
            case Token.Month:
                dateParts ??= getPublishedDateParts(resource, timezone);
                result += dateParts.month;
                break;
            case Token.Day:
                dateParts ??= getPublishedDateParts(resource, timezone);
                result += dateParts.day;
                break;
            case Token.Author:
                result += resource.primary_author?.slug ?? 'undefined';
                break;
            case Token.PrimaryAuthor:
                result += resource.primary_author ? resource.primary_author.slug : fallbackSlug;
                break;
            case Token.PrimaryTag:
                result += resource.primary_tag ? resource.primary_tag.slug : fallbackSlug;
                break;
            case Token.Slug:
                result += resource.slug;
                break;
            case Token.Id:
                result += resource.id;
                break;
        }
    }
    return result;
}
exports.default = replacePermalink;
