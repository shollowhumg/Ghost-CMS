"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnakeDesign = void 0;
exports.configRow = configRow;
const zod_1 = require("zod");
const case_keys_1 = require("../../lib/case-keys");
const json_1 = require("../../lib/db-types/json");
const models_1 = require("./models");
/** The design's fields in snake_case, as used by the database, the Admin API and Stripe. */
exports.SnakeDesign = zod_1.z.object((0, case_keys_1.snakeKeys)(models_1.StripeCheckoutDesign.shape));
/**
 * The parts of a `stripe_checkout_config` row that are Stripe's own, each JSON or null. They
 * are validated when read as well as when saved, so a stored value that is no longer allowed
 * never reaches Stripe. The collected parts have no column here: their tiers and options are the
 * tier requirement each is required under.
 *
 * A design that can no longer be read, such as one using a font Stripe has dropped, reads as
 * none and is logged. Checkouts then use the Stripe dashboard's design until the publisher saves
 * one again.
 */
function configRow(logging) {
    return zod_1.z.object({
        design: (0, json_1.DbJson)(zod_1.z.codec(exports.SnakeDesign, models_1.StripeCheckoutDesign, { decode: case_keys_1.camelKeys, encode: case_keys_1.snakeKeys }), { message: 'The stored Stripe Checkout design is not JSON.' })
            .nullable()
            .catch(({ error }) => {
            logging.warn({
                event: { name: 'stripe_checkout.design.unreadable' },
                err: new zod_1.z.ZodError(error.issues),
            }, 'Ignoring a Stripe Checkout design that is no longer valid');
            return null;
        }),
    });
}
