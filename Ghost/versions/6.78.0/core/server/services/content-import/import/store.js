"use strict";
// The in-memory record of what a content import did: one run per upload, one
// outcome per row. Nothing is persisted; the durable job system milestone
// replaces this.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportRunStore = void 0;
class ImportRunStore {
    _runs = new Map();
    _now;
    constructor({ now = () => new Date() } = {}) {
        this._now = now;
    }
    create(id, total, sourceColumns = []) {
        const run = {
            id,
            status: 'running',
            startedAt: this._now(),
            total,
            sourceColumns,
            rows: [],
        };
        this._runs.set(id, run);
        return run;
    }
    record(id, outcome) {
        this._runs.get(id)?.rows.push(outcome);
    }
    finish(id) {
        const run = this._runs.get(id);
        if (run) {
            run.status = 'complete';
            run.finishedAt = this._now();
        }
    }
    fail(id, reason) {
        const run = this._runs.get(id);
        if (run) {
            run.status = 'failed';
            run.failureReason = reason;
            run.finishedAt = this._now();
        }
    }
    get(id) {
        return this._runs.get(id);
    }
    release(id) {
        this._runs.delete(id);
    }
}
exports.ImportRunStore = ImportRunStore;
