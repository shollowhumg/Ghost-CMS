"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importExportTracking = importExportTracking;
const metafield_csv_1 = require("@tryghost/metafield-csv");
function importExportTracking(tracer) {
    return {
        /**
         * Each import run records one span, whichever way it ran: `inline` in its caller's own flow,
         * such as the request that uploaded the file or the Revue data import, or `background` in a
         * job after the request.
         */
        import(mode, run) {
            return tracer.track('members.import.run', (span) => {
                span.setAttribute('mode', mode);
                return run({
                    read(rows) {
                        span.setAttribute('rows', rows);
                    },
                    readsFields(fields, rows) {
                        span.setAttribute('has_custom_fields', (0, metafield_csv_1.hasFieldColumns)(fields, rows));
                    },
                    wrote({ imported, rejected }) {
                        span.setAttribute('imported', imported);
                        span.setAttribute('rejected', rejected);
                    },
                });
            });
        },
        /**
         * Each export, writing a column for each of `fields`, records one span once its rows have
         * finished streaming.
         */
        export(fields) {
            let written = 0;
            return {
                /** Rows written to the export's stream, as each batch of them is. */
                wrote(rows) {
                    written += rows;
                },
                /**
                 * Records the export once `streamed` settles, which is after the stream has been handed
                 * back, so an export that breaks off part way counts as failed although the publisher's
                 * download had already begun. Settles on its own, as the span logs a failure.
                 */
                ended(streamed) {
                    tracer
                        .track('members.export.run', async (span) => {
                        span.setAttribute('has_custom_fields', fields.length > 0);
                        try {
                            await streamed;
                        }
                        finally {
                            // An export that broke off says how many rows it had written.
                            span.setAttribute('rows', written);
                        }
                    })
                        .catch(() => { });
                },
            };
        },
    };
}
