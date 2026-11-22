"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const members_metafields_1 = require("../../services/members-metafields");
const serializers_1 = require("../../services/members-metafields/serializers");
const permissionsService = require('../../services/permissions');
// Reading a definition needs no permission. A definition says only that the site collects
// a shoe size, and every signed-in member is already shown the whole list, so there is
// nothing here to keep from staff. Managing them is the namespace owner's, and with
// `permissions: true` the framework would check against the Bookshelf model named after
// the resource — these fields have no Bookshelf model, so each writing handler asks the
// permissions service directly.
/**
 * Whether the caller may manage the route's namespace, asked of whoever owns it. The
 * namespace is settled first, as which one is being written to decides whose authority
 * applies.
 */
async function canManage(frame, action, key) {
    const { owner } = (0, members_metafields_1.booted)().namespaces.owned((0, serializers_1.namespaceRoute)(frame.options).namespace);
    return permissionsService.canThis(frame.options.context)[action][owner.staff](key);
}
const noCacheInvalidation = { cacheInvalidate: false };
const controller = {
    docName: 'members_metafields',
    browse: {
        headers: noCacheInvalidation,
        options: ['namespace', 'filter'],
        validation: { options: { namespace: { required: true } } },
        permissions: false,
        query(frame) {
            return (0, members_metafields_1.booted)().definitions.browse({ ...(0, serializers_1.namespaceRoute)(frame.options), filter: frame.options.filter }, members_metafields_1.ADMIN);
        },
    },
    read: {
        headers: noCacheInvalidation,
        options: ['namespace', 'key'],
        validation: { options: { namespace: { required: true }, key: { required: true } } },
        permissions: false,
        query(frame) {
            const { namespace, key } = (0, serializers_1.fieldRoute)(frame.options);
            return (0, members_metafields_1.booted)().definitions.read(namespace, key, members_metafields_1.ADMIN);
        },
    },
    // Reading the values members hold needs the permission to browse members, because the values
    // say something about the members who hold them.
    browseValues: {
        headers: noCacheInvalidation,
        options: ['namespace', 'key'],
        validation: { options: { namespace: { required: true }, key: { required: true } } },
        permissions: { docName: 'member', method: 'browse' },
        query(frame) {
            return (0, members_metafields_1.booted)().values.heldValues((0, serializers_1.fieldRoute)(frame.options));
        },
    },
    add: {
        statusCode: 201,
        headers: noCacheInvalidation,
        options: ['namespace'],
        validation: { options: { namespace: { required: true } } },
        permissions(frame) {
            return canManage(frame, 'add');
        },
        query(frame) {
            return (0, members_metafields_1.booted)().definitions.add((0, members_metafields_1.actingContext)(frame.options.context), (0, serializers_1.namespaceRoute)(frame.options).namespace, frame.data.members_metafields);
        },
    },
    reorder: {
        headers: noCacheInvalidation,
        options: ['namespace'],
        validation: { options: { namespace: { required: true } } },
        permissions(frame) {
            return canManage(frame, 'edit');
        },
        query(frame) {
            return (0, members_metafields_1.booted)().definitions.reorder((0, members_metafields_1.actingContext)(frame.options.context), (0, serializers_1.namespaceRoute)(frame.options).namespace, frame.data.members_metafields);
        },
    },
    edit: {
        headers: noCacheInvalidation,
        options: ['namespace', 'key'],
        validation: { options: { namespace: { required: true }, key: { required: true } } },
        permissions(frame) {
            return canManage(frame, 'edit', frame.options.key);
        },
        async query(frame) {
            const field = (0, serializers_1.fieldRoute)(frame.options);
            const edited = await (0, members_metafields_1.booted)().definitions.edit((0, members_metafields_1.actingContext)(frame.options.context), field.namespace, field.key, frame.data.members_metafields[0]);
            // Tiers list to anyone the field a port writes into while members can read it, so the site's
            // cache is cleared when an edit starts or stops that for a field a port writes into.
            if (edited.changedForMembers && (await (0, members_metafields_1.booted)().bindings.isBound(field))) {
                frame.setHeader('X-Cache-Invalidate', '/*');
            }
            return edited.field;
        },
    },
    destroy: {
        statusCode: 204,
        headers: noCacheInvalidation,
        options: ['namespace', 'key'],
        validation: { options: { namespace: { required: true }, key: { required: true } } },
        permissions(frame) {
            return canManage(frame, 'destroy', frame.options.key);
        },
        async query(frame) {
            const field = (0, serializers_1.fieldRoute)(frame.options);
            // Deleting a field deletes its bindings, and tiers list to anyone a requirement only while
            // each of its ports is bound, so the site's cache is cleared when a port writes into it.
            // Checked before the delete takes the bindings with it.
            if (await (0, members_metafields_1.booted)().bindings.isBound(field)) {
                frame.setHeader('X-Cache-Invalidate', '/*');
            }
            await (0, members_metafields_1.booted)().definitions.destroy((0, members_metafields_1.actingContext)(frame.options.context), field.namespace, field.key);
            return null;
        },
    },
};
// The API framework loads this file with `require()`, so it exports CommonJS-style;
// `export default` would not be picked up.
module.exports = controller;
