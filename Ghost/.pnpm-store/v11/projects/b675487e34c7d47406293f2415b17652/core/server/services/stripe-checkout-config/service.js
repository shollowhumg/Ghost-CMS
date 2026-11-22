"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeCheckoutConfigService = void 0;
const node_util_1 = require("node:util");
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const zod_1 = require("zod");
const checkout_1 = require("@tryghost/checkout");
const identity_1 = require("@tryghost/metafield-types/identity");
const date_1 = require("../../lib/db-types/date");
const codec_1 = require("./codec");
const models_1 = require("./models");
const schema_1 = require("./schema");
const parse_request_1 = require("../../lib/parse-request");
const serializers_1 = require("./serializers");
const ensure_transaction_1 = require("../../lib/ensure-transaction");
// A `custom_field_key` is a key in the publisher's `custom` namespace, so the config reads and
// checks only the bindings and fields there.
const BINDINGS_TABLE = 'members_metafield_bindings';
/** A custom field that can take a value: not archived. */
const ACTIVE = 'active';
/**
 * Where each collected part's answers are saved: for each port they come back through, the
 * custom field its settings name.
 */
const PARTS = {
    shipping: {
        destinations: {
            address: {
                port: checkout_1.CHECKOUT_PORT.shippingAddress,
                customFieldKey: (shipping) => shipping.addressCustomFieldKey,
                property: 'shipping.address.custom_field_key',
                wrongType: 'Choose an address custom field for the shipping address.',
                holds: 'the shipping address',
            },
            recipient: {
                port: checkout_1.CHECKOUT_PORT.shippingName,
                customFieldKey: (shipping) => shipping.nameCustomFieldKey,
                property: 'shipping.name.custom_field_key',
                wrongType: "Choose a short text custom field for the recipient's name.",
                holds: "the recipient's name",
            },
        },
    },
    phone: {
        destinations: {
            number: {
                port: checkout_1.CHECKOUT_PORT.phone,
                customFieldKey: (phone) => phone.customFieldKey,
                property: 'phone.custom_field_key',
                wrongType: 'Choose a phone custom field for the phone number.',
                holds: 'the phone number',
            },
        },
    },
};
/** Where each of a part's answers is saved, whatever role it plays. */
function destinationsOf(section) {
    return Object.values(PARTS[section].destinations);
}
/** The ports the collected parts bind to custom fields, each with what its field holds. */
const PORT_HOLDS = new Map(models_1.COLLECTED_SECTIONS.flatMap((section) => destinationsOf(section).map(({ port, holds }) => [port, holds])));
const COLLECTED_PORTS = [...PORT_HOLDS.keys()];
/**
 * The tier requirement a part is set to, from the settings a request saves: the tiers it's asked
 * on, and its own settings, such as the countries shipping is limited to. Distributed over each
 * part, so the requirement of any part reads as a `SetRequirement`.
 */
const SET_AS = {
    shipping: ({ tierIds, allowedCountries }) => ({
        name: models_1.SECTION_NAMES.shipping,
        tierIds,
        ...(allowedCountries ? { countries: allowedCountries } : {}),
    }),
    phone: ({ tierIds }) => ({ name: models_1.SECTION_NAMES.phone, tierIds }),
};
/** What saving the parts in a request settles, for the parts it includes. */
function changesOf(requested) {
    return models_1.COLLECTED_SECTIONS.flatMap((section) => {
        const settings = requested[section];
        return settings === undefined ? [] : [changeOf(section, settings)];
    });
}
function changeOf(section, settings) {
    return {
        section,
        targets: settings && {
            requirement: SET_AS[section](settings),
            destinations: destinationsOf(section).map(({ port, customFieldKey, property, wrongType, holds }) => ({
                port,
                customFieldKey: customFieldKey(settings),
                property,
                wrongType,
                holds,
            })),
        },
    };
}
/**
 * One row of the config read: the row's parts, and one port the collected parts bind with its
 * field (or nulls). A config binding several ports comes back as a row for each port.
 */
