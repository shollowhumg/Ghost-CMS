"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metafieldCodecWithDefaults = exports.metafieldCodec = void 0;
const zod_1 = require("zod");
const case_keys_1 = require("../../lib/case-keys");
const schema_1 = require("./schema");
const models_1 = require("./models");
// DbMetafield reads the type and its settings against each other, so both pass through as they
// are, and camelKeys keeps their types without a cast.
exports.metafieldCodec = zod_1.z.codec(schema_1.DbMetafield.asStored, models_1.Metafield, {
    decode: (row) => ({ ...(0, case_keys_1.camelKeys)(row), access: { member: row.member_access } }),
    encode: (field) => ({ ...(0, case_keys_1.snakeKeys)(field), member_access: field.access.member }),
});
/**
 * The same codec, except that a field whose stored settings can't be read is read with its type's
 * default settings.
 */
exports.metafieldCodecWithDefaults = zod_1.z.codec(schema_1.DbMetafield.withDefaults, models_1.Metafield, {
    decode: (row) => ({ ...(0, case_keys_1.camelKeys)(row), access: { member: row.member_access } }),
    encode: (field) => ({ ...(0, case_keys_1.snakeKeys)(field), member_access: field.access.member }),
});
