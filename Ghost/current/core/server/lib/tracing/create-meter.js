"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMeter = createMeter;
const labels_1 = require("./labels");
/**
 * Every counter ships to the one data stream, `metrics-ghost-counters`, whatever its name, as every
 * span ships to `metrics-ghost-spans`, so dashboards tell counters apart by `event.name`.
 */
const METRIC = 'ghost-counters';
/** Ships each addition to a counter as a `@tryghost/metrics` document, named as a span is. */
function createMeter({ transport, logging, }) {
    return {
        createCounter(name) {
            return {
                add(value, attributes = {}) {
                    const failed = (err) => logging.error({ event: { name: 'metrics.record.failed' }, err, counter: { name } }, 'Recording a count failed');
                    try {
                        const labels = (0, labels_1.noLabels)();
                        for (const [key, attribute] of Object.entries(attributes)) {
                            (0, labels_1.setLabel)(labels, key, attribute);
                        }
                        const document = {
                            '@timestamp': Date.now(),
                            event: { name },
                            value,
                            ...labels,
                        };
                        // Deferred and never awaited, as a span is, so shipping a count never holds up the
                        // code that counted.
                        Promise.resolve()
                            .then(() => transport.metric(METRIC, document))
                            .catch(failed);
                    }
                    catch (err) {
                        failed(err);
                    }
                },
            };
        },
    };
}
