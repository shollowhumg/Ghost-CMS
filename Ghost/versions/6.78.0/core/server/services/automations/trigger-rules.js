"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationTriggerRuleSchema = exports.automationTriggerRuleDefinitionSchema = void 0;
const zod_1 = require("zod");
const date_1 = require("../../lib/db-types/date");
const object_id_1 = require("../../lib/db-types/object-id");
exports.automationTriggerRuleDefinitionSchema = zod_1.z.discriminatedUnion('trigger_type', [
    zod_1.z.object({
        trigger_type: zod_1.z.literal('free_signup'),
        scope: zod_1.z.null(),
        product_id: zod_1.z.null(),
        direction: zod_1.z.null(),
    }),
    zod_1.z.discriminatedUnion('scope', [
        zod_1.z.object({
            trigger_type: zod_1.z.literal('paid_subscription_started'),
            scope: zod_1.z.literal('any_paid_tier'),
            product_id: zod_1.z.null(),
            direction: zod_1.z.null(),
        }),
        zod_1.z.object({
            trigger_type: zod_1.z.literal('paid_subscription_started'),
            scope: zod_1.z.literal('specific_paid_tier'),
            product_id: object_id_1.ObjectIdSchema,
            direction: zod_1.z.null(),
        }),
    ]),
    zod_1.z.discriminatedUnion('scope', [
        zod_1.z.object({
            trigger_type: zod_1.z.literal('paid_subscription_changed'),
            scope: zod_1.z.literal('any_paid_tier'),
            product_id: zod_1.z.null(),
            direction: zod_1.z.literal('from'),
        }),
        zod_1.z.object({
            trigger_type: zod_1.z.literal('paid_subscription_changed'),
            scope: zod_1.z.literal('free'),
            product_id: zod_1.z.null(),
            direction: zod_1.z.literal('to'),
        }),
        zod_1.z.object({
            trigger_type: zod_1.z.literal('paid_subscription_changed'),
            scope: zod_1.z.literal('specific_paid_tier'),
            product_id: object_id_1.ObjectIdSchema,
            direction: zod_1.z.enum(['from', 'to']),
        }),
    ]),
    zod_1.z.object({
        trigger_type: zod_1.z.literal('label_added'),
        label_id: object_id_1.ObjectIdSchema,
        scope: zod_1.z.null(),
        product_id: zod_1.z.null(),
        direction: zod_1.z.null(),
    }),
]);
exports.automationTriggerRuleSchema = exports.automationTriggerRuleDefinitionSchema.and(zod_1.z.object({
    id: object_id_1.ObjectIdSchema,
    automation_id: object_id_1.ObjectIdSchema,
    created_at: date_1.DbDate,
}));