const ReadRow = schema_1.DbConfigParts.extend({
    port: zod_1.z.enum(checkout_1.CHECKOUT_PORTS).nullable(),
    bound_key: zod_1.z.nullable(identity_1.KeySchema),
});
/** The custom field each port is bound to, as the read found them. */
function boundFields(rows) {
    const bound = new Map();
    for (const row of rows) {
        if (row.port && row.bound_key) {
            bound.set(row.port, row.bound_key);
        }
    }
    return bound;
}
const LockedTier = zod_1.z.object({ id: zod_1.z.string(), type: zod_1.z.string() });
const LockedField = zod_1.z.object({ key: identity_1.KeySchema, type: zod_1.z.string(), status: zod_1.z.string() });
const LockedBinding = zod_1.z.object({ port: zod_1.z.enum(checkout_1.CHECKOUT_PORTS), metafield_key: identity_1.KeySchema });
/** Reads and saves the site-wide Stripe Checkout config. */
class StripeCheckoutConfigService {
    knex;
    recordAction;
    bindings;
    fields;
    requirements;
    configRow;
    constructor({ knex, recordAction, bindings, fields, requirements, logging, }) {
        this.knex = knex;
        this.recordAction = recordAction;
        this.bindings = bindings;
        this.fields = fields;
        this.requirements = requirements;
        this.configRow = (0, codec_1.configRow)(logging);
    }
    /**
     * Reads the config, without caching it: the row, the custom fields its ports are bound to, and
     * the tier requirements the collected parts are required under.
     *
     * A collected part is on while tiers list its requirement. Any of its fields being deleted
     * takes its binding with it, which reads as off.
     *
     * Read in one transaction, as the requirements are a second query, so a save committing in
     * between can't pair one save's bindings with another's requirements. Given a transaction as
     * `executor` it reads inside that transaction; given a plain connection it opens its own.
     */
    async read(executor = this.knex) {
        return (0, ensure_transaction_1.ensureTransaction)(executor, (trx) => this.readSaved(trx));
    }
    /**
     * Reads the config as checkouts use it: the design, and for each collected part the tiers it
     * asks on and how.
     *
     * Parts given unsaved take the place of the saved ones, refused as saving them would be, so a
     * preview asks for each part exactly as checkouts would once it was saved. Nothing is written.
     * Given a transaction as `executor` it reads inside that transaction; given a plain connection
     * it opens its own.
     */
    async readForCheckout(unsaved = {}, executor = this.knex) {
        const changes = changesOf(unsaved);
        // Checked in the same transaction as the read, so both see the same tiers and fields.
        const saved = await (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            if (changes.length) {
                await assertTargets(trx, changes, this.fields);
            }
            return this.readSaved(trx);
        });
        const config = { ...saved, ...unsaved };
        return {
            design: config.design,
            shipping: config.shipping && {
                tierIds: config.shipping.tierIds,
                allowedCountries: config.shipping.allowedCountries,
            },
            phone: config.phone && { tierIds: config.phone.tierIds },
        };
    }
    /**
     * The config as saved, with the paid tiers each part is required on, and the custom field each
     * port is bound to.
     */
    async readSaved(db) {
        const rows = zod_1.z.array(ReadRow).parse(await db(`${schema_1.CONFIG_TABLE} as config`)
            // Every port in one join, so the rows grow with the ports rather than with a join per
            // port multiplied together.
            .leftJoin(`${BINDINGS_TABLE} as binding`, (join) => join
            .onIn('binding.port', COLLECTED_PORTS)
            .andOnVal('binding.metafield_namespace', '=', identity_1.CUSTOM_NAMESPACE))
            .where('config.slug', schema_1.CONFIG_SLUG)
            .select(...schema_1.DbConfigParts.keyof().options.map((column) => `config.${column}`), 'binding.port', 'binding.metafield_key as bound_key'));
        const [first] = rows;
        const bound = boundFields(rows);
        if (!first) {
            return { design: null, shipping: null, phone: null };
        }
        // A part is on only while tiers list its requirement, so checkouts never ask for more than
        // tiers say their members must give.
        const listed = await this.requirements().browse(db);
        const { design } = zod_1.z.decode(this.configRow, first);
        return {
            design,
            shipping: shippingFrom(bound, listed.find((requirement) => requirement.name === models_1.SECTION_NAMES.shipping)),
            phone: phoneFrom(bound, listed.find((requirement) => requirement.name === models_1.SECTION_NAMES.phone)?.tierIds),
        };
    }
    /**
     * Saves the parts of the config that the request includes, and records the save in the staff
     * history.
     *
     * The tiers and fields the collected parts name are checked inside the same transaction as
     * the write, with their rows locked, so nothing can change between the check and the write.
     *
     * Says whether it changed what tiers list to anyone: a requirement, whether each of its ports is
     * bound, or the field a port names.
     *
     * Given a transaction as `executor` it joins that transaction; given a plain connection it
     * opens its own.
     */
    async edit(context, input, executor = this.knex) {
        const { design, ...requested } = (0, parse_request_1.parseRequest)(serializers_1.CheckoutConfigInput, input, 'checkout_config');
        // Only the parts in the request are written, so saving one part never overwrites another.
        const changes = changesOf(requested);
        const columns = zod_1.z.encode(this.configRow.partial(), design === undefined ? {} : { design });
        const at = new Date();
        const now = (0, date_1.toDatabaseDate)(at);
        return (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            await assertTargets(trx, changes, this.fields);
            const before = await this.requirements().browse(trx);
            await trx(schema_1.CONFIG_TABLE)
                .insert({
                id: new bson_objectid_1.default().toHexString(),
                slug: schema_1.CONFIG_SLUG,
                created_at: now,
                updated_at: now,
                ...columns,
            })
                .onConflict('slug')
                .merge({ ...columns, updated_at: now });
            for (const change of changes) {
                await this.writeTargets(trx, change, at);
            }
            // An existing row keeps its id, so read the id back for the history entry.
            const saved = await trx(schema_1.CONFIG_TABLE).where('slug', schema_1.CONFIG_SLUG).first('id');
            if (!saved) {
                throw new errors_1.default.InternalServerError({
                    message: 'The Stripe Checkout config was not found right after saving it.',
                });
            }
            await this.recordAction(trx, { context, subject: saved.id });
            return {
                changedRequirements: !(0, node_util_1.isDeepStrictEqual)(before, await this.requirements().browse(trx)),
            };
        });
    }
    /**
     * Settles which tiers a collected part is limited to and which fields it lands in, as the tier
     * requirement it's required under and the bindings of that requirement's ports. Switched off,
     * it keeps neither, so turning it back on doesn't inherit old tiers or fields.
     */
    async writeTargets(trx, { section, targets }, now) {
        if (targets) {
            await this.requirements().require(targets.requirement, now, trx);
            for (const { port, customFieldKey } of targets.destinations) {
                await this.bindings.bind(port, { namespace: identity_1.CUSTOM_NAMESPACE, key: customFieldKey }, now, trx);
            }
        }
        else {
            await this.requirements().release(models_1.SECTION_NAMES[section], trx);
            for (const { port } of destinationsOf(section)) {
                await this.bindings.remove(port, trx);
            }
        }
    }
}
exports.StripeCheckoutConfigService = StripeCheckoutConfigService;
/**
 * Shipping as the read found it: on while tiers list its requirement, asked on the tiers and in
 * the countries the requirement covers.
 */
