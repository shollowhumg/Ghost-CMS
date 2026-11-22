"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noLabels = void 0;
exports.setLabel = setLabel;
const noLabels = () => ({ labels: {}, numeric_labels: {} });
exports.noLabels = noLabels;
/**
 * Whether an attribute's value is a number or a list of numbers. A list's first item is enough to
 * tell, because `AttributeValue` only allows lists of one kind. Empty lists are dropped before
 * this is asked, so a list always has a first item.
 */
const isNumeric = (value) => typeof value === 'number' || (Array.isArray(value) && typeof value[0] === 'number');
/** Sets one attribute on `labels`, replacing any value its key had. */
function setLabel(labels, key, value) {
    // Elasticsearch reads a dot in a field name as nesting, and `labels` can't hold nested fields,
    // so dots become underscores, as Elastic's APM does for OpenTelemetry attributes.
    const field = key.replace(/\./g, '_');
    // A key set again can change from a number to a string or back, which moves it between
    // `labels` and `numeric_labels`, so its old value is removed from both first.
    delete labels.labels[field];
    delete labels.numeric_labels[field];
    // An empty list is dropped: Elasticsearch stores nothing for one, and with no items there's no
    // telling whether it belongs in `labels` or `numeric_labels`.
    if (Array.isArray(value) && value.length === 0) {
        return;
    }
    // Copied, as OpenTelemetry copies a list attribute, so that the caller changing its list
    // afterwards can't change what ships.
    const copy = structuredClone(value);
    if (isNumeric(copy)) {
        labels.numeric_labels[field] = copy;
    }
    else {
        labels.labels[field] = copy;
    }
}
