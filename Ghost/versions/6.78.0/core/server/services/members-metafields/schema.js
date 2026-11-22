"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbMetafieldChangeEventWithMember = exports.DbChangeEventMember = exports.DbMetafieldChangeEvent = exports.StoredFieldList = exports.MetafieldChangeEventFields = exports.DbNamedBinding = exports.DbBoundField = exports.DbMetafieldBinding = exports.DbStoredValueRow = exports.DbMetafieldValue = exports.WrittenBy = exports.DbTypedSettings = exports.DbMetafield = exports.storedField = exports.STORED_SETTINGS = exports.DB_METAFIELD_COLUMNS = exports.FieldStatusSchema = exports.FIELD_STATUS = void 0;
const zod_1 = require("zod");
const metafield_types_1 = require("@tryghost/metafield-types");
Object.defineProperty(exports, "FIELD_STATUS", { enumerable: true, get: function () { return metafield_types_1.FIELD_STATUS; } });
Object.defineProperty(exports, "FieldStatusSchema", { enumerable: true, get: function () { return metafield_types_1.FieldStatusSchema; } });
const date_1 = require("../../lib/db-types/date");
const json_1 = require("../../lib/db-types/json");
const access_1 = require("./access");
const identity_1 = require("@tryghost/metafield-types/identity");
// What a definition row holds beside its type and settings: with them, the single source for the
// read projection and the knex table type below.
exports.DB_METAFIELD_COLUMNS = {
    id: zod_1.z.string(),
    namespace: zod_1.z.string(),
    key: zod_1.z.string(),
    name: zod_1.z.string(),
    status: metafield_types_1.FieldStatusSchema,
    member_access: access_1.MemberAccessSchema,
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
};
/**
 * A field with nothing to set up stores null as its settings, which reads back as none. Such a
 * field has no settings to write at all, so the column's default stands in for them.
 */
const NoStoredSettings = zod_1.z.codec(zod_1.z.null().default(null), zod_1.z.undefined(), {
    decode: () => undefined,
    encode: () => null,
});
/**
 * Each shape's settings as the table holds them: a set's as JSON, and null for every other shape.
 * Read for their shape alone, since the rules apply when settings are written, so a rule tightened
 * later never hides a field set up under the old one.
 */
exports.STORED_SETTINGS = {
    scalar: NoStoredSettings,
    record: NoStoredSettings,
    set: (0, json_1.DbJson)(metafield_types_1.SHAPE_SETTINGS.set.read, { message: 'The stored settings are not JSON.' }),
};
/**
 * `STORED_SETTINGS`, except that settings which can't be read, such as settings that aren't JSON,
 * are read as the shape's default settings. A field whose settings were damaged is then read the
 * way a new field of its type starts, and the next write of its settings replaces them. Only for
 * reading: a write encodes through `STORED_SETTINGS`, so it never stores defaults it wasn't given.
 */
const STORED_SETTINGS_OR_DEFAULTS = {
    scalar: NoStoredSettings.catch(metafield_types_1.SHAPE_SETTINGS.scalar.defaults),
    record: NoStoredSettings.catch(metafield_types_1.SHAPE_SETTINGS.record.defaults),
    // A copy for each read, so a reader that changes the settings it was given can't change the
    // defaults every other read starts from.
    set: exports.STORED_SETTINGS.set.catch(() => structuredClone(metafield_types_1.SHAPE_SETTINGS.set.defaults)),
};
/**
 * A stored field with `base`'s columns, its type and its settings, read two ways: as stored, and
 * with its shape's default settings when the stored ones can't be read. `readStoredField` decides
 * between them.
 */
const storedField = (base) => ({
    asStored: (0, metafield_types_1.withTypedSettings)(base, exports.STORED_SETTINGS),
    withDefaults: (0, metafield_types_1.withTypedSettings)(base, STORED_SETTINGS_OR_DEFAULTS),
});
exports.storedField = storedField;
/** A definition as the table holds it, its settings read by the shape its type declares. */
exports.DbMetafield = (0, exports.storedField)(exports.DB_METAFIELD_COLUMNS);
/** A field's type and settings alone, as the table holds them. */
exports.DbTypedSettings = (0, metafield_types_1.withTypedSettings)({}, exports.STORED_SETTINGS);
/**
 * How a value arrived, not who caused it: who edited a member's fields is already an
 * action, and Stripe is not a person. `type` is the namespace that makes `id` resolvable —
 * `users`, `integrations`, `members_metafield_bindings` — so the one writer that
 * resolves in no table is the one with no id to give.
 */
