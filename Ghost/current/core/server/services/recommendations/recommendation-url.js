"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATH_SUFFIX = void 0;
exports.isRecommendationUrl = isRecommendationUrl;
exports.PATH_SUFFIX = '/.well-known/recommendations.json';
function isRecommendationUrl(url) {
    return url.pathname.endsWith(exports.PATH_SUFFIX);
}
