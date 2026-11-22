"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifestTooLarge = manifestTooLarge;
exports.createManifestFetcher = createManifestFetcher;
exports.parseJson = parseJson;
const identity_1 = require("@tryghost/app-contracts/identity");
const errors_1 = __importDefault(require("@tryghost/errors"));
// Says only how the app answered, never why any other request failed, so the preview
// can't be used to probe the server's network. The reason is logged, so an operator can
// still tell a timeout from a certificate problem.
function unreachable(manifestUrl, failure, logging) {
    let context = manifestUrl;
    if (failure.reason === 'location_not_url') {
        context = `${manifestUrl} answered with HTTP ${failure.status} and a Location that is not a URL`;
    }
    else if (failure.status) {
        context = `${manifestUrl} answered with HTTP ${failure.status}`;
    }
    logging.warn(`Could not load the app manifest at ${manifestUrl}`);
    // A refused redirect has no cause beyond the answer, so the answer is logged.
    logging.warn(failure.reason === 'unreachable' ? failure.cause : context);
    return new errors_1.default.ValidationError({
        message: 'Could not load the app’s manifest.',
        code: 'APP_MANIFEST_UNREACHABLE',
        context,
    });
}
function manifestError(manifestUrl, failure, logging) {
    switch (failure.reason) {
        case 'unreachable':
        case 'location_not_url':
        case 'redirect_refused':
            return unreachable(manifestUrl, failure, logging);
        case 'redirected':
            return new errors_1.default.ValidationError({
                message: 'The app’s manifest redirects to another host.',
                code: 'APP_MANIFEST_REDIRECTED',
                context: `${manifestUrl} redirects to ${failure.host}`,
            });
        case 'too_large':
            return manifestTooLarge(manifestUrl);
    }
}
function manifestTooLarge(manifestUrl) {
    return new errors_1.default.ValidationError({
        message: `The app’s manifest is larger than ${identity_1.MANIFEST_MAX_BYTES / 1024} KB.`,
        code: 'APP_MANIFEST_TOO_LARGE',
        context: manifestUrl,
    });
}
/**
 * Fetches an app's manifest server-side, so a manifest is never taken from the browser.
 * `createAppFetcher` describes the redirect, alias, time and size rules it is read with.
 */
function createManifestFetcher({ fetchFromApp, logging, }) {
    return async function fetchManifest(manifestUrl) {
        const fetched = await fetchFromApp(manifestUrl, {
            maxBytes: identity_1.SIGNED_MANIFEST_MAX_BYTES,
            headers: { accept: 'application/json' },
        });
        if (!fetched.success) {
            throw manifestError(manifestUrl, fetched.failure, logging);
        }
        // Decoded as UTF-8, which is what JSON should use, whatever charset the app names.
        return parseJson(fetched.body.toString('utf8'), manifestUrl);
    };
}
/**
 * Parses JSON the app served: the signed manifest, or the manifest inside it. A byte order
 * mark is valid at the start of a JSON file, but JSON.parse rejects it.
 */
function parseJson(text, manifestUrl) {
    try {
        return (0, identity_1.parseJsonText)(text);
    }
    catch {
        throw new errors_1.default.ValidationError({
            message: 'The app’s manifest is not JSON.',
            code: 'APP_MANIFEST_NOT_JSON',
            context: manifestUrl,
        });
    }
}
