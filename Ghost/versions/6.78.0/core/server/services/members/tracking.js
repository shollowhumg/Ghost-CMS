"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.membersTracking = membersTracking;
const checkout_1 = require("@tryghost/checkout");
function membersTracking({ tracer }) {
    return {
        /**
         * Records one `members.tier_change` span for each change of a member's plan to a price of a
         * tier through the members API, such as a member moving to another tier in Portal, from the
         * change starting to the member's subscription being on the new price and their answers
         * saved. A change that keeps the tier, such as one of billing period, is recorded too.
         *
         * The `answers` attribute is `given` when the change carried answers to what the tier
         * requires, as Portal sends them, and `none` when it didn't, as a client that doesn't know of
         * requirements changes tier without them. When answers come with a change onto another tier
         * while checkouts collect answers, each requirement of the new tier has an attribute, named as
         * the requirement, such as `shipping`, saying what became of its answers (see
         * `RequirementOutcome`). A change without answers, one that keeps the tier, or one while
         * checkouts don't collect answers, has none. The span fails with `AnswersRefused` when the
         * change is refused for its answers, which leaves the member on their plan to correct them.
         */
        tierChange({ answered }, change) {
            return tracer.track('members.tier_change', async (span) => {
                const record = (name, outcome) => span.setAttribute(name, outcome);
                span.setAttribute('answers', answered ? 'given' : 'none');
                // The requirements whose answers are saved once the tier changes, each with whether only
                // some of them have a field to go to.
                const saving = [];
                let notSaved = false;
                const result = await change({
                    answering({ required, answers, kept }) {
                        for (const { name } of required) {
                            const given = (0, checkout_1.portsOf)(name).filter((port) => Object.hasOwn(answers, port));
                            const keptOf = given.filter((port) => kept.has(port));
                            if (given.length === 0) {
                                record(name, 'none');
                            }
                            else if (keptOf.length === 0) {
                                record(name, 'dropped');
                            }
                            else {
                                record(name, 'given');
                                saving.push({ name, partly: keptOf.length < given.length });
                            }
                        }
                    },
                    answersNotSaved() {
                        notSaved = true;
                    },
                });
                for (const { name, partly } of saving) {
                    if (notSaved) {
                        record(name, 'failed');
                    }
                    else {
                        record(name, partly ? 'partly_saved' : 'saved');
                    }
                }
                return result;
            });
        },
    };
}
