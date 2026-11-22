"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectedFrom = void 0;
const zod_1 = require("zod");
const checkout_1 = require("@tryghost/checkout");
const metafield_types_1 = require("@tryghost/metafield-types");
const Collected = zod_1.z
    .string()
    .nullish()
    .transform((given) => (given && given.trim() !== '' ? given : undefined));
const ShippingDetails = zod_1.z
    .object({
    name: Collected,
    address: zod_1.z.record(zod_1.z.string(), Collected).nullish(),
})
    .nullish()
    .catch(null);
/**
 * What a completed session asked for and what came back.
 *
 * Where the shipping details are depends on the API version the event was rendered at:
 * `shipping` at Ghost's pinned version, `shipping_details` from 2022-08-01, and
 * `collected_information.shipping_details` from 2025-03-31. Webhooks Ghost registers use the
 * pinned version, while a local `stripe listen` forwards events at the account's own version,
 * so all three are read.
 *
 * Each part is read on its own: one in a shape Ghost doesn't expect reads as missing, rather
 * than costing the answers the others carry.
 */
const CompletedSession = zod_1.z
    .object({
    shipping_address_collection: zod_1.z.object({}).loose().nullish().catch(null),
    phone_number_collection: zod_1.z.object({ enabled: zod_1.z.boolean() }).nullish().catch(null),
    shipping: ShippingDetails,
    shipping_details: ShippingDetails,
    collected_information: zod_1.z.object({ shipping_details: ShippingDetails }).nullish().catch(null),
    customer_details: zod_1.z
        .object({
        phone: Collected,
        address: zod_1.z.object({ country: Collected }).nullish().catch(null),
    })
        .nullish()
        .catch(null),
})
    .loose();
const ADDRESS_PARTS = (0, metafield_types_1.keysOf)(metafield_types_1.FIELD_STRUCTURES.address.parts);
/**
 * The address as an answer for an address custom field, or nothing when Stripe gave no part of
 * one. Only the parts Stripe gave are named: an answer replaces whatever the field held, so the
 * bindings clear the rest.
 */
function addressValue(address) {
    const given = address ?? {};
    const value = {};
    for (const part of ADDRESS_PARTS) {
        const text = given[part];
        if (text !== undefined) {
            value[part] = text;
        }
    }
    return Object.keys(value).length > 0 ? value : undefined;
}
/** The shipping details, if the checkout asked for an address. */
function shippingAsked(session) {
    return session.shipping_address_collection
        ? (session.shipping ??
            session.shipping_details ??
            session.collected_information?.shipping_details)
        : undefined;
}
/** The country the buyer is in, and where it came from: their card's, or else where it ships. */
function buyerCountry(session) {
    const billing = session.customer_details?.address?.country;
    if (billing) {
        return { country: billing, from: 'billing' };
    }
    const shipping = shippingAsked(session)?.address?.country;
    return shipping ? { country: shipping, from: 'shipping' } : { country: undefined, from: 'none' };
}
/** The phone number as Stripe gave it, if the checkout asked for one. */
function phoneGiven(session) {
    return session.phone_number_collection?.enabled ? session.customer_details?.phone : undefined;
}
/**
 * The phone number, if the checkout asked for one. Stripe gives a number typed into Checkout in
 * E.164, but Apple Pay and Google Pay pass one on as the wallet keeps it, which can be without its
 * country code, so a number is read in the buyer's country, as Stripe's own phone input starts
 * from it. One that doesn't read as a number there goes as given, for the phone field to refuse.
 */
function phoneAsked(session) {
    const phone = phoneGiven(session);
    return phone && ((0, metafield_types_1.phoneNumberIn)(phone, buyerCountry(session).country) ?? phone);
}
/** How the phone number came back, or undefined when the checkout didn't ask for one. */
function phoneCollected(session) {
    const phone = phoneGiven(session);
    if (!phone) {
        return undefined;
    }
    const { country, from } = buyerCountry(session);
    const form = /^\+[1-9]\d{1,14}$/.test(phone)
        ? 'e164'
        : (0, metafield_types_1.phoneNumberIn)(phone, undefined)
            ? 'international'
            : (0, metafield_types_1.phoneNumberIn)(phone, country)
                ? 'national'
                : 'unreadable';
    return { form, country: from };
}
/**
 * What a completed checkout gave back for each port, as a whole value for the field the port is
 * collected into, or nothing when it didn't ask. Stripe returns the recipient's name beside
 * the shipping address rather than as part of it, so it is saved separately.
 */
const ANSWERS = {
    [checkout_1.CHECKOUT_PORT.shippingAddress]: (session) => addressValue(shippingAsked(session)?.address),
    [checkout_1.CHECKOUT_PORT.shippingName]: (session) => shippingAsked(session)?.name,
    [checkout_1.CHECKOUT_PORT.phone]: phoneAsked,
};
/**
 * What a completed checkout asked the buyer for and got back, each under the port it is saved
 * through, and how its phone number came back. Only what the checkout asked for counts: Stripe
 * can return what it wasn't asked for, such as an address saved with Link, and that isn't the
 * publisher's to keep. What was asked is read from the checkout itself, because the config can
 * change while it is open.
 */
exports.collectedFrom = CompletedSession.transform((session) => ({
    answers: checkout_1.CHECKOUT_PORTS.map((port) => ({ port, value: ANSWERS[port](session) })).filter((entry) => entry.value !== undefined),
    phone: phoneCollected(session),
}));
