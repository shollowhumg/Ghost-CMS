"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindings = exports.values = exports.definitions = exports.fields = exports.namespaces = exports.canWrite = exports.MEMBER_ACCESS = exports.MEMBERS = exports.INTERNAL = exports.ADMIN = exports.adminWriteOrigin = exports.actingContext = void 0;
exports.booted = booted;
exports.init = init;
const errors_1 = __importDefault(require("@tryghost/errors"));
const limits_1 = require("../limits");
const definitions_service_1 = require("./definitions-service");
const values_service_1 = require("./values-service");
const bindings_service_1 = require("./bindings-service");
const actions_1 = require("./actions");
const config_1 = require("./config");
const custom_fields_1 = require("./custom-fields");
const namespaces_1 = require("./namespaces");
const queries_1 = require("./queries");
const tracing_1 = require("../../lib/tracing");
const tracking_1 = require("./tracking");
var actions_2 = require("./actions");
Object.defineProperty(exports, "actingContext", { enumerable: true, get: function () { return actions_2.actingContext; } });
Object.defineProperty(exports, "adminWriteOrigin", { enumerable: true, get: function () { return actions_2.adminWriteOrigin; } });
// Which door a request came through, which is what decides how much of a member's
// answers it may see or change. Required wherever that is asked, so a new caller
// has to name itself rather than inherit an answer by default.
var access_1 = require("./access");
Object.defineProperty(exports, "ADMIN", { enumerable: true, get: function () { return access_1.ADMIN; } });
Object.defineProperty(exports, "INTERNAL", { enumerable: true, get: function () { return access_1.INTERNAL; } });
Object.defineProperty(exports, "MEMBERS", { enumerable: true, get: function () { return access_1.MEMBERS; } });
Object.defineProperty(exports, "MEMBER_ACCESS", { enumerable: true, get: function () { return access_1.MEMBER_ACCESS; } });
Object.defineProperty(exports, "canWrite", { enumerable: true, get: function () { return access_1.canWrite; } });
/**
 * Boot builds these before any request is served, so a call before then is a wiring fault and
 * throws.
 */
function booted() {
    if (!exports.namespaces || !exports.definitions || !exports.values || !exports.bindings) {
        throw new errors_1.default.IncorrectUsageError({
            message: 'Members metafields were used before boot initialised them.',
        });
    }
    return { namespaces: exports.namespaces, definitions: exports.definitions, values: exports.values, bindings: exports.bindings };
}
function init() {
    // The five are constructed together below, so checking all of them keeps the "all or
    // none" invariant explicit rather than trusting one to stand in for the rest.
    if (exports.namespaces && exports.fields && exports.definitions && exports.values && exports.bindings) {
        return;
    }
    const { knex } = require('../../data/db');
    const models = require('../../models');
    const recordAction = (transacting, { context, verb, subject, details }) => (0, actions_1.recordMetafieldAction)({ Action: models.Action, transacting, context, verb, subject, details });
    // Resolved here, not in the service: reading config is this module's job, and
    // the service is handed a number. A getter rather than a value because the
    // ceiling is an operator setting that can change between requests, and a Ghost
    // container holds no state across them.
    const config = require('../../../shared/config');
    const getMaxDefinitions = () => (0, config_1.resolveMaxDefinitions)(config.get('members:metafields:maxDefinitions'));
    // Custom fields are the one application of metafields so far, and the only namespace
    // anyone can define fields in.
    exports.namespaces = (0, namespaces_1.createNamespaces)([(0, custom_fields_1.customFields)({ limitService: limits_1.limitService, getMaxDefinitions })]);
    exports.fields = (0, queries_1.fieldSource)(exports.namespaces);
    const tracking = (0, tracking_1.metafieldsTracking)({ tracer: tracing_1.tracer, meter: tracing_1.meter });
    // A field type still in development can be created only where its Labs flag is on.
    const labs = require('../../../shared/labs');
    exports.definitions = new definitions_service_1.MetafieldDefinitionsService({
        knex,
        fields: exports.fields,
        recordAction,
        namespaces: exports.namespaces,
        tracking,
        labs,
    });
    // The values service reads the field definitions itself, so it needs knex, the fields and
    // the ceiling, which also caps how many values one request can carry — no handle on the
    // definitions service.
    exports.values = new values_service_1.MetafieldValuesService({ knex, fields: exports.fields, getMaxDefinitions, tracking });
    // Built after the values, which is what a binding routes into. It has no handle on the
    // definitions: making a field is not part of binding to one, so a caller that needs both
    // asks for both.
    exports.bindings = new bindings_service_1.MetafieldBindingsService({ knex, fields: exports.fields, values: exports.values });
}
