"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabaseAutomationsRepository2 = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const zod_1 = require("zod");
const emailRecipientIdRowSchema = zod_1.z.object({
    id: zod_1.z.string(),
});
const emailRecipientClickRowSchema = zod_1.z.object({
    id: zod_1.z.string(),
    clicked_at: zod_1.z.coerce.date().nullable(),
});
const nextActionRevisionRowBaseSchema = zod_1.z.object({
    automation_id: zod_1.z.string(),
    action_id: zod_1.z.string(),
    automation_action_revision_id: zod_1.z.string(),
});
const nextActionRevisionRowSchema = zod_1.z.discriminatedUnion('type', [
    nextActionRevisionRowBaseSchema.extend({
        type: zod_1.z.literal('wait'),
        wait_hours: zod_1.z.number().int().nonnegative(),
    }),
    nextActionRevisionRowBaseSchema.extend({
        type: zod_1.z.literal('send_email'),
        wait_hours: zod_1.z.null(),
    }),
]);
const selectExists = async (connection, query) => {
    const row = await connection
        .select(connection.raw('exists ? as `exists`', [query]))
        .first();
    return Boolean(Number(row?.exists));
};
const applyMembershipStartedFilters = (query, connection, { memberStatus, memberTierIds, }) => {
    query.whereExists(connection('automation_trigger_rules as rule')
        .select(1)
        .where('rule.automation_id', connection.ref('automation.id'))
        .where((builder) => {
        switch (memberStatus) {
            case 'free':
                builder.where('rule.trigger_type', 'free_signup');
                break;
            case 'paid':
                builder.where('rule.trigger_type', 'paid_subscription_started').where((paid) => {
                    paid.where('rule.scope', 'any_paid_tier');
                    if (memberTierIds.length > 0) {
                        paid.orWhere((specific) => specific
                            .where('rule.scope', 'specific_paid_tier')
                            .whereIn('rule.product_id', memberTierIds));
                    }
                });
                break;
            default: {
                const _exhaustive = memberStatus;
                throw new errors_1.default.InternalServerError({
                    message: `Unexpected member status: ${_exhaustive}`,
                });
            }
        }
    }));
};
const applyPaidSubscriptionChangedFilters = (query, connection, { memberStatus, memberTierIds, previousMemberTierIds, }) => {
    const lostTierIds = previousMemberTierIds.filter((id) => !memberTierIds.includes(id));
    if (lostTierIds.length === 0) {
        // If no tiers were lost, no paid subscription change triggers will match.
        query.whereRaw('FALSE');
        return;
    }
    const gainedTierIds = memberTierIds.filter((id) => !previousMemberTierIds.includes(id));
    // Is there a matching "from" rule?
    query.whereExists(connection('automation_trigger_rules as rule')
        .select(1)
        .where('rule.automation_id', connection.ref('automation.id'))
        .where('rule.trigger_type', 'paid_subscription_changed')
        .where('rule.direction', 'from')
        .where((from) => {
        from.whereIn('rule.product_id', lostTierIds);
        from.orWhere((anyPaid) => {
            anyPaid
                .where('rule.scope', 'any_paid_tier')
                // Don't include "from" rules if they overlap with "to" rules.
                .whereNotExists(connection('automation_trigger_rules as previous_destination')
                .select(1)
                .where('previous_destination.automation_id', connection.ref('automation.id'))
                .where('previous_destination.trigger_type', 'paid_subscription_changed')
                .where('previous_destination.direction', 'to')
                .whereIn('previous_destination.product_id', previousMemberTierIds));
        });
    }));
    // Is there a matching "to" rule?
    query.whereExists(connection('automation_trigger_rules as destination')
        .select(1)
        .where('destination.automation_id', connection.ref('automation.id'))
        .where('destination.trigger_type', 'paid_subscription_changed')
        .where('destination.direction', 'to')
        .where((to) => {
        to.whereIn('destination.product_id', gainedTierIds);
        if (memberStatus === 'free' && memberTierIds.length === 0) {
            to.orWhere('destination.scope', 'free');
        }
    }));
};
const applyLabelAddedFilters = (query, connection, { labelId, }) => {
    query.whereExists(connection('automation_trigger_rules as rule')
        .select(1)
        .where('rule.automation_id', connection.ref('automation.id'))
        .where('rule.trigger_type', 'label_added')
        .where('rule.label_id', labelId));
};
/**
 * Create a database-backed automations repository. See `AutomationsRepository2`
 * for details on what should (and should not) be in here.
 *
 * NOTE: `createDatabaseAutomationsRepository2` will soon subsume `createDatabaseAutomationsRepository`. See NY-1704.
 */
