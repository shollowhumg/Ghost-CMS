"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const errors_1 = __importDefault(require("@tryghost/errors"));
const logging_1 = __importDefault(require("@tryghost/logging"));
const define_service_1 = require("../../../kernel/define-service");
const config_1 = __importDefault(require("../../../shared/config"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
const actions_1 = require("./actions");
const fetch_from_app_1 = require("./fetch-from-app");
const fetch_icon_1 = require("./fetch-icon");
const identity_check_1 = require("./identity-check");
const load_manifest_1 = require("./load-manifest");
const service_1 = require("./service");
/**
 * The apps slice of config, parsed here as the config guide asks of a feature's keys.
 *
 * - `localhostAlias` is set when Ghost runs in a container in development, where
 *   `localhost` is the container rather than the developer's machine. Ignored anywhere
 *   else.
 * - `trustedOrigins` lists the origins the site trusts to skip the challenge. It's read at
 *   boot, so an entry that isn't an origin stops Ghost starting instead of failing every
 *   app.
 */
/** A config entry as an error shows it, which is logged, so without a URL's credentials. */
function shown(entry) {
    if (typeof entry !== 'string') {
        return JSON.stringify(entry);
    }
    const url = URL.parse(entry);
    if (!url) {
        // One the URL parser refuses can still start with credentials, up to an `@`.
        return JSON.stringify(entry.replace(/^([^/?#]*\/\/)?[^/?#]*@/, '$1'));
    }
    if (url.username || url.password) {
        url.username = '';
        url.password = '';
        return JSON.stringify(url.href);
    }
    return JSON.stringify(entry);
}
const AppsConfig = zod_1.z.object({
    localhostAlias: zod_1.z.string().min(1).nullable().default(null),
    trustedOrigins: zod_1.z
        .unknown()
        .default([])
        .transform((entries, ctx) => {
        const read = (0, identity_check_1.readTrustedOrigins)(entries);
        if (!read.success) {
            ctx.addIssue({
                code: 'custom',
                message: `Expected a list of origins, such as https://app.example.com, not ${shown(read.entry)}`,
            });
            return zod_1.z.NEVER;
        }
        return read.origins;
    }),
});
function appsConfig() {
    const parsed = AppsConfig.safeParse(config_1.default.get('apps') ?? {});
    if (!parsed.success) {
        throw new errors_1.default.InternalServerError({
            message: 'The apps config is not valid.',
            code: 'APP_CONFIG_INVALID',
            context: zod_1.z.prettifyError(parsed.error),
        });
    }
    return parsed.data;
}
// Localhost manifest URLs, and the alias they are fetched through, are for development only.
const isDevelopment = () => config_1.default.get('env') === 'development';
function localhostAlias() {
    if (!isDevelopment()) {
        return null;
    }
    return appsConfig().localhostAlias;
}
const extras = { actingContext: actions_1.actingContext };
// Constructed by init() at boot, not at import: knex is only available once the DB has connected.
exports.default = (0, define_service_1.defineService)('App Installations', () => {
    // Checked now, so a mistake in it is found at boot. It's still read per use, as tests
    // change config.
    appsConfig();
    const { knex } = require('../../data/db');
    const models = require('../../models');
    const externalRequest = require('../../lib/request-external');
    const recordAction = (input) => (0, actions_1.recordAppInstallationAction)({ Action: models.Action, logging: logging_1.default, ...input });
    const fetchFromApp = (0, fetch_from_app_1.createAppFetcher)({
        request: externalRequest,
        getLocalhostAlias: localhostAlias,
    });
    // Read per use, not once at boot: it's config, which tests change.
    const getManifestRules = () => ({
        ghostUrls: [url_utils_1.default.urlFor('home', true), url_utils_1.default.urlFor('admin', true)],
        allowLocalhost: isDevelopment(),
    });
    return new service_1.AppInstallationsService({
        knex,
        recordAction,
        loadManifest: (0, load_manifest_1.createManifestLoader)({ fetchFromApp, logging: logging_1.default, getManifestRules }),
        identity: (0, identity_check_1.createIdentityChecker)({
            fetchFromApp,
            logging: logging_1.default,
            // Read per check, not once at boot: it's config, which tests change.
            getTrustConfig: () => ({
                trustedOrigins: appsConfig().trustedOrigins,
                trustLoopback: isDevelopment(),
            }),
            getManifestRules,
        }),
        fetchIcon: (0, fetch_icon_1.createIconFetcher)({ fetchFromApp, logging: logging_1.default }),
    });
}, extras);
