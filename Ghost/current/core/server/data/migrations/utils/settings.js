"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSetting = addSetting;
exports.removeSetting = removeSetting;
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const logging_1 = __importDefault(require("@tryghost/logging"));
const migrations_1 = require("./migrations");
const MIGRATION_USER = 1;
/**
 * Creates a migration which will insert a new setting in settings table
 */
function addSetting({ key, value, type, group, flags = null }) {
    return (0, migrations_1.createTransactionalMigration)(async function up(connection) {
        const settingExists = await connection('settings').where('key', '=', key).first();
        if (settingExists) {
            logging_1.default.warn(`Skipping adding setting: ${key} - setting already exists`);
            return;
        }
        logging_1.default.info(`Adding setting: ${key}`);
        const now = connection.raw('CURRENT_TIMESTAMP');
        const data = {
            id: (0, bson_objectid_1.default)().toHexString(),
            key,
            value,
            group,
            type,
            flags,
            created_at: now,
        };
        if (await connection.schema.hasColumn('settings', 'created_by')) {
            data.created_by = MIGRATION_USER;
        }
        if (await connection.schema.hasColumn('settings', 'updated_by')) {
            data.updated_by = MIGRATION_USER;
        }
        return connection('settings').insert(data);
    }, async function down(connection) {
        const settingExists = await connection('settings').where('key', '=', key).first();
        if (!settingExists) {
            logging_1.default.warn(`Skipping dropping setting: ${key} - setting does not exist`);
            return;
        }
        logging_1.default.info(`Dropping setting: ${key}`);
        return connection('settings').where('key', '=', key).del();
    });
}
function removeSetting(key) {
    let originalSetting = null;
    return (0, migrations_1.createTransactionalMigration)(async function up(connection) {
        const settingExists = await connection('settings').where('key', '=', key).first();
        if (!settingExists) {
            logging_1.default.warn(`Skipping removing setting: ${key} - setting does not exist`);
            return;
        }
        // Store the original setting data for the down migration
        originalSetting = settingExists;
        logging_1.default.info(`Removing setting: ${key}`);
        return connection('settings').where('key', '=', key).del();
    }, async function down(connection) {
        const settingExists = await connection('settings').where('key', '=', key).first();
        if (settingExists) {
            logging_1.default.warn(`Skipping restoring setting: ${key} - setting already exists`);
            return;
        }
        if (!originalSetting) {
            logging_1.default.warn(`Skipping restoring setting: ${key} - no original setting data found`);
            return;
        }
        logging_1.default.info(`Restoring setting: ${key}`);
        const now = connection.raw('CURRENT_TIMESTAMP');
        const data = {
            id: (0, bson_objectid_1.default)().toHexString(),
            key,
            value: originalSetting.value,
            group: originalSetting.group,
            type: originalSetting.type,
            flags: originalSetting.flags,
            created_at: now,
        };
        if (await connection.schema.hasColumn('settings', 'created_by')) {
            data.created_by = MIGRATION_USER;
        }
        if (await connection.schema.hasColumn('settings', 'updated_by')) {
            data.updated_by = MIGRATION_USER;
        }
        return connection('settings').insert(data);
    });
}
