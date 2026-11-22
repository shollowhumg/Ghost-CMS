export interface Memoized<V> {
    (key: string): V;
    clear(): void;
}
/**
 * Memoize a pure single-argument function keyed on its string input, keeping
 * the `max` most recently used results so arbitrary input can't grow the cache
 * unchecked. Errors thrown by `fn` are not cached.
 *
 * @param {Function} fn function to memoize, must be a pure function of its input
 * @param {number} [max=100] maximum number of cached results
 * @returns {Function} memoized function with a `clear()` method
 */
export default function memoize<V extends object | string>(fn: (key: string) => V, max?: number): Memoized<V>;
