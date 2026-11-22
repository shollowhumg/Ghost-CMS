import { GhostError, GhostErrorOptions } from './GhostError';
import { ValidationError } from './errors';
/**
 * Structural subset of a zod issue. Typed structurally so this package does not
 * depend on zod, and works with both zod v3 and v4 errors.
 */
export interface ZodIssueLike {
    code: string;
    path: PropertyKey[];
    message: string;
}
/** Structural subset of a `ZodError`. */
export interface ZodErrorLike {
    issues: ZodIssueLike[];
    stack?: string;
}
export interface ZodErrorDetail {
    /** Formatted path, e.g. `tags[0].name`. Empty string for the root value. */
    path: string;
    message: string;
    code: string;
}
export type GhostErrorConstructor<T extends GhostError> = new (options?: GhostErrorOptions) => T;
/**
 * Duck-typed check for zod errors (v3 or v4) without requiring zod.
 */
export declare function isZodError(err: unknown): err is ZodErrorLike;
/**
 * Converts zod issues into structured details with formatted paths.
 */
export declare function getZodErrorDetails(issues: ZodIssueLike[]): ZodErrorDetail[];
/**
 * Formats zod issues as a single human-readable line, e.g.
 * `email: Invalid email; tags[0].name: Required`.
 */
export declare function formatZodIssues(issues: ZodIssueLike[]): string;
/**
 * Wraps a zod error in a Ghost error. Defaults to `ValidationError`; pass an error
 * class as the second argument to use another one, e.g. `IncorrectUsageError` when
 * the invalid input came from calling code rather than from a user request.
 * Options override the derived `message`, `property`, and `errorDetails`.
 */
export declare function fromZodError(err: ZodErrorLike, options?: GhostErrorOptions): ValidationError;
export declare function fromZodError<T extends GhostError>(err: ZodErrorLike, ErrorClass: GhostErrorConstructor<T>, options?: GhostErrorOptions): T;
//# sourceMappingURL=zod.d.ts.map