"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAddColumnMigration = createAddColumnMigration;
exports.createDropColumnMigration = createDropColumnMigration;
exports.createSetNullableMigration = createSetNullableMigration;
exports.createAddIndexMigration = createAddIndexMigration;
exports.createRenameColumnMigration = createRenameColumnMigration;
exports.createDropNullableMigration = createDropNullableMigration;
const logging_1 = __importDefault(require("@tryghost/logging"));
const db = __importStar(require("../../db"));
const migrations_1 = require("./migrations");
const DatabaseInfo = require('@tryghost/database-info');
const { commands } = require('../../schema');
/**
 * Builds a migration that runs inside a transaction on MySQL but NOT on SQLite.
 *
 * SQLite implements a column nullability change by rebuilding the whole table,
 * which requires toggling `PRAGMA foreign_keys` — and that pragma is a no-op once
 * a transaction is open. So on SQLite the migration must run non-transactionally
 * (see applyNullableChange). MySQL alters the column in place and keeps the
 * transaction it has always used.
 */
function createNullableMigration(up, down) {
    const transaction = !DatabaseInfo.isSQLite(db.knex);
    return {
        config: {
            transaction,
        },
        async up(config) {
            await up((config.transacting || config.connection));
        },
        async down(config) {
            await down((config.transacting || config.connection));
        },
    };
}
function createAddColumnMigration(table, column, columnDefinition, options = {}) {
    return (0, migrations_1.createNonTransactionalMigration)(
    // up
    commands.createColumnMigration({
        table,
        column,
        dbIsInCorrectState: (hasColumn) => hasColumn === true,
        operation: commands.addColumn,
        operationVerb: 'Adding',
        columnDefinition,
        options,
    }), 
    // down
    commands.createColumnMigration({
        table,
        column,
        dbIsInCorrectState: (hasColumn) => hasColumn === false,
        operation: commands.dropColumn,
        operationVerb: 'Removing',
        columnDefinition,
        options,
    }));
}
function createDropColumnMigration(table, column, columnDefinition, options = {}) {
    return (0, migrations_1.createNonTransactionalMigration)(
    // up
    commands.createColumnMigration({
        table,
        column,
        dbIsInCorrectState: (hasColumn) => hasColumn === false,
        operation: commands.dropColumn,
        operationVerb: 'Removing',
        columnDefinition,
        options,
    }), 
    // down
    commands.createColumnMigration({
        table,
        column,
        dbIsInCorrectState: (hasColumn) => hasColumn === true,
        operation: commands.addColumn,
        operationVerb: 'Adding',
        columnDefinition,
        options,
    }));
}
/**
 * Applies a column nullability change, disabling foreign key checks around it in
 * the way each database engine requires.
 *
 * SQLite implements a nullability change by rebuilding the whole table (create a
 * temp table -> copy data -> DROP the original -> rename). That DROP fails on a
 * table that other tables reference (e.g. `members`) unless foreign keys are
 * disabled first. `PRAGMA foreign_keys` is a no-op once a transaction is open, so
 * the SQLite migration runs non-transactionally (see createNullableMigration) and
 * we toggle the pragma directly on the connection. The better-sqlite3 pool is
 * fixed at a single connection, so the pragma applies to the same connection that
 * runs the rebuild.
 *
 * MySQL alters the column in place inside the migration's transaction, so `knex`
 * here is already that transaction. We only disable foreign key checks when the
 * caller opts in; running `SET FOREIGN_KEY_CHECKS` on the transaction keeps it on
 * the same connection as the ALTER. `disableForeignKeyChecks` is MySQL only.
 */
async function applyNullableChange(knex, operation, table, column, disableForeignKeyChecks = false) {
    if (DatabaseInfo.isSQLite(knex)) {
        await knex.raw('PRAGMA foreign_keys = OFF;');
        try {
            await commands[operation](table, column, knex);
        }
        finally {
            await knex.raw('PRAGMA foreign_keys = ON;');
        }
    }
    else if (disableForeignKeyChecks) {
        await knex.raw('SET FOREIGN_KEY_CHECKS=0;');
        try {
            await commands[operation](table, column, knex);
        }
        finally {
            await knex.raw('SET FOREIGN_KEY_CHECKS=1;');
        }
    }
    else {
        await commands[operation](table, column, knex);
    }
}
/**
 * `disableForeignKeyChecks` applies to the down operation (when dropping nullable).
 */
