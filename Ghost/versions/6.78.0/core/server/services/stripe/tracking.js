"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeTracking = stripeTracking;
const checkout_1 = require("@tryghost/checkout");
const models_1 = require("../stripe-checkout-config/models");
const checkout_session_params_1 = require("./checkout-session-params");
function buyerOf({ existing, verified }) {
    if (!existing) {
        return 'new';
    }
    return verified ? 'signed_in' : 'unverified';
}
/** A collected part's name on a span, the same name the `stripe_checkout.session` span gives it. */
const collectedPartName = (part) => (0, checkout_session_params_1.partName)(models_1.SECTION_OF[part]);
/**
 * What became of a part's answers, from the ports Ghost had answers for, the ports with a field to
 * go to, and what those fields refused.
 */
function collectedOutcome(ports, { kept, refused }) {
    const refusedFor = (port) => refused.some(({ property }) => property === port || property.startsWith(`${port}.`));
    if (ports.some(refusedFor)) {
        return 'refused';
    }
    const saved = ports.filter((port) => kept.has(port)).length;
    if (saved === ports.length) {
        return 'saved';
    }
    return saved === 0 ? 'no_destination' : 'partly_saved';
}
function stripeTracking({ tracer, meter }) {
    const collectedPhones = meter.createCounter('stripe_checkout.collected_phones');
    return {
        /**
         * Records one `stripe_checkout.start` span for each request a buyer makes to start a
         * checkout. The span runs from the checkout endpoint starting on the request to the endpoint
         * answering with the Checkout link, so the span sees every failure that stops a checkout,
         * including those that happen before Ghost asks Stripe for a session, which the
         * `stripe_checkout.session` span never sees. The endpoint starts once the request's JSON body
         * has been parsed and the rate limits checked, so a request turned away before then, such as
         * one whose body isn't JSON, isn't a checkout and records no span.
         *
         * When Ghost refuses the request, the span fails with the refusal's error type, such as
         * `BadRequestError` for a tier that doesn't exist, so the dashboard can count refusals
         * separately from failures. The `type` attribute holds the kind of checkout. A request for a
         * kind Ghost doesn't offer is refused before `type` is set, so its span has no `type`. The
         * `member` attribute says who the buyer is to the site (see `Buyer`), so subscription
         * checkouts started can be set against those completed, for each kind of buyer.
         */
        checkout(start) {
            return tracer.track('stripe_checkout.start', (span) => start({
                starting: (type) => span.setAttribute('type', type),
                buying: (buyer) => span.setAttribute('member', buyerOf(buyer)),
            }));
        },
        /**
         * Records one `stripe_checkout.complete` span for each checkout event Stripe sends Ghost, from
         * the webhook starting on the event to Ghost having done everything a completed checkout asks
         * of it, such as making the buyer a paid member. The span fails when that fails, which fails
         * the webhook, so Stripe sends the event again later.
         *
         * The `type` attribute holds the kind of checkout once Ghost completes it. An event that
         * completes nothing has no `type`, such as a failed asynchronous payment, or a gift whose
         * payment hasn't arrived yet, which gets a span with `type` when it does. So completed
         * checkouts are the spans with a `type`. The `member` attribute says who the buyer is to the
         * site (see `Buyer`), for a subscription.
         *
         * Each collected part has an attribute saying what became of what the checkout asked for (see
         * `CollectedPartOutcome`). Saving what a checkout collected never fails the span: the money is
         * already taken, so a failed save is recorded on the part rather than sending the event again.
         * A completion that fails before Ghost reads what the checkout collected leaves every part
         * `none`.
         */
        checkoutCompletion(complete) {
            return tracer.track('stripe_checkout.complete', (span) => {
                const record = (part, outcome) => span.setAttribute(collectedPartName(part), outcome);
                for (const part of checkout_1.COLLECTED_PARTS) {
                    record(part, 'none');
                }
                // The ports each part had answers for, once the checkout says what it collected.
                let asked = [];
                return complete({
                    completing: (type) => span.setAttribute('type', type),
                    buying: (buyer) => span.setAttribute('member', buyerOf(buyer)),
                    collecting(answers) {
                        asked = checkout_1.COLLECTED_PARTS.map((part) => [
                            part,
                            (0, checkout_1.portsOf)(part).filter((port) => answers.some((answer) => answer.port === port)),
                        ]).filter(([, ports]) => ports.length > 0);
                    },
                    skipping() {
                        asked.forEach(([part]) => record(part, 'skipped'));
                    },
                    saving(plan) {
                        asked.forEach(([part, ports]) => record(part, collectedOutcome(ports, plan)));
                    },
                    failing() {
                        asked.forEach(([part]) => record(part, 'failed'));
                    },
                });
            });
        },
        /**
         * Records one `stripe.webhook` span for each event Stripe sends to Ghost's webhook, from the
         * webhook starting on the request to Ghost answering Stripe. The span fails when Ghost answers
         * with a failure, which makes Stripe send the event again later, including when the event's
         * signature doesn't show it came from Stripe, as an `UnauthorizedError`. A request with no
         * body or no signature at all isn't from Stripe, so it records no span.
         *
         * The `type` attribute holds the event's type, such as `checkout.session.completed`, and
         * `ignored` is true for an event Ghost is set to ignore.
         */
        webhook(handle) {
            return tracer.track('stripe.webhook', (span) => handle({
                receiving: (type) => span.setAttribute('type', type),
                ignoring: () => span.setAttribute('ignored', true),
            }));
        },
        /**
         * Records one `stripe_checkout.session` span for each Checkout session Ghost asks Stripe to
         * create for a buyer, with one attribute per part of the checkout saying what happened to
         * that part (see `PartOutcome`).
         *
         * When Stripe fails the session, the span's attributes describe the last request Ghost sent,
         * which is the one that failed. A part that is still `applied` was in that request, so
         * Stripe failed the request for a reason other than refusing that part. When no part is
         * `applied`, the failed request carried none of the publisher's checkout settings, so those
         * settings weren't the reason it failed.
         */
        checkoutSession(parts, create) {
            return tracer.track('stripe_checkout.session', (span) => {
                const record = (part, outcome) => span.setAttribute((0, checkout_session_params_1.partName)(part), outcome);
                for (const part of checkout_session_params_1.CHECKOUT_PARTS) {
                    record(part, parts[part] ? 'applied' : 'none');
                }
                return create({
                    refused(refusal) {
                        if (refusal.named) {
                            record(refusal.part, 'refused');
                        }
                        else {
                            refusal.parts.forEach((part) => record(part, 'dropped'));
                        }
                    },
                });
            });
        },
        /**
         * Counts one `stripe_checkout.collected_phones` for each phone number a completed checkout
         * collects and Ghost goes to save. `wallet` says how often buyers pay with Apple Pay or Google
         * Pay, which pass a number on as the wallet keeps it rather than in E.164. `phone_form`,
         * `phone_country` and `phone_outcome` say how often such a number needs a country to be read,
         * whether the checkout knew one, and whether its field kept it. The number itself is never
         * recorded, as it is the buyer's.
         */
        collectedPhone({ wallet, phone, outcome, }) {
            collectedPhones.add(1, {
                wallet,
                phone_form: phone.form,
                phone_country: phone.country,
                phone_outcome: outcome,
            });
        },
    };
}