const createDatabaseAutomationsRepository2 = ({ knex, }) => {
    return {
        async deleteTriggerRules(connection, automationId) {
            await connection('automation_trigger_rules').where('automation_id', automationId).delete();
        },
        async fetchAndLockMembers(connection, memberIds) {
            const ids = [...new Set(memberIds)];
            if (ids.length === 0) {
                return [];
            }
            const rows = await connection('members')
                .select('id', 'email')
                .whereIn('id', ids)
                .orderBy('id')
                .forUpdate();
            return zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), email: zod_1.z.string() })).parse(rows);
        },
        async findAutomationMemberEnrollments(connection, automationIds, memberIds) {
            if (automationIds.length === 0 || memberIds.length === 0) {
                return [];
            }
            const rows = await connection('automation_runs')
                .distinct('automation_id', 'member_id')
                .whereIn('automation_id', automationIds)
                .whereIn('member_id', memberIds);
            return zod_1.z.array(zod_1.z.object({ automation_id: zod_1.z.string(), member_id: zod_1.z.string() })).parse(rows);
        },
        async findEmailRecipientForClick(connection, { automationActionRevisionId, automationRunStepId, memberId }) {
            const row = await connection('automated_email_recipients')
                .select('id', 'clicked_at')
                .where({
                automation_action_revision_id: automationActionRevisionId,
                automation_run_step_id: automationRunStepId,
                member_id: memberId,
                track_clicks: true,
            })
                .forUpdate()
                .first();
            return row === undefined ? undefined : emailRecipientClickRowSchema.parse(row);
        },
        async findFirstActionRevisions(connection, options) {
            const rows = await connection('automations as automation')
                .select('automation.id as automation_id', 'actions.id as action_id', 'revisions.id as automation_action_revision_id', 'actions.type as type', 'revisions.wait_hours as wait_hours')
                .innerJoin('automation_actions as actions', 'actions.automation_id', 'automation.id')
                .innerJoin('automation_action_revisions as revisions', 'revisions.action_id', 'actions.id')
                .modify((query) => {
                switch (options.eventName) {
                    case 'membership_started':
                        applyMembershipStartedFilters(query, connection, options);
                        break;
                    case 'paid_subscription_changed':
                        applyPaidSubscriptionChangedFilters(query, connection, options);
                        break;
                    case 'label_added':
                        applyLabelAddedFilters(query, connection, options);
                        break;
                    default: {
                        const _exhaustive = options;
                        throw new errors_1.default.InternalServerError({
                            message: `Unexpected automation event: ${_exhaustive}`,
                        });
                    }
                }
            })
                .where('automation.status', 'active')
                .whereNull('actions.deleted_at')
                .whereNotExists(connection('automation_action_edges as edge')
                .select('edge.target_action_id')
                .innerJoin('automation_actions as source_actions', 'source_actions.id', 'edge.source_action_id')
                .whereNull('source_actions.deleted_at')
                .where('edge.target_action_id', connection.ref('actions.id')))
                .where('revisions.created_at', connection('automation_action_revisions')
                .max('created_at')
                .where('action_id', connection.ref('actions.id')))
                .orderBy(['actions.created_at', 'actions.id']);
            return rows.map((row) => nextActionRevisionRowSchema.parse(row));
        },
        async getNumberOfAutomations(connection) {
            const result = await connection('automations').count({ count: '*' }).first();
            return Number(result?.count ?? 0);
        },
        async incrementEmailClickedCount(connection, revisionId) {
            await connection('automation_action_revisions')
                .where({ id: revisionId })
                .update({ email_clicked_count: connection.raw('COALESCE(email_clicked_count, 0) + 1') });
        },
        async incrementEmailOpenedCount(connection, actionRevisionId, count) {
            await connection('automation_action_revisions')
                .where('id', actionRevisionId)
                .update('email_opened_count', connection.raw('COALESCE(email_opened_count, 0) + ?', [count]));
        },
        async insertActions(connection, toInsert) {
            if (toInsert.length > 0) {
                await connection('automation_actions').insert(toInsert);
            }
        },
        async insertRunSteps(connection, toInsert) {
            if (toInsert.length > 0) {
                await connection('automation_run_steps').insert(toInsert.map((step) => ({
                    ...step,
                    created_at: step.created_at,
                    updated_at: step.updated_at,
                    ready_at: step.ready_at,
                })));
            }
        },
        async insertRuns(connection, toInsert) {
            if (toInsert.length > 0) {
                await connection('automation_runs').insert(toInsert.map((run) => ({
                    ...run,
                    created_at: run.created_at,
                    updated_at: run.updated_at,
                })));
            }
        },
        async insertTriggerRules(connection, toInsert) {
            if (toInsert.length > 0) {
                await connection('automation_trigger_rules').insert(toInsert);
            }
        },
        async isAutomationActiveForRunStep(connection, runStepId) {
            const query = connection('automation_run_steps as step')
                .select(connection.raw('1'))
                .innerJoin('automation_runs as run', 'run.id', 'step.automation_run_id')
                .innerJoin('automations as automation', 'automation.id', 'run.automation_id')
                .where('step.id', runStepId)
                .where('automation.status', 'active');
            return await selectExists(connection, query);
        },
        async loadEdgeRows(connection, automationId) {
            return await connection('automation_action_edges as e')
                .select('e.source_action_id', 'e.target_action_id')
                .innerJoin('automation_actions as source_action', (join) => {
                join.on('source_action.id', 'e.source_action_id').onNull('source_action.deleted_at');
            })
                .innerJoin('automation_actions as target_action', (join) => {
                join
                    .on('target_action.id', 'e.target_action_id')
                    .onNull('target_action.deleted_at')
                    .on('target_action.automation_id', 'source_action.automation_id');
            })
                .where('source_action.automation_id', automationId)
                .orderBy(['e.source_action_id', 'e.target_action_id']);
        },
        async lockActionRevisions(connection, revisionIds) {
            const ids = [...new Set(revisionIds)];
            if (ids.length === 0) {
                return;
            }
            await connection('automation_action_revisions')
                .select('id')
                .whereIn('id', ids)
                .orderBy('id')
                .forUpdate();
        },
        async lockNotYetOpenedEmailRecipients(connection, automatedEmailRecipientIds) {
            if (automatedEmailRecipientIds.length === 0) {
                return new Set();
            }
            const rows = await connection('automated_email_recipients')
                .select('id')
                .whereIn('id', automatedEmailRecipientIds)
                .whereNull('opened_at')
                .forUpdate();
            return new Set(rows.map((row) => emailRecipientIdRowSchema.parse(row).id));
        },
        async setEmailRecipientClickedAt(connection, recipientId, clickedAt) {
            const updated = await connection('automated_email_recipients')
                .where({ id: recipientId })
                .whereNull('clicked_at')
                .update({ clicked_at: clickedAt });
            return updated > 0;
        },
        async setEmailRecipientDeliveredAndOpenedAt(connection, automatedEmailRecipientId, { deliveredAt, openedAt }) {
            if (!deliveredAt && !openedAt) {
                return;
            }
            const updates = {};
            if (deliveredAt) {
                updates.delivered_at = connection.raw('CASE WHEN delivered_at IS NULL OR delivered_at > ? THEN ? ELSE delivered_at END', [deliveredAt, deliveredAt]);
            }
            if (openedAt) {
                updates.opened_at = connection.raw('CASE WHEN opened_at IS NULL OR opened_at > ? THEN ? ELSE opened_at END', [openedAt, openedAt]);
            }
            await connection('automated_email_recipients')
                .where('id', automatedEmailRecipientId)
                .update(updates);
        },
        withConnection: (fn) => fn(knex),
        withTransaction: (fn) => knex.transaction(async (txn) => await fn(txn)),
    };
};
exports.createDatabaseAutomationsRepository2 = createDatabaseAutomationsRepository2;