function createSetNullableMigration(table, column, options = {}) {
    return createNullableMigration(async function up(knex) {
        try {
            // Check if column is already nullable
            const isNullable = await isColumnNullable(table, column, knex);
            if (isNullable) {
                logging_1.default.warn(`Setting nullable: ${table}.${column} - skipping as column is already nullable`);
                return;
            }
        }
        catch (error) {
            // If we can't check the column status, proceed with the migration
            // This maintains backward compatibility with implementation before checks were added
            logging_1.default.warn(`Could not check nullable status for ${table}.${column}, proceeding with migration: ${error.message}`);
        }
        logging_1.default.info(`Setting nullable: ${table}.${column}`);
        await applyNullableChange(knex, 'setNullable', table, column);
    }, async function down(knex) {
        try {
            // Check if column is already not nullable
            const isNotNullable = await isColumnNotNullable(table, column, knex);
            if (isNotNullable) {
                logging_1.default.warn(`Dropping nullable: ${table}.${column} - skipping as column is already not nullable`);
                return;
            }
        }
        catch (error) {
            // If we can't check the column status, proceed with the migration
            // This maintains backward compatibility with implementation before checks were added
            logging_1.default.warn(`Could not check nullable status for ${table}.${column}, proceeding with migration: ${error.message}`);
        }
        logging_1.default.info(`Dropping nullable: ${table}.${column}${options.disableForeignKeyChecks ? ' with foreign keys disabled' : ''}`);
        await applyNullableChange(knex, 'dropNullable', table, column, options.disableForeignKeyChecks);
    });
}
/**
 * @param columns One or multiple columns (in case the index should be for multiple columns)
 * @param options.length MySQL only: create a prefix index of this many characters
 */
function createAddIndexMigration(table, columns, options = {}) {
    return (0, migrations_1.createTransactionalMigration)(async function up(knex) {
        await commands.addIndex(table, columns, knex, options);
    }, async function down(knex) {
        await commands.dropIndex(table, columns, knex);
    });
}
/**
 * @param options.algorithm MySQL only
 */
function createRenameColumnMigration(table, from, to, options = {}) {
    return (0, migrations_1.createNonTransactionalMigration)(async function up(knex) {
        const hasColumn = await knex.schema.hasColumn(table, to);
        if (hasColumn) {
            logging_1.default.warn(`Renaming ${table}.${from} to ${table}.${to} column - skipping as column ${table}.${to} already exists`);
        }
        else {
            await commands.renameColumn(table, from, to, knex, options);
        }
    }, async function down(knex) {
        const hasColumn = await knex.schema.hasColumn(table, from);
        if (hasColumn) {
            logging_1.default.warn(`Renaming ${table}.${to} to ${table}.${from} column - skipping as column ${table}.${from} already exists`);
        }
        else {
            await commands.renameColumn(table, to, from, knex, options);
        }
    });
}
/**
 * Check if a column is already not nullable
 */
async function isColumnNotNullable(table, column, knex) {
    if (DatabaseInfo.isSQLite(knex)) {
        const response = await knex.raw('PRAGMA table_info(??)', [table]);
        const columnInfo = response.find((col) => col.name === column);
        return columnInfo?.notnull === 1;
    }
    else {
        const response = await knex.raw('SHOW COLUMNS FROM ??', [table]);
        const columnInfo = response[0].find((col) => col.Field === column);
        return columnInfo?.Null === 'NO';
    }
}
/**
 * Check if a column is already nullable
 */
async function isColumnNullable(table, column, knex) {
    if (DatabaseInfo.isSQLite(knex)) {
        const response = await knex.raw('PRAGMA table_info(??)', [table]);
        const columnInfo = response.find((col) => col.name === column);
        return columnInfo?.notnull === 0;
    }
    else {
        const response = await knex.raw('SHOW COLUMNS FROM ??', [table]);
        const columnInfo = response[0].find((col) => col.Field === column);
        return columnInfo?.Null === 'YES';
    }
}
/**
 * `disableForeignKeyChecks` applies to the up operation (when dropping nullable).
 */
function createDropNullableMigration(table, column, options = {}) {
    return createNullableMigration(async function up(knex) {
        try {
            // Check if column is already not nullable
            const isNotNullable = await isColumnNotNullable(table, column, knex);
            if (isNotNullable) {
                logging_1.default.warn(`Dropping nullable: ${table}.${column} - skipping as column is already not nullable`);
                return;
            }
        }
        catch (error) {
            // If we can't check the column status, proceed with the migration
            // This maintains backward compatibility with implementation before checks were added
            logging_1.default.warn(`Could not check nullable status for ${table}.${column}, proceeding with migration: ${error.message}`);
        }
        logging_1.default.info(`Dropping nullable: ${table}.${column}${options.disableForeignKeyChecks ? ' with foreign keys disabled' : ''}`);
        await applyNullableChange(knex, 'dropNullable', table, column, options.disableForeignKeyChecks);
    }, async function down(knex) {
        try {
            // Check if column is already nullable
            const isNullable = await isColumnNullable(table, column, knex);
            if (isNullable) {
                logging_1.default.warn(`Setting nullable: ${table}.${column} - skipping as column is already nullable`);
                return;
            }
        }
        catch (error) {
            // If we can't check the column status, proceed with the migration
            // This maintains backward compatibility with implementation before checks were added
            logging_1.default.warn(`Could not check nullable status for ${table}.${column}, proceeding with migration: ${error.message}`);
        }
        logging_1.default.info(`Setting nullable: ${table}.${column}`);
        await applyNullableChange(knex, 'setNullable', table, column);
    });
}