function shippingFrom(bound, listed) {
    const address = bound.get(checkout_1.CHECKOUT_PORT.shippingAddress);
    const name = bound.get(checkout_1.CHECKOUT_PORT.shippingName);
    if (!address || !name || !listed) {
        return null;
    }
    return {
        tierIds: listed.tierIds,
        allowedCountries: listed.countries ? [...listed.countries] : null,
        addressCustomFieldKey: address,
        nameCustomFieldKey: name,
    };
}
/**
 * The phone number settings as the read found them: on while tiers list its requirement, asked on
 * the tiers the requirement covers.
 */
function phoneFrom(bound, tierIds) {
    const field = bound.get(checkout_1.CHECKOUT_PORT.phone);
    if (!field || tierIds === undefined) {
        return null;
    }
    return { tierIds, customFieldKey: field };
}
/**
 * Refuses tiers and custom fields the collected parts can't use, checking every part in one
 * pass. The tiers, the fields and the current bindings are locked until the write commits.
 *
 * A part names paid tiers or none. A free tier has no checkout, so naming one would be a
 * setting that looks saved and does nothing. An archived paid tier is accepted, so it keeps its
 * place for when it is restored.
 *
 * A custom field has to exist, be active unless it is the one already chosen, and be the type
 * its port supplies. A publisher who named a field meant that field, so being told now beats
 * finding out later that nothing was saved. Each port needs a field of its own, as two ports
 * writing one field would overwrite each other on every checkout.
 */
