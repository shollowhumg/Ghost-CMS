"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lenient = lenient;
exports.parseLeniently = parseLeniently;
const zod_1 = require("zod");
/** Issues the current lenient parse has caught. Parsing is synchronous, so one sink is enough. */
let sink = null;
function isFatal(schema) {
    return zod_1.z.globalRegistry.get(schema)?.fatal === true;
}
/** The schemas directly inside another, for walking the tree. */
function children(schema) {
    const def = schema._zod.def;
    switch (def.type) {
        case 'object':
            return [
                ...Object.values(def.shape),
                ...(def.catchall ? [def.catchall] : []),
            ];
        case 'union':
            return def.options;
        case 'pipe':
            return [def.in, def.out];
        case 'array':
            return [def.element];
        case 'record':
            return [def.keyType, def.valueType];
        case 'tuple':
            return [...def.items, ...(def.rest ? [def.rest] : [])];
        default:
            return def.innerType ? [def.innerType] : [];
    }
}
function containsFatal(schema) {
    return isFatal(schema) || children(schema).some(containsFatal);
}
/** A leaf that falls back to its raw input instead of failing the parse, recording why. */
function catchLeaf(schema, path) {
    return schema.catch((ctx) => {
        for (const issue of ctx.error.issues) {
            sink?.push({ ...issue, path: [...path, ...issue.path] });
        }
        return ctx.value;
    });
}
/**
 * A copy of `schema` that never fails on a bad leaf.
 *
 * Each leaf is wrapped in `.catch()`, so a bad value falls back to its raw input
 * and the rest of the parse - transforms and defaults included - still runs.
 * The wrapper knows its own key path, which `ctx.error` does not. Containers
 * are rebuilt around their wrapped children, so one bad leaf costs only that
 * leaf, and are caught too, so a failure of the container itself - a missing
 * section, an unknown key in a strict object - costs only that section.
 *
 * Left unwrapped, so they still fail the whole parse:
 * - anything marked `.meta({fatal: true})`, and everything holding one, so the
 *   failure reaches the top
 * - a discriminated union's discriminator, so an unknown value can't match
 *   every option. The union as a whole falls back instead.
 *
 * A union's options and an object a transform reads aren't caught themselves:
 * zod needs an option to be a plain object, and a transform must never be
 * handed a raw fallback for its whole input. The union or transform is caught
 * instead.
 */
function lenient(schema, path = []) {
    return wrap(schema, path);
}
function wrap(schema, path, { discriminator, bare } = {}) {
    if (isFatal(schema)) {
        return schema;
    }
    // a catch here would swallow a fatal failure from anywhere inside
    const guard = (rebuilt) => bare || containsFatal(schema) ? rebuilt : catchLeaf(rebuilt, path);
    const def = schema._zod.def;
    switch (def.type) {
        case 'object': {
            const shape = def.shape;
            const wrapped = Object.fromEntries(Object.entries(shape).map(([key, child]) => [
                key,
                key === discriminator ? child : wrap(child, [...path, key]),
            ]));
            return guard(schema.clone({ ...def, shape: wrapped }));
        }
        case 'optional':
        case 'nullable':
        case 'default':
        case 'prefault':
        case 'readonly':
            return schema.clone({
                ...def,
                innerType: wrap(def.innerType, path, { bare }),
            });
        case 'pipe': {
            // an object-level transform: a bad leaf inside it falls back on its own, so
            // the transform still runs; a bad object as a whole fails the pipe
            const input = def.in;
            if (input._zod.def.type === 'object') {
                return guard(schema.clone({ ...def, in: wrap(input, path, { bare: true }) }));
            }
            return guard(schema);
        }
        case 'union': {
            const key = def.discriminator;
            if (!key) {
                return guard(schema);
            }
            const options = def.options.map((option) => wrap(option, path, { discriminator: key, bare: true }));
            return guard(schema.clone({ ...def, options }));
        }
        default:
            return guard(schema);
    }
}
/**
 * Parse with `lenient(schema)`, returning the data and every issue it caught.
 * A fatal key still throws, as a ZodError.
 */
function parseLeniently(schema, input) {
    const issues = [];
    sink = issues;
    try {
        return { data: schema.parse(input), issues };
    }
    finally {
        sink = null;
    }
}
