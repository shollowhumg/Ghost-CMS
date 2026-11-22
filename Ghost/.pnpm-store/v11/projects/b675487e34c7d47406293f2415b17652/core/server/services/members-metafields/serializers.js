"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHeldValuesResponse = exports.toMetafieldsResponse = void 0;
exports.namespaceRoute = namespaceRoute;
exports.fieldRoute = fieldRoute;
const zod_1 = require("zod");
const metafield_types_1 = require("@tryghost/metafield-types");
const identity_1 = require("@tryghost/metafield-types/identity");
const case_keys_1 = require("../../lib/case-keys");
const parse_request_1 = require("../../lib/parse-request");
const models_1 = require("./models");
const NamespaceRoute = zod_1.z.object({ namespace: identity_1.NamespaceSchema });
/**
 * The namespace a route names. A segment that breaks the rule every segment follows is
 * refused before anything looks it up, the way a malformed id is.
 */
function namespaceRoute(options) {
    return (0, parse_request_1.parseRequest)(NamespaceRoute, options, 'namespace');
}
/** The field a route names: the identity its namespace and key make, checked the same way. */
function fieldRoute(options) {
    return (0, parse_request_1.parseRequest)(identity_1.IdentitySchema, options, 'key');
}
const MetafieldsResponse = zod_1.z.object({ members_metafields: zod_1.z.array(metafield_types_1.MetafieldDefinitionSchema) });
exports.toMetafieldsResponse = zod_1.z
    .array(models_1.Metafield)
    .transform((fields) => ({
    members_metafields: fields.map(({ createdAt, updatedAt, ...field }) => ({
        ...(0, case_keys_1.snakeKeys)(field),
        created_at: createdAt.toISOString(),
        updated_at: updatedAt?.toISOString() ?? null,
    })),
}))
    .pipe(MetafieldsResponse);
const HeldValuesResponse = zod_1.z.object({ values: zod_1.z.array(zod_1.z.object({ value: zod_1.z.string() })) });
/** The values members hold for a field, as the Admin API answers a read of them. */
exports.toHeldValuesResponse = zod_1.z
    .array(zod_1.z.string())
    .transform((values) => ({ values: values.map((value) => ({ value })) }))
    .pipe(HeldValuesResponse);
