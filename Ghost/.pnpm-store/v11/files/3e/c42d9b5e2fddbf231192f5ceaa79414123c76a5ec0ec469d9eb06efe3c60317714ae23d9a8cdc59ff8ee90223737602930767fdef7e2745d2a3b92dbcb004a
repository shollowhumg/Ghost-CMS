import type { TransformReadyReplacementOptions, BaseUrlOptions } from './types';
export interface TransformReadyToAbsoluteOptions extends TransformReadyReplacementOptions, BaseUrlOptions {
    staticImageUrlPrefix: string;
    staticFilesUrlPrefix: string;
    staticMediaUrlPrefix: string;
}
export type TransformReadyToAbsoluteOptionsInput = Partial<TransformReadyToAbsoluteOptions>;
export declare const DEFAULT_OPTIONS: Readonly<TransformReadyToAbsoluteOptions>;
/**
 * Replaces every `replacementStr` in `str` with the root URL, or the matching
 * CDN base URL when the placeholder is followed by a static asset prefix.
 * Expects fully-populated options, callers are responsible for merging defaults.
 */
export declare function replaceTransformReadyPlaceholders(str: string, root: string, options: TransformReadyToAbsoluteOptions): string;
declare const transformReadyToAbsolute: (str: string | undefined, root: string, _options?: TransformReadyToAbsoluteOptionsInput) => string;
export default transformReadyToAbsolute;
