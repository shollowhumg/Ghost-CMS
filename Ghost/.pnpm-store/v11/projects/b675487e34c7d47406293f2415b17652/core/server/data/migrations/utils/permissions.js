"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPermission = addPermission;
exports.addPermissionToRole = addPermissionToRole;
exports.removePermissionFromRole = removePermissionFromRole;
exports.addPermissionWithRoles = addPermissionWithRoles;
exports.createRemovePermissionMigration = createRemovePermissionMigration;
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const logging_1 = __importDefault(require("@tryghost/logging"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const migrations_1 = require("./migrations");
const MIGRATION_USER = 1;
const messages = {
    permissionRoleActionError: 'Cannot {action} permission({permission}) with role({role}) - {resource} does not exist',
};
async function addPermissionHelper(connection, config) {
    const existingPermission = await connection('permissions')
        .where({
        name: config.name,
        action_type: config.action,
        object_type: config.object,
    })
        .first();
    if (existingPermission) {
        logging_1.default.warn(`Permission for ${config.action}:${config.object} already added`);
        return;
    }
    logging_1.default.info(`Adding permission for ${config.action}:${config.object}`);
    const date = connection.raw('CURRENT_TIMESTAMP');
    const data = {
        id: (0, bson_objectid_1.default)().toHexString(),
        name: config.name,
        action_type: config.action,
        object_type: config.object,
        created_at: date,
        updated_at: date,
    };
    if (await connection.schema.hasColumn('permissions', 'created_by')) {
        data.created_by = MIGRATION_USER;
    }
    if (await connection.schema.hasColumn('permissions', 'updated_by')) {
        data.updated_by = MIGRATION_USER;
    }
    await connection('permissions').insert(data);
}
async function removePermissionHelper(connection, config) {
    const existingPermission = await connection('permissions')
        .where({
        name: config.name,
        action_type: config.action,
        object_type: config.object,
    })
        .first();
    if (!existingPermission) {
        logging_1.default.warn(`Permission for ${config.action}:${config.object} already removed`);
        return;
    }
    logging_1.default.info(`Removing permission for ${config.action}:${config.object}`);
    await connection('permissions')
        .where({
        action_type: config.action,
        object_type: config.object,
    })
        .del();
}
/**
 * Creates a migration which will add a permission to the database
 */
function addPermission(config) {
    return (0, migrations_1.createTransactionalMigration)(async function up(connection) {
        await addPermissionHelper(connection, config);
    }, async function down(connection) {
        await removePermissionHelper(connection, config);
    });
}
/**
 * Creates a migration which will remove a permission from the database
 */
function removePermission(config) {
    return (0, migrations_1.createTransactionalMigration)(async function up(connection) {
        await removePermissionHelper(connection, config);
    }, async function down(connection) {
        await addPermissionHelper(connection, config);
    });
}
async function addPermissionToRoleHelper(connection, config) {
    const permission = await connection('permissions')
        .where({
        name: config.permission,
    })
        .first();
    // Permission checks no longer read these tables, and databases created
    // since fixtures stopped seeding permissions have no rows to link.
    if (!permission) {
        logging_1.default.warn(`Adding permission(${config.permission}) to role(${config.role}) - Permission not found.`);
        return;
    }
    const role = await connection('roles')
        .where({
        name: config.role,
    })
        .first();
    if (!role) {
        throw new errors_1.default.InternalServerError({
            message: (0, tpl_1.default)(messages.permissionRoleActionError, {
                action: 'add',
                permission: config.permission,
                role: config.role,
                resource: 'role',
            }),
        });
    }
    const existingRelation = await connection('permissions_roles')
        .where({
        permission_id: permission.id,
        role_id: role.id,
    })
        .first();
    if (existingRelation) {
        logging_1.default.warn(`Adding permission(${config.permission}) to role(${config.role}) - already exists`);
        return;
    }
    logging_1.default.info(`Adding permission(${config.permission}) to role(${config.role})`);
    await connection('permissions_roles').insert({
        id: (0, bson_objectid_1.default)().toHexString(),
        permission_id: permission.id,
        role_id: role.id,
    });
}
async function removePermissionFromRoleHelper(connection, config) {
    const permission = await connection('permissions')
        .where({
        name: config.permission,
    })
        .first();
    if (!permission) {
        logging_1.default.warn(`Removing permission(${config.permission}) from role(${config.role}) - Permission not found.`);
        return;
    }
    const role = await connection('roles')
        .where({
        name: config.role,
    })
        .first();
    if (!role) {
        logging_1.default.warn(`Removing permission(${config.permission}) from role(${config.role}) - Role not found.`);
        return;
    }
    const existingRelation = await connection('permissions_roles')
        .where({
        permission_id: permission.id,
        role_id: role.id,
    })
        .first();
    if (!existingRelation) {
        logging_1.default.warn(`Removing permission(${config.permission}) from role(${config.role}) - already removed`);
        return;
    }
    logging_1.default.info(`Removing permission(${config.permission}) from role(${config.role})`);
    await connection('permissions_roles')
        .where({
        permission_id: permission.id,
        role_id: role.id,
    })
        .del();
}
/**
 * Creates a migration which will link a permission to a role in the database
 */
function addPermissionToRole(config) {
    return (0, migrations_1.createTransactionalMigration)(async function up(connection) {
        await addPermissionToRoleHelper(connection, config);
    }, async function down(connection) {
        await removePermissionFromRoleHelper(connection, config);
    });
}
/**
 * Creates a migration which will remove the permission from roles
 */
function removePermissionFromRole(config) {
    return (0, migrations_1.createTransactionalMigration)(async function up(connection) {
        await removePermissionFromRoleHelper(connection, config);
    }, async function down(connection) {
        await addPermissionToRoleHelper(connection, config);
    });
}
/**
 * Creates a migration which will add a permission to the database, and then link it to roles
 */
function addPermissionWithRoles(config, roles) {
    return (0, migrations_1.combineTransactionalMigrations)(addPermission(config), ...roles.map((role) => addPermissionToRole({ permission: config.name, role })));
}
/**
 * Creates a migration which will remove permissions from roles, and then remove the permission
 */
function createRemovePermissionMigration(config, roles) {
    return (0, migrations_1.combineTransactionalMigrations)(...roles.map((role) => removePermissionFromRole({ permission: config.name, role })), removePermission(config));
}
