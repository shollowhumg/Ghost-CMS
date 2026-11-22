"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metafieldsTracking = metafieldsTracking;
/** How each change an edit makes, named as its action is, reads on a dashboard. */
const CHANGES = {
    rename: 'rename',
    changeAccess: 'change_access',
    changeSettings: 'change_settings',
    archive: 'archive',
    restore: 'restore',
};
/** The span each command on the field definitions records. */
const DEFINITION_SPANS = {
    create: 'members.metafields.definition.create',
    edit: 'members.metafields.definition.edit',
    reorder: 'members.metafields.definition.reorder',
    delete: 'members.metafields.definition.delete',
};
// A list counts the attempt once under each type, however many of its fields share one.
const fieldTypes = (fields) => [...new Set(fields.map(({ type }) => type))].sort();
function metafieldsTracking({ tracer, meter }) {
    const unreadableFields = meter.createCounter('members.metafields.unreadable_fields');
    return {
        /** Each command that changes the field definitions records a span of its own. */
        definition(command, run) {
            return tracer.track(DEFINITION_SPANS[command], (span) => {
                const changes = [];
                return run({
                    fields(fields) {
                        span.setAttribute('field_types', fieldTypes(fields));
                    },
                    changing(change) {
                        changes.push(CHANGES[change]);
                        span.setAttribute('changes', changes);
                    },
                });
            });
        },
        /**
         * Each write of a member's values reported here records a span once `stored` settles.
         * Recorded alongside the write rather than awaited by it, as a write that joined its
         * caller's transaction is only stored once that commits.
         */
        valuesWrite({ source, fields }, stored) {
            tracer
                .track('members.metafields.values', async (span) => {
                span.setAttribute('source', source);
                span.setAttribute('field_types', fieldTypes(fields));
                await stored;
            })
                // The write's own caller hears of any failure.
                .catch(() => { });
        },
        /**
         * Counts a stored field that couldn't be read as stored, each time it is read, by what became
         * of it: read with its type's default settings, or left out when even that failed. It is a
         * count rather than a span because it happens inside a read, and reads aren't recorded as spans.
         */
        unreadableField({ reader, outcome, type, }) {
            unreadableFields.add(1, { reader, outcome, field_type: type });
        },
    };
}
