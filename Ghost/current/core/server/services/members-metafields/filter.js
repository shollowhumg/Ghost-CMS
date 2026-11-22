"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.METAFIELDS_RELATION = void 0;
exports.createMetafieldsFilterTransformer = createMetafieldsFilterTransformer;
// Translates the metafield clauses of a members filter into a query over the
// values table. A metafield is a publisher-defined field on a member; it is
// addressed as `namespace.key`, and a composite value such as an address names
// one of its parts by appending it: `namespace.key.part`.
//
//   (metafields.identity:'custom.company'+metafields.value:'Ghost')
//   (metafields.identity:'custom.shipping_address.country'+metafields.value:'GB')
//   metafields.identity:'custom.company'                     // has a value
//   metafields.identity:-'custom.shipping_address.country'   // that part is not set
//
// The values table holds one row per stored value: `metafield_namespace`,
// `metafield_key`, `path` (empty for a plain field, the part's name for one part of a
// composite) and the value, in the column its kind of value is kept in. A comparison against one
// value is made in the column of that value's kind, as NQL types it, so a field matches only a
// value of its own kind; a comparison against a list of values is made in the text column. A
// filter addresses those columns directly, so each one
// becomes an $elemMatch over them: positive asserts a matching row exists, and $not
// asserts none does, with no lookup against the field definitions. Which path holds a
// field's whole value is the storage layouts' to say, for every type at once.
const errors_1 = __importDefault(require("@tryghost/errors"));
const zod_1 = require("zod");
const identity_1 = require("@tryghost/metafield-types/identity");
const storage_1 = require("./storage");
const RELATION = 'metafields';
const PREFIX = `${RELATION}.`;
const IDENTITY_ATTRIBUTE = `${PREFIX}identity`;
const VALUE_ATTRIBUTE = `${PREFIX}value`;
// Only recurse into plain objects/arrays; a RegExp, Date, etc. is a leaf value that
// must pass through by reference (recursing would strip a regex to `{}`).
function isPlainObject(value) {
    return (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
}
function isMetafieldClause(node) {
    if (!isPlainObject(node)) {
        return false;
    }
    const keys = Object.keys(node);
    return keys.length === 1 && keys[0].startsWith(PREFIX);
}
// A grouped compound: an $and whose clauses all target the relation and name exactly one
// `identity`. Its clauses describe one value row.
//
// Exactly one, not at least one: two whole-field filters ANDed together arrive as a flat
// `identity:'a'+identity:'b'`, since a bare identity clause needs no group of its own. That is two
// filters — a member with a value for both — not one row that is somehow both fields, so
// it has to fall through and be transformed a clause at a time.
function isMetafieldCompound(clauses) {
    if (!Array.isArray(clauses) || clauses.length < 2 || !clauses.every(isMetafieldClause)) {
        return false;
    }
    return clauses.filter((clause) => Object.keys(clause)[0] === IDENTITY_ATTRIBUTE).length === 1;
}
// NQL compiles every negation in this grammar to `{$ne: <string>}`, so a negated clause
// can arrive in no other shape.
function negatedString(value) {
    return isPlainObject(value) && typeof value.$ne === 'string' ? value.$ne : null;
}
const ANY_PATH = null;
function targetOf(raw) {
    const identity = typeof raw === 'string' ? zod_1.z.safeDecode(identity_1.IdentityTextSchema, raw) : null;
    if (!identity?.success) {
        throw new errors_1.default.BadRequestError({
            message: `A metafield filter names a field as namespace.key, for example (${IDENTITY_ATTRIBUTE}:'custom.company'+${VALUE_ATTRIBUTE}:'Ghost').`,
        });
    }
    const { namespace, key, parts } = identity.data;
    return { namespace, key, path: parts.length > 0 ? (0, storage_1.pathOf)(parts) : ANY_PATH };
}
const Texts = zod_1.z.array(zod_1.z.string());
// The texts a list names, as NQL compiles it: any of them (`value:['a','b']`) for `$in`, every one
// of them (`value:['a'+'b']`) for `$all`, or none of them (`value:-['a','b']`) for `$nin`. Null
// for anything else.
function listed(value, operator) {
    if (!isPlainObject(value)) {
        return null;
    }
    const texts = Texts.safeParse(value[operator]);
    return texts.success ? texts.data : null;
}
// One value, or any of several, as a match on one column takes them.
const oneOf = (values) => values.length === 1 ? values[0] : { $in: values };
function createMetafieldsFilterTransformer() {
    function rowsOf(target) {
        const match = { metafield_namespace: target.namespace, metafield_key: target.key };
        if (target.path !== ANY_PATH) {
            match.path = target.path;
        }
        return match;
    }
    // The rows that hold one of `texts` as the target's value: at its part, or wherever a field's
    // whole value can be kept.
    function rowsHolding(target, texts) {
        return {
            ...rowsOf(target),
            path: oneOf(target.path === ANY_PATH ? (0, storage_1.pathsHolding)(texts) : [target.path]),
            value_text: oneOf(texts),
        };
    }
    const some = (match) => ({ [RELATION]: { $elemMatch: match } });
    const none = (match) => ({ [RELATION]: { $not: { $elemMatch: match } } });
    function buildElemMatch(target, value, negate) {
        if (value === undefined) {
            return negate ? none(rowsOf(target)) : some(rowsOf(target));
        }
        // A list is looked for wherever a value can be kept, so a set, which keeps a row per option,
        // is filtered by the options it holds. A list field is always filtered with a list.
        const anyOf = listed(value, '$in');
        if (anyOf) {
            return some(rowsHolding(target, anyOf));
        }
        // "All of" asks for a row holding each text in turn, since each row holds a single option.
        const allOf = listed(value, '$all');
        if (allOf) {
            return { $and: allOf.map((text) => some(rowsHolding(target, [text]))) };
        }
        // "None of" is asked of a value that is there: the target holds something, and none of what
        // it holds is one of these. A member holding nothing has no value to compare.
        const noneOf = listed(value, '$nin');
        if (noneOf) {
            return { $and: [some(rowsOf(target)), none(rowsHolding(target, noneOf))] };
        }
        // Any other comparison, such as one value or a match on part of the text, is made against one
        // row: the target's part, or the root a single-row value is kept at, in the column the compared
        // value's kind is kept in.
        return some({
            ...rowsOf(target),
            path: target.path ?? storage_1.ROOT_PATH,
            [(0, storage_1.valueColumnFor)(value)]: value,
        });
    }
    function toElemMatch(clauses) {
        let target;
        let value;
        let hasValue = false;
        for (const clause of clauses) {
            const [attribute, clauseValue] = Object.entries(clause)[0];
            if (attribute === IDENTITY_ATTRIBUTE) {
                if (negatedString(clauseValue) !== null) {
                    throw new errors_1.default.BadRequestError({
                        message: `A negated "${IDENTITY_ATTRIBUTE}" stands alone; it cannot be grouped with a value.`,
                    });
                }
                target = targetOf(clauseValue);
            }
            else if (attribute === VALUE_ATTRIBUTE) {
                if (hasValue) {
                    throw new errors_1.default.BadRequestError({
                        message: `A metafield filter takes one "${VALUE_ATTRIBUTE}" clause.`,
                    });
                }
                hasValue = true;
                value = clauseValue;
            }
            else {
                throw new errors_1.default.BadRequestError({
                    message: `Unsupported metafield filter clause "${attribute}".`,
                });
            }
        }
        if (!target) {
            throw new errors_1.default.BadRequestError({
                message: `A metafield filter needs a "${IDENTITY_ATTRIBUTE}" clause.`,
            });
        }
        return buildElemMatch(target, hasValue ? value : undefined, false);
    }
    function fromIdentityClause(value) {
        const negated = negatedString(value);
        if (negated !== null) {
            return buildElemMatch(targetOf(negated), undefined, true);
        }
        return buildElemMatch(targetOf(value), undefined, false);
    }
    function transform(node) {
        if (Array.isArray(node)) {
            return node.map(transform);
        }
        if (!isPlainObject(node)) {
            return node;
        }
        if (isMetafieldCompound(node.$and)) {
            return toElemMatch(node.$and);
        }
        const out = {};
        for (const [key, value] of Object.entries(node)) {
            if (key === IDENTITY_ATTRIBUTE) {
                Object.assign(out, fromIdentityClause(value));
            }
            else if (key.startsWith(PREFIX)) {
                throw new errors_1.default.BadRequestError({
                    message: `A "${key}" filter must be grouped with its "${IDENTITY_ATTRIBUTE}" clause, for example (${IDENTITY_ATTRIBUTE}:'custom.a_field'+${VALUE_ATTRIBUTE}:'a value').`,
                });
            }
            else {
                out[key] = transform(value);
            }
        }
        return out;
    }
    return (query) => transform(query);
}
/**
 * The Member filter relation that exposes metafield values. A member has many value
 * rows (one per field, or per part of a composite field), and a predicate asks whether
 * one of them matches, so this joins the values table on member_id and mongo-knex emits
 * it as a correlated `members.id IN (…)` subquery — composing with every other member
 * filter.
 */
exports.METAFIELDS_RELATION = {
    tableName: 'members_metafield_values',
    tableNameAs: RELATION,
    type: 'oneToOne',
    joinFrom: 'member_id',
};
