"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explore = void 0;
const zod_1 = require("zod");
/**
 * Ghost Explore. Only production config sets this, so it is optional.
 *
 * Closed: its two readers - the explore ping and the public config endpoint -
 * read only the keys named here.
 *
 * @TODO: Ghost 7.0 - tighten both URLs to `httpUrl()` from ./primitives, still
 * allowing `''`, which turns the ping off. Stricter than 6.x accepts.
 */
exports.explore = zod_1.z
    .object({
    update_url: zod_1.z
        .string()
        .optional()
        .meta({
        description: 'Where the site sends its Explore ping. Pinging is skipped when unset.',
        examples: ['https://explore.ghost.org/api/update'],
    }),
    testimonials_url: zod_1.z
        .string()
        .optional()
        .meta({
        description: 'Explore testimonials endpoint, passed to Admin through the public config.',
        examples: ['https://explore.ghost.org/api/testimonials'],
    }),
})
    .optional()
    .meta({ description: 'Ghost Explore, the directory of Ghost sites.' });