async function assertTargets(trx, changes, fieldReads) {
    const switchedOn = changes.flatMap(({ section, targets }) => targets ? [{ section, ...targets }] : []);
    if (!switchedOn.length) {
        return;
    }
    const tierIds = [...new Set(switchedOn.flatMap((part) => part.requirement.tierIds ?? []))];
    const tiers = tierIds.length
        ? zod_1.z
            .array(LockedTier)
            .parse(await trx('products').whereIn('id', tierIds).select('id', 'type').forShare())
        : [];
    const typeOfTier = new Map(tiers.map((tier) => [tier.id, tier.type]));
    for (const { section, requirement } of switchedOn) {
        const unusable = requirement.tierIds?.find((id) => typeOfTier.get(id) !== 'paid');
        if (unusable) {
            throw new errors_1.default.ValidationError({
                message: typeOfTier.has(unusable)
                    ? `Only paid tiers have a checkout to collect a ${models_1.COLLECTED_NOUNS[section]} at.`
                    : `Unknown tier: ${unusable}`,
                property: `${models_1.SECTION_NAMES[section]}.tier_ids`,
            });
        }
    }
    const destinations = switchedOn.flatMap((part) => part.destinations);
    const fields = zod_1.z.array(LockedField).parse(await fieldReads
        .locked(trx, identity_1.CUSTOM_NAMESPACE, destinations.map((destination) => destination.customFieldKey))
        .select('key', 'type', 'status'));
    const bindings = zod_1.z
        .array(LockedBinding)
        .parse(await trx(BINDINGS_TABLE)
        .whereIn('port', COLLECTED_PORTS)
        .where('metafield_namespace', identity_1.CUSTOM_NAMESPACE)
        .select('port', 'metafield_key')
        .forUpdate());
    const chosen = new Map(bindings.map((binding) => [binding.port, binding.metafield_key]));
    for (const { port, customFieldKey, property, wrongType } of destinations) {
        const field = fields.find((candidate) => candidate.key === customFieldKey);
        if (!field) {
            throw new errors_1.default.ValidationError({
                message: 'Choose a custom field the site already has.',
                property,
            });
        }
        // Keeping a field that was archived after it was chosen is allowed, so a client can save
        // back what it read. Nothing is written to it while it stays archived.
        if (field.status !== ACTIVE && chosen.get(port) !== customFieldKey) {
            throw new errors_1.default.ValidationError({
                message: 'An archived custom field cannot receive collected data. Restore it first.',
                property,
            });
        }
        if (field.type !== checkout_1.PORT_FIELD[port].type) {
            throw new errors_1.default.ValidationError({ message: wrongType, property });
        }
    }
    // Only once every field could take its value, so a field of the wrong type says so first.
    // The fields the parts left out of the request keep saving into count too.
    const replaced = new Set(changes.flatMap(({ section }) => destinationsOf(section).map(({ port }) => port)));
    const saving = [
        ...bindings
            .filter(({ port }) => !replaced.has(port))
            .map(({ port, metafield_key: customFieldKey }) => ({ port, customFieldKey })),
        ...destinations,
    ];
    for (const { port, customFieldKey, property } of destinations) {
        const sharing = saving.find((other) => other.port !== port && other.customFieldKey === customFieldKey);
        if (sharing) {
            throw new errors_1.default.ValidationError({
                message: `That custom field already holds ${PORT_HOLDS.get(sharing.port)}. Choose another.`,
                property,
            });
        }
    }
}
