"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refusedParts = exports.isStripeRefusal = exports.partName = exports.CHECKOUT_PARTS = void 0;
exports.refusalOf = refusalOf;
exports.previewRefusal = previewRefusal;
exports.withoutParts = withoutParts;
exports.checkoutSessionParts = checkoutSessionParts;
exports.taxSessionParams = taxSessionParams;
exports.sessionCreateParams = sessionCreateParams;
const checkout_1 = require("@tryghost/checkout");
const zod_1 = require("zod");
const case_keys_1 = require("../../lib/case-keys");
const models_1 = require("../stripe-checkout-config/models");
exports.CHECKOUT_PARTS = ['design', ...models_1.COLLECTED_SECTIONS];
/**
 * The name the Admin API uses for a part, such as `shipping`. Span attributes and log lines use
 * the same name, so one name finds a part everywhere.
 */
const partName = (part) => part === 'design' ? 'design' : models_1.SECTION_NAMES[part];
exports.partName = partName;
/**
 * The error stripe-node throws when Stripe rejects a request as invalid. `param` is the parameter
 * Stripe objected to, when Stripe names one.
 */
const StripeRefusal = zod_1.z.object({
    type: zod_1.z.literal('StripeInvalidRequestError'),
    param: zod_1.z.string().nullish(),
});
/** Whether Stripe rejected a request as invalid, whatever the reason. */
const isStripeRefusal = (err) => StripeRefusal.safeParse(err).success;
exports.isStripeRefusal = isStripeRefusal;
/**
 * Whether the parameter Stripe named is `key` or a field inside it. Stripe names a field inside a
 * parameter with brackets, such as `branding_settings[font_family]`.
 */
const names = (param, key) => param === key || param.startsWith(`${key}[`);
/**
 * Works out which parts of a checkout a Stripe error was about. Returns null when the error isn't
 * about the checkout's parts: when the error isn't Stripe rejecting the request as invalid, when
 * Stripe named a parameter Ghost sets itself rather than one a part adds, or when the request
 * had no parts left to leave out.
 */
function refusalOf(err, parts) {
    const refusal = StripeRefusal.safeParse(err);
    if (!refusal.success) {
        return null;
    }
    const { param } = refusal.data;
    const [first, ...rest] = exports.CHECKOUT_PARTS.filter((part) => parts[part]);
    if (!first) {
        return null;
    }
    const present = [first, ...rest];
    if (!param) {
        return { named: false, parts: present };
    }
    const part = present.find((candidate) => Object.keys(parts[candidate] ?? {}).some((key) => names(param, key)));
    return part ? { named: true, part, param } : null;
}
/** The parts to leave out of the next request after a refusal. */
const refusedParts = (refusal) => refusal.named ? [refusal.part] : refusal.parts;
exports.refusedParts = refusedParts;
/**
 * The error an Admin preview of checkout settings shows when Stripe refuses the preview's session,
 * and the property of the preview request the error points at. Only a refusal that names a part
 * can blame the publisher's settings. Otherwise the message stays general, because Stripe also
 * refuses sessions for reasons unrelated to the settings, such as the state of the publisher's
 * Stripe account.
 */
function previewRefusal(refusal) {
    if (!refusal?.named) {
        return { message: 'Stripe refused to open this checkout.' };
    }
    const { part } = refusal;
    return {
        message: part === 'design'
            ? 'Stripe refused this checkout design.'
            : `Stripe refused to ask for a ${models_1.COLLECTED_NOUNS[part]}.`,
        property: (0, exports.partName)(part),
    };
}
function withoutParts(parts, refusal) {
    const kept = { ...parts };
    for (const part of (0, exports.refusedParts)(refusal)) {
        delete kept[part];
    }
    return kept;
}
/**
 * For each thing a checkout can ask the buyer for, the Checkout session parameters that make
 * Stripe ask for it.
 */
const STRIPE_PARAMS = {
    shipping: ({ allowedCountries }) => ({
        shipping_address_collection: {
            // Stripe has no value meaning every country, and an empty list collects no address at all,
            // so a checkout that ships everywhere (null) sends every country Stripe accepts.
            allowed_countries: allowedCountries ?? [...checkout_1.STRIPE_ALLOWED_COUNTRIES],
        },
    }),
    phone: () => ({ phone_number_collection: { enabled: true } }),
};
/**
 * The Checkout session parameters a checkout adds, keyed by the part that adds each. With no
 * checkout, nothing is added, and Stripe uses the branding set in the publisher's Stripe
 * dashboard.
 */
function checkoutSessionParts(checkout) {
    if (!checkout) {
        return {};
    }
    const parts = checkout.design
        ? { design: { branding_settings: (0, case_keys_1.snakeKeys)(checkout.design) } }
        : {};
    const ask = (section) => {
        const asking = checkout.asks[section];
        if (asking) {
            parts[section] = STRIPE_PARAMS[section](asking);
        }
    };
    models_1.COLLECTED_SECTIONS.forEach(ask);
    return parts;
}
/**
 * The tax parameters of a Checkout session that takes payment. With automatic tax on, Stripe
 * works out the tax from the buyer's address, and the session also lets a business buyer give a
 * tax ID.
 */
function taxSessionParams({ automaticTax }) {
    if (!automaticTax) {
        return { automatic_tax: { enabled: false } };
    }
    return { automatic_tax: { enabled: true }, tax_id_collection: { enabled: true } };
}
/**
 * The parameters of the Checkout session to create: the session's own parameters, the parameters
 * each remaining part of the checkout adds, and the `customer_update` those parameters need when
 * the session is for an existing Stripe customer.
 */
function sessionCreateParams(params, parts) {
    const asked = Object.values(parts).reduce((all, part) => ({ ...all, ...part }), {});
    const session = { ...asked, ...params };
    const update = customerUpdateOf(session);
    return update ? { ...session, customer_update: update } : session;
}
/**
 * What Stripe must be allowed to save onto an existing Stripe customer before Stripe will create
 * a session that works out tax or takes a tax ID. Stripe checks both against the customer's
 * address, and no customer Ghost creates has one, so Stripe must be allowed to save the address
 * the buyer enters, and also the shipping address when the session collects one. Stripe only
 * takes a tax ID when it may also save the business name the buyer gives with it. Each rule
 * follows the Stripe parameter it's about, as Stripe checks them, whatever sends that parameter.
 *
 * Returns null when the session needs no update: when it neither works out tax nor takes a tax
 * ID, or when it has no customer, because Stripe refuses `customer_update` on a session without
 * one.
 */
function customerUpdateOf(session) {
    const takesTaxId = Boolean(session.tax_id_collection?.enabled);
    if (!session.customer || !(takesTaxId || session.automatic_tax?.enabled)) {
        return null;
    }
    return {
        address: 'auto',
        ...(takesTaxId ? { name: 'auto' } : {}),
        ...(session.shipping_address_collection ? { shipping: 'auto' } : {}),
    };
}
