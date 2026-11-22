"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.add = add;
exports.edit = edit;
const errors_1 = __importDefault(require("@tryghost/errors"));
// @ts-expect-error This module lacks type definitions.
const labs_1 = __importDefault(require("../../../../../../shared/labs"));
const automations_schemas_1 = require("../../../../../services/automations/automations-schemas");
const build_invalid_automation_payload_message_1 = require("../../../../../services/automations/util/build-invalid-automation-payload-message");
const messages = {
    invalidAutomationCreationPayload: 'Invalid automation payload.',
    invalidAutomationEditPayload: 'Invalid automation edit payload.',
    invalidAutomationStatus: 'Automation status must be one of: active, inactive, archived.',
    invalidStatusOnlyEdit: 'Status-only automation edits can only set status to inactive or archived.',
};
function parseAddAutomation(data) {
    const result = automations_schemas_1.addAutomationDataSchema.safeParse(data);
    if (!result.success) {
        const issue = result.error.issues[0];
        throw new errors_1.default.ValidationError({
            message: (0, build_invalid_automation_payload_message_1.buildInvalidAutomationPayloadMessage)(result.error.issues, messages.invalidAutomationCreationPayload),
            property: String(issue.path[0] ?? 'automations'),
        });
    }
    return result.data;
}
function parseEditAutomation(data) {
    // We use two separate schemas to preserve field-level errors, which Zod loses
    // if we use its union types.
    const hasGraphField = typeof data === 'object' && data !== null && ('actions' in data || 'edges' in data);
    const schema = hasGraphField ? automations_schemas_1.editAutomationDataSchema : automations_schemas_1.editAutomationStatusOnlySchema;
    const result = schema.safeParse(data);
    if (!result.success) {
        if (result.error.issues.some((issue) => issue.path[0] === 'status')) {
            throw new errors_1.default.ValidationError({
                message: hasGraphField ? messages.invalidAutomationStatus : messages.invalidStatusOnlyEdit,
                property: 'status',
            });
        }
        throw new errors_1.default.ValidationError({
            message: (0, build_invalid_automation_payload_message_1.buildInvalidAutomationPayloadMessage)(result.error.issues, messages.invalidAutomationEditPayload),
        });
    }
    return result.data;
}
function validateTriggerFlags(data) {
    if (!labs_1.default.isSet('automationsLeadMagnets') &&
        data.trigger_rules?.some((rule) => rule.trigger_type === 'label_added')) {
        throw new errors_1.default.ValidationError({
            message: 'Label added triggers require automationsLeadMagnets to be enabled.',
            property: 'trigger_rules',
        });
    }
}
function add(_apiConfig, frame) {
    const automations = frame.data.automations;
    const data = parseAddAutomation(Array.isArray(automations) ? automations[0] : undefined);
    validateTriggerFlags(data);
    frame.data = data;
}
function edit(_apiConfig, frame) {
    const automations = frame.data.automations;
    const data = parseEditAutomation(Array.isArray(automations) ? automations[0] : undefined);
    validateTriggerFlags(data);
    frame.data = data;
}
