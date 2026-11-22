"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOriginSchemes = createOriginSchemes;
/**
 * Creates the record for one import run, so files from the same origin skip a
 * known-dead https attempt and never fall back to http on a connection failure
 * once https has answered.
 * Each run makes its own: what one run learns doesn't carry over to the next.
 * An import touches few origins, so the record needs no bound.
 */
function createOriginSchemes() {
    return new Map();
}
