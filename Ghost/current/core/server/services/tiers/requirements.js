"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TierRequirements = void 0;
const zod_1 = require("zod");
const checkout_1 = require("@tryghost/checkout");
const date_1 = require("../../lib/db-types/date");
const json_1 = require("../../lib/db-types/json");
const ensure_transaction_1 = require("../../lib/ensure-transaction");
const REQUIREMENTS_TABLE = 'tier_requirements';
const REQUIREMENT_TIERS_TABLE = 'tier_requirement_tiers';
/**
 * Whether a requirement covers every paid tier, including tiers added later, or only the tiers
 * it names. Stored as a choice rather than read off an empty list, so a requirement limited to
 * some tiers never quietly widens to all of them.
 */
const TierScope = zod_1.z.enum(['all_paid', 'selected_paid']);
/** How these tiers are stored: every paid tier for null, or only the tiers named. */
function tierScopeOf(tierIds) {
    return tierIds ? 'selected_paid' : 'all_paid';
}
/**
 * The countries shipping is limited to, as stored. An empty list, or a country Stripe no longer
 * ships to, would leave nowhere a member could give, so either reads as unreadable.
 */
const DbCountries = (0, json_1.DbJson)(zod_1.z.array(zod_1.z.string().refine((code) => (0, checkout_1.isStripeAllowedCountry)(code))).min(1), {
    message: 'The stored countries are not JSON.',
});
/**
 * One row of the requirements read: a requirement, and one tier it names again only if that tier
 * is paid (or null). A requirement naming several tiers comes back as a row for each. Its name,
 * scope and countries are read as stored, and checked against what this version knows as they're
 * used.
 */
const ReadRow = zod_1.z.object({
    requirement: zod_1.z.string(),
    tier_scope: zod_1.z.string(),
    countries: zod_1.z.string().nullable(),
    paid_tier_id: zod_1.z.string().nullable(),
});
/**
 * What each tier's members must give, such as a shipping address: on every paid tier, including
 * tiers added later, or only on the paid tiers named for it. Whatever collects it asks for it on
 * those tiers, and where each answer is kept is the binding of the port it's collected under.
 */
