"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbConfigParts = exports.DbStripeCheckoutConfig = exports.CONFIG_SLUG = exports.CONFIG_TABLE = void 0;
const zod_1 = require("zod");
const date_1 = require("../../lib/db-types/date");
exports.CONFIG_TABLE = 'stripe_checkout_config';
/** The slug of the config's single row. Saving inserts the row with this slug, or updates it. */
exports.CONFIG_SLUG = 'default';
/** A `stripe_checkout_config` row. */
exports.DbStripeCheckoutConfig = zod_1.z.object({
    id: zod_1.z.string(),
    slug: zod_1.z.string(),
    design: zod_1.z.string().nullable(),
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
/** The columns holding the parts of the config that are Stripe's own, each JSON or null. */
exports.DbConfigParts = exports.DbStripeCheckoutConfig.pick({
    design: true,
});
