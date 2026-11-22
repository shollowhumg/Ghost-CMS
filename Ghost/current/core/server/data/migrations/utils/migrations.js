"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNonTransactionalMigration = createNonTransactionalMigration;
exports.createIrreversibleMigration = createIrreversibleMigration;
exports.createTransactionalMigration = createTransactionalMigration;
exports.combineTransactionalMigrations = combineTransactionalMigrations;
exports.combineNonTransactionalMigrations = combineNonTransactionalMigrations;
exports.createFinalMigration = createFinalMigration;
const errors_1 = __importDefault(require("@tryghost/errors"));
function createNonTransactionalMigration(up, down) {
    return {
        config: {
            transaction: false,
        },
        async up(config) {
            await up(config.connection);
        },
        async down(config) {
            await down(config.connection);
        },
    };
}
function createIrreversibleMigration(up) {
    return {
        config: {
            irreversible: true,
        },
        async up(config) {
            await up(config.connection);
        },
        async down() {
            return Promise.reject();
        },
    };
}
function createTransactionalMigration(up, down) {
    return {
        config: {
            transaction: true,
        },
        async up(config) {
            await up(config.transacting);
        },
        async down(config) {
            await down(config.transacting);
        },
    };
}
function combineTransactionalMigrations(...migrations) {
    return {
        config: {
            transaction: true,
        },
        async up(config) {
            for (const migration of migrations) {
                await migration.up(config);
            }
        },
        async down(config) {
            // Down migrations must be run backwards!!
            for (const migration of migrations.toReversed()) {
                await migration.down(config);
            }
        },
    };
}
function combineNonTransactionalMigrations(...migrations) {
    return {
        config: {
            transaction: false,
        },
        async up(config) {
            for (const migration of migrations) {
                await migration.up(config);
            }
        },
        async down(config) {
            // Down migrations must be run backwards!!
            for (const migration of migrations.toReversed()) {
                await migration.down(config);
            }
        },
    };
}
function createFinalMigration(major) {
    return createTransactionalMigration(async function up() {
        throw new errors_1.default.InternalServerError({
            message: `Unable to run migrations`,
            context: `You must be on the latest v${major}.x to update across major versions - https://docs.ghost.org/update/`,
            help: `Run 'ghost update v${major}' to get the latest v${major}.x version, then run 'ghost update' to get to the latest.`,
        });
    }, async function down() {
        // no-op
    });
}