class TierRequirements {
    knex;
    boundPorts;
    logging;
    constructor({ knex, boundPorts, logging, }) {
        this.knex = knex;
        this.boundPorts = boundPorts;
        this.logging = logging;
    }
    /**
     * What each of these tiers' members must give, by tier, as checkouts would ask for it: a
     * requirement is left out while one of its ports is bound to no custom field. Given a
     * transaction as `executor` it reads inside that transaction.
     */
    async forTiers(tiers, executor = this.knex) {
        // Only paid tiers have requirements, so nothing is read for the others.
        const listed = tiers.some(({ type }) => type === 'paid') ? await this.browse(executor) : [];
        return new Map(tiers.map((tier) => [
            tier.id,
            tier.type === 'paid'
                ? listed
                    .filter(({ tierIds }) => tierIds === null || tierIds.includes(tier.id))
                    .map(({ tierIds: _tierIds, ...requirement }) => requirement)
                : [],
        ]));
    }
    /**
     * Every requirement as tiers list it, with the paid tiers it covers: one is left out while one
     * of its ports is bound to no custom field. A port whose field is archived still counts, as
     * checkouts still ask for it and drop the answer.
     *
     * Read in one transaction, as the bindings are a second query, so a save committing in between
     * can't pair one save's requirements with another's bindings. Given a transaction as `executor`
     * it reads inside that transaction; given a plain connection it opens its own.
     */
    async browse(executor = this.knex) {
        return (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            const required = await this.readRequired(trx);
            const bound = await this.boundPorts(required.flatMap(({ name }) => (0, checkout_1.portsOf)(name)), trx);
            return required.flatMap((requirement) => (0, checkout_1.portsOf)(requirement.name).every((port) => bound.has(port))
                ? [listedAs(requirement, bound)]
                : []);
        });
    }
    /**
     * Sets a requirement to cover these paid tiers, or every paid tier for null, with its own
     * settings, in place of whatever it was set to before. Given a transaction as `executor` it
     * joins that transaction; given a plain connection it opens its own.
     */
    async require(requirement, now, executor = this.knex) {
        const { name, tierIds } = requirement;
        const tierScope = tierScopeOf(tierIds);
        const countries = storedCountries(requirement);
        const at = (0, date_1.toDatabaseDate)(now);
        await (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            await trx(REQUIREMENTS_TABLE)
                .insert({
                requirement: name,
                tier_scope: tierScope,
                countries,
                created_at: at,
                updated_at: at,
            })
                .onConflict('requirement')
                .merge({ tier_scope: tierScope, countries, updated_at: at });
            await trx(REQUIREMENT_TIERS_TABLE).where('requirement', name).del();
            if (tierIds?.length) {
                await trx(REQUIREMENT_TIERS_TABLE).insert(tierIds.map((productId) => ({ requirement: name, product_id: productId })));
            }
        });
    }
    /**
     * Stops requiring this on any tier. Given a transaction as `executor` it joins that
     * transaction; given a plain connection it opens its own.
     */
    async release(requirement, executor = this.knex) {
        await (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            await trx(REQUIREMENT_TIERS_TABLE).where('requirement', requirement).del();
            await trx(REQUIREMENTS_TABLE).where('requirement', requirement).del();
        });
    }
    /**
     * Every requirement as it's set, leaving out what nothing requires. A requirement only counts
     * the named tiers that are paid, and once every tier it named has been deleted it requires
     * nothing, rather than widening to every paid tier.
     */
    async readRequired(db) {
        const query = db(`${REQUIREMENTS_TABLE} as required`)
            .leftJoin(`${REQUIREMENT_TIERS_TABLE} as named`, 'named.requirement', 'required.requirement')
            .leftJoin('products as tier', (join) => join.on('tier.id', '=', 'named.product_id').andOnVal('tier.type', '=', 'paid'))
            .orderBy(['required.requirement', 'tier.id'])
            .select('required.requirement', 'required.tier_scope', 'required.countries', 'tier.id as paid_tier_id');
        const rows = zod_1.z.array(ReadRow).parse(await query);
        // A requirement comes back as a row for each tier it names, each with its scope and settings.
        const stored = new Map();
        for (const row of rows) {
            // A requirement no longer offered requires nothing.
            if (!(0, checkout_1.isRequirementName)(row.requirement)) {
                continue;
            }
            const entry = stored.get(row.requirement) ?? { row, paidTierIds: [] };
            if (row.paid_tier_id) {
                entry.paidTierIds.push(row.paid_tier_id);
            }
            stored.set(row.requirement, entry);
        }
        return [...stored].flatMap(([name, { row, paidTierIds }]) => {
            // Nor does a scope this version doesn't know, such as one a later version stored, or
            // settings that can't be read, so the other requirements and settings still read, and the
            // requirement never widens to everywhere.
            const tierScope = TierScope.safeParse(row.tier_scope);
            const tierIds = tierScope.data === 'all_paid' ? null : [...new Set(paidTierIds)];
            const requirement = tierScope.success ? setAs(name, tierIds, row.countries) : null;
            if (!requirement) {
                this.logging.warn({
                    event: { name: 'tiers.requirement_unreadable' },
                    requirement: name,
                    tier_scope: row.tier_scope,
                    countries: row.countries,
                }, 'Ignoring a tier requirement that could not be read');
                return [];
            }
            return tierIds?.length === 0 ? [] : [requirement];
        });
    }
}
exports.TierRequirements = TierRequirements;
/**
 * A requirement as stored, with these tiers, or null when its countries can't be read: shipping
 * keeps its countries in the countries column, or nothing there for anywhere, and a requirement
 * with no countries of its own keeps nothing there.
 */
function setAs(name, tierIds, countries) {
    switch (name) {
        case 'shipping': {
            if (countries === null) {
                return { name, tierIds };
            }
            const read = DbCountries.safeParse(countries);
            return read.success ? { name, tierIds, countries: read.data } : null;
        }
        case 'phone':
            return countries === null ? { name, tierIds } : null;
    }
}
/** What a requirement keeps in the countries column: shipping's countries, or nothing. */
function storedCountries(requirement) {
    switch (requirement.name) {
        case 'shipping':
            return requirement.countries ? zod_1.z.encode(DbCountries, [...requirement.countries]) : null;
        case 'phone':
            return null;
    }
}
/** A requirement as tiers list it, each of its roles' port with the field it names, if any. */
function listedAs(requirement, bound) {
    const listed = (port) => {
        const field = bound.get(port);
        return field ? { port, field } : { port };
    };
    switch (requirement.name) {
        case 'shipping': {
            const { name, tierIds, countries } = requirement;
            const { recipient, address } = checkout_1.REQUIREMENTS.shipping;
            return {
                name,
                ports: { recipient: listed(recipient), address: listed(address) },
                tierIds,
                ...(countries ? { countries } : {}),
            };
        }
        case 'phone': {
            const { name, tierIds } = requirement;
            return { name, ports: { number: listed(checkout_1.REQUIREMENTS.phone.number) }, tierIds };
        }
    }
}
