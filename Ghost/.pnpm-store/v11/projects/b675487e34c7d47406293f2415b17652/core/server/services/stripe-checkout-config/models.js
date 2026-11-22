"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeCheckoutBranding = exports.COLLECTION_FLAG = exports.COLLECTED_NOUNS = exports.SECTION_NAMES = exports.COLLECTED_SECTIONS = exports.SECTION_OF = exports.StripeCheckoutConfig = exports.PhoneSettings = exports.ShippingSettings = exports.StripeCheckoutDesign = exports.HexColor = void 0;
const zod_1 = require("zod");
const checkout_1 = require("@tryghost/checkout");
const identity_1 = require("@tryghost/metafield-types/identity");
const checkout_2 = require("@tryghost/checkout");
/**
 * A color as a 6-digit hex code. It is lowercased, so the same color is always stored the same
 * way.
 */
exports.HexColor = zod_1.z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, { error: 'Enter a color as a 6-digit hex code, like #15171a.' });
/**
 * The checkout design, made of the fields of Stripe's `branding_settings` in camelCase.
 *
 * Every field is required, because a design replaces the one set in the Stripe dashboard
 * rather than being merged with it.
 */
exports.StripeCheckoutDesign = zod_1.z.object({
    buttonColor: exports.HexColor,
    backgroundColor: exports.HexColor,
    borderStyle: zod_1.z.enum(checkout_1.STRIPE_CHECKOUT_BORDER_STYLES, {
        error: 'Choose rounded, rectangular or pill corners.',
    }),
    fontFamily: zod_1.z.enum(checkout_1.STRIPE_CHECKOUT_FONTS, { error: 'Choose a font Stripe Checkout offers.' }),
});
/** What every collected part is set with: the paid tiers whose checkouts ask for it. */
const CollectedPart = zod_1.z.object({
    /** Null covers every paid tier, including tiers added later. */
    tierIds: zod_1.z.array(zod_1.z.string()).nullable(),
});
/**
 * Collecting a shipping address at checkout, as the publisher set it.
 *
 * Stripe returns the recipient's name beside the address rather than as part of it, and an
 * address custom field has no name part, so the name lands in a field of its own.
 */
exports.ShippingSettings = CollectedPart.extend({
    /** ISO 3166-1 alpha-2 codes, or null for everywhere Stripe ships. */
    allowedCountries: zod_1.z.array(zod_1.z.string()).nullable(),
    addressCustomFieldKey: identity_1.KeySchema,
    nameCustomFieldKey: identity_1.KeySchema,
});
/** Collecting a phone number at checkout, as the publisher set it. */
exports.PhoneSettings = CollectedPart.extend({
    customFieldKey: identity_1.KeySchema,
});
/** Each collected part of the config as saved. */
const COLLECTED_SETTINGS = {
    /** Null means checkout doesn't ask for a shipping address. */
    shipping: exports.ShippingSettings.nullable(),
    /** Null means checkout doesn't ask for a phone number. */
    phone: exports.PhoneSettings.nullable(),
};
/** The site-wide Stripe Checkout config. */
exports.StripeCheckoutConfig = zod_1.z.object({
    /** Null means Stripe uses the design set in the Stripe dashboard. */
    design: exports.StripeCheckoutDesign.nullable(),
    ...COLLECTED_SETTINGS,
});
/**
 * The name in the model of each part of the config that asks the buyer for something, by the
 * name the Admin API and the shared `COLLECTED_PARTS` give it.
 */
exports.SECTION_OF = {
    shipping: 'shipping',
    phone: 'phone',
};
/**
 * The parts of the config that ask the buyer for something, each on every paid tier or only
 * the ones it names.
 */
exports.COLLECTED_SECTIONS = checkout_2.COLLECTED_PARTS.map((part) => exports.SECTION_OF[part]);
/**
 * Each collected part's name in the Admin API, which is also the name of the tier requirement it
 * keeps its tiers as.
 */
exports.SECTION_NAMES = {
    shipping: 'shipping',
    phone: 'phone',
};
/** What each collected part asks the buyer for, as messages about it name it. */
exports.COLLECTED_NOUNS = {
    shipping: 'shipping address',
    phone: 'phone number',
};
/**
 * The private flag the collected parts are behind. Staff only see and save the collected parts
 * while it's on, checkouts and the completed-checkout webhook only act on them while it's on,
 * and tiers only list what their members must give while it's on.
 */
exports.COLLECTION_FLAG = 'stripeCheckoutCollection';
/**
 * How Stripe Checkout looks without a design from Ghost, as set in the Stripe dashboard. The
 * business name shows with a design from Ghost too, as Ghost never sends one.
 */
exports.StripeCheckoutBranding = zod_1.z.object({
    displayName: zod_1.z.string(),
    /** Null when Stripe reports a design Ghost can't show, such as a font it doesn't know. */
    design: exports.StripeCheckoutDesign.nullable(),
});
