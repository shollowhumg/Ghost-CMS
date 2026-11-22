"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = before;
const logging_1 = __importDefault(require("@tryghost/logging"));
const config_1 = __importDefault(require("../../../../../shared/config"));
const dbBackup = require('../../../db/backup');
function before() {
    // Skip the pre-migration backup when disabled at the platform level. This is
    // distinct from `disableJSBackups` (which disables all JS backups, e.g. the
    // importer path) — it only skips backups taken before running migrations.
    if (config_1.default.get('disableMigrationBackups')) {
        logging_1.default.info('Database backup before migration is disabled in Ghost config');
        return;
    }
    return dbBackup.backup();
}
