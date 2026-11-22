"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.limitConfig = void 0;
exports.applyLimitCap = applyLimitCap;
const config_1 = __importDefault(require("./config"));
// Prior to Ghost 6.x we allowed any limit value, including 'all', but as sites
// grew in size it led to performance issues and mis-use of the API.
// After Ghost 6.x we only allow a max limit of 100. This shared module provides
// the core limit capping logic that can be used by both middleware and helpers.
exports.limitConfig = {
    get allowLimitAll() {
        return config_1.default.get('optimization:allowLimitAll') || false;
    },
    get maxLimit() {
        return config_1.default.get('optimization:maxLimit') || 100;
    },
    // Temporary exceptions to the max limit rule (HTTP-specific)
    exceptionEndpoints: [
        '/ghost/api/admin/posts/export/',
        '/ghost/api/admin/emails/', // /:id/batches/ and /:id/recipient-failures/
    ],
};
/**
 * Apply limit capping logic to a limit value
 * @param limit - The limit value to cap
 * @param options - Optional settings, including a URL to check against exception endpoints
 */
function applyLimitCap(limit, options = {}) {
    if (!limit) {
        return limit;
    }
    // If 'all' is globally allowed, skip everything else
    if (limit === 'all' && exports.limitConfig.allowLimitAll) {
        return limit;
    }
    // Check exception endpoints - they bypass all limits (HTTP-specific)
    const { url } = options;
    if (url && exports.limitConfig.exceptionEndpoints.some((endpoint) => url.startsWith(endpoint))) {
        return limit;
    }
    // 'all' is no longer supported so gets capped to maxLimit
    if (limit === 'all') {
        return exports.limitConfig.maxLimit;
    }
    // Convert to number for comparison
    const numericLimit = parseInt(String(limit), 10);
    // If it's not a valid number or exceeds maxLimit, cap it
    if (isNaN(numericLimit) || numericLimit > exports.limitConfig.maxLimit) {
        return exports.limitConfig.maxLimit;
    }
    // Return the original limit if it's within bounds
    return limit;
}
