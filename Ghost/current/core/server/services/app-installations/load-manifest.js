"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManifestLoader = createManifestLoader;
const node_crypto_1 = require("node:crypto");
const errors_1 = __importDefault(require("@tryghost/errors"));
const zod_1 = require("zod");
const identity_1 = require("@tryghost/app-contracts/identity");
const manifest_1 = require("@tryghost/app-contracts/manifest");
const fetch_manifest_1 = require("./fetch-manifest");
const schema_1 = require("./schema");
/**
 * Encoding writes keys in the schema's order, so the same manifest always serialises the
 * same way. The manifest names its own URL, so the digest covers that too.
 */
function digestOf(serialisedManifest) {
    return (0, node_crypto_1.createHash)('sha256').update(serialisedManifest).digest('hex');
}
/**
 * Checks a manifest URL, fetches the signed manifest through `fetchFromApp`, parses the
 * manifest inside it, and verifies its signature with the identity key it names. The
 * manifest is checked before its signature, so its developer sees every problem with it,
 * but nothing in it is used unless the signature is valid. Redirects are only checked for
 * staying on the same host (or upgrading HTTP to HTTPS); the manifest must name the URL it
 * was asked for, wherever that redirects.
 *
 * A manifest URL on one of Ghost's own hosts, on any port, is refused before anything is
 * fetched. Every path in the manifest resolves onto that host, where browsers send Ghost's
 * cookies whatever the port. And the outbound request guard lets a request to the site's
 * own address through without checking where it resolves.
 *
 * Every problem is thrown as a Ghost error with an `APP_MANIFEST_*` code, which Admin
 * explains to the publisher. `getManifestRules` is called on every load because it reads
 * config.
 */
function createManifestLoader({ fetchFromApp, logging, getManifestRules, }) {
    const fetchManifest = (0, fetch_manifest_1.createManifestFetcher)({ fetchFromApp, logging });
    return async function loadManifest(input) {
        const rules = getManifestRules();
        const address = (0, manifest_1.parseManifestUrl)(input, rules);
        if (!address.success) {
            throw new errors_1.default.ValidationError({
                message: 'The app manifest URL is not valid.',
                code: 'APP_MANIFEST_URL_INVALID',
                context: address.error,
            });
        }
        const { manifestUrl } = address;
        const signed = (0, identity_1.readSignedManifest)(await fetchManifest(manifestUrl));
        if (!signed.success) {
            throw new errors_1.default.ValidationError({
                message: 'The app’s manifest is not signed.',
                code: 'APP_MANIFEST_UNSIGNED',
                context: signed.error,
            });
        }
        const parsed = (0, manifest_1.parseManifest)((0, fetch_manifest_1.parseJson)(signed.payload, manifestUrl), { ...rules, manifestUrl });
        if (!parsed.success) {
            const context = (0, manifest_1.formatManifestErrors)(parsed.errors, '; ');
            if (parsed.reason === 'manifest_url_mismatch') {
                throw new errors_1.default.ValidationError({
                    message: 'The app’s manifest is for another address.',
                    code: 'APP_MANIFEST_URL_MISMATCH',
                    context,
                });
            }
            throw new errors_1.default.ValidationError({
                message: 'The app manifest is not valid.',
                code: 'APP_MANIFEST_INVALID',
                context,
                // Each problem separately, so Admin can list them for the app's developer.
                errorDetails: parsed.errors,
            });
        }
        const { manifest } = parsed;
        const verified = await (0, identity_1.verifySignedManifest)(signed.signed, manifest.identity_key);
        if (!verified.success) {
            throw new errors_1.default.ValidationError({
                message: 'The app’s manifest signature is not valid.',
                code: 'APP_MANIFEST_SIGNATURE_INVALID',
                context: verified.error,
            });
        }
        // Measured on what's stored, which holds the paths resolved, so it can be longer than
        // what the app signed.
        const serialised = zod_1.z.encode(schema_1.StoredManifest, manifest);
        if (Buffer.byteLength(serialised) > identity_1.MANIFEST_MAX_BYTES) {
            throw (0, fetch_manifest_1.manifestTooLarge)(manifestUrl);
        }
        return {
            manifestUrl,
            manifest,
            serialised,
            digest: digestOf(serialised),
            identityKeyThumbprint: await (0, identity_1.thumbprintOf)(manifest.identity_key),
            backendKeyThumbprint: await (0, identity_1.thumbprintOf)(manifest.backend_key),
        };
    };
}
