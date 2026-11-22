"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = memoize;
const lru_cache_1 = require("lru-cache");
/**
 * Memoize a pure single-argument function keyed on its string input, keeping
 * the `max` most recently used results so arbitrary input can't grow the cache
 * unchecked. Errors thrown by `fn` are not cached.
 *
 * @param {Function} fn function to memoize, must be a pure function of its input
 * @param {number} [max=100] maximum number of cached results
 * @returns {Function} memoized function with a `clear()` method
 */
function memoize(fn, max = 100) {
    const cache = new lru_cache_1.LRUCache({ max });
    const memoized = function (key) {
        let value = cache.get(key);
        if (value === undefined) {
            value = fn(key);
            cache.set(key, value);
        }
        return value;
    };
    memoized.clear = function clear() {
        cache.clear();
    };
    return memoized;
}