exports.WrittenBy = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({ type: zod_1.z.literal('user'), id: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal('integration'), id: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal('binding'), id: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal('import'), id: zod_1.z.null() }),
    // A member writing their own answers. Resolvable in `members`, like the others,
    // and the only writer whose changes leave nothing in the staff action log: that
    // log records what staff did.
    zod_1.z.object({ type: zod_1.z.literal('member'), id: zod_1.z.string() }),
]);
/**
 * Each column a value is kept in, as the database holds it. Keyed by storage's columns, so a kind of
 * value storage adds fails to compile here until its column is read.
 */
const VALUE_COLUMN_SCHEMAS = {
    value_text: zod_1.z.string(),
};
// One part of a member's value. What a `path` means is storage.ts's business, so the row
// carries it as a plain string.
exports.DbMetafieldValue = zod_1.z.object({
    metafield_namespace: zod_1.z.string(),
    metafield_key: zod_1.z.string(),
    member_id: zod_1.z.string(),
    path: zod_1.z.string(),
    ...VALUE_COLUMN_SCHEMAS,
    // Plain columns rather than the `WrittenBy` union: the rule holds at the write
    // boundary, so one malformed row cannot throw away a member's whole profile on read.
    written_by_type: zod_1.z.string(),
    // Null for the one writer that resolves nowhere: an import, until runs are tracked.
    written_by_id: zod_1.z.string().nullable(),
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
// `type` drops a value whose type has left the catalog: its definition is no longer listed either,
// and the row fails to parse. What a field's rows add up to is read once per field, with its
// settings, from its definition rather than from each row.
exports.DbStoredValueRow = zod_1.z.object({
    member_id: zod_1.z.string(),
    namespace: identity_1.NamespaceSchema,
    key: identity_1.KeySchema,
    type: metafield_types_1.FieldTypeSchema,
    path: zod_1.z.string(),
    ...VALUE_COLUMN_SCHEMAS,
});
exports.DbMetafieldBinding = zod_1.z.object({
    id: zod_1.z.string(),
    port: zod_1.z.string(),
    metafield_namespace: zod_1.z.string(),
    metafield_key: zod_1.z.string(),
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
/** A binding joined to the field it points at, which is how a collected value is routed. */
exports.DbBoundField = zod_1.z.object({
    port: zod_1.z.string(),
    binding_id: zod_1.z.string(),
    namespace: identity_1.NamespaceSchema,
    key: identity_1.KeySchema,
    type: metafield_types_1.FieldTypeSchema,
});
/** A binding joined to the field it points at, by that field's identity. */
exports.DbNamedBinding = zod_1.z.object({
    port: zod_1.z.string(),
    namespace: identity_1.NamespaceSchema,
    key: identity_1.KeySchema,
});
/** The fields an entry names. */
exports.MetafieldChangeEventFields = zod_1.z.array(metafield_types_1.MetafieldChangeEventFieldSchema);
exports.StoredFieldList = (0, json_1.DbJson)(exports.MetafieldChangeEventFields, {
    message: 'The stored field list is not JSON.',
});
/** An entry as the table holds it. Writer and source are plain strings, as on the values table. */
exports.DbMetafieldChangeEvent = zod_1.z.object({
    id: zod_1.z.string(),
    member_id: zod_1.z.string(),
    written_by_type: zod_1.z.string(),
    written_by_id: zod_1.z.string().nullable(),
    source: zod_1.z.string(),
    metafields: exports.StoredFieldList,
    created_at: date_1.DbDate,
});
/** The member columns an entry is shown with: only what a feed row needs. */
exports.DbChangeEventMember = zod_1.z.object({
    id: zod_1.z.string(),
    uuid: zod_1.z.string(),
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
});
/**
 * An entry and its member read back together. Parses and nothing else: what to do with an
 * entry that doesn't parse is the reading service's decision.
 */
exports.DbMetafieldChangeEventWithMember = zod_1.z
    .object({ event: exports.DbMetafieldChangeEvent, member: exports.DbChangeEventMember })
    .transform(({ event, member }) => ({ ...event, member }));
