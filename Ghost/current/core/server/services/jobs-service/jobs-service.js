"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const cron_validate_1 = __importDefault(require("cron-validate"));
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const after_commit_1 = require("../../lib/after-commit");
class JobsService {
    #backend;
    #logging;
    #sentry;
    #outbox;
    #logOutboxUnavailable;
    #registry = new Map();
    #queueByType = new Map();
    #queues = new Map();
    #notReplayed = new Set();
    #leaseTimer;
    #leaseTick;
    constructor({ backend, logging, sentry, outbox, logOutboxUnavailable }) {
        this.#backend = backend;
        this.#logging = logging;
        this.#sentry = sentry;
        this.#outbox = outbox;
        this.#logOutboxUnavailable = logOutboxUnavailable ?? false;
    }
    handle(JobClass, handler, options) {
        const type = JobClass.type;
        if (typeof type !== 'string' || type.length === 0) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Cannot register a job handler: ${JobClass.name ?? 'job class'} is missing a static "type" string.`,
            });
        }
        if (this.#registry.has(type)) {
            throw new errors_1.default.IncorrectUsageError({
                message: `A handler for job type "${type}" is already registered.`,
            });
        }
        this.#declareQueue(type, options);
        if (JobClass.replayAfterRestart !== true) {
            this.#notReplayed.add(type);
        }
        this.#registry.set(type, (payload) => handler(new JobClass(JSON.parse(payload))));
    }
    #declareQueue(type, options) {
        if (!options) {
            return;
        }
        const { queue, concurrency } = options;
        if (typeof queue !== 'string' || queue.length === 0) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Invalid queue for job type "${type}": ${JSON.stringify(queue)}. Expected a non-empty string.`,
            });
        }
        // "default" is the backend's shared lane for types that declare no queue;
        // declaring it would silently re-size that lane for every unrouted type.
        if (queue === 'default') {
            throw new errors_1.default.IncorrectUsageError({
                message: `Queue name "default" is reserved for the shared lane; job type "${type}" must omit options to use it.`,
            });
        }
        if (!Number.isInteger(concurrency) || concurrency < 1) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Invalid concurrency for job type "${type}": ${JSON.stringify(concurrency)}. Expected a positive integer.`,
            });
        }
        const existing = this.#queues.get(queue);
        if (existing && existing.concurrency !== concurrency) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Conflicting concurrency for queue "${queue}": ${existing.concurrency} is already declared, job type "${type}" declares ${concurrency}.`,
            });
        }
        this.#queues.set(queue, { concurrency });
        this.#queueByType.set(type, queue);
    }
    /**
     * Resolves once the job is handed off, without waiting for the handler to run:
     * after the outbox row is written when the outbox is active, otherwise after the
     * backend's enqueue call. With `transacting` the hand-off follows that
     * transaction's commit, so on the direct path dispatch resolves as soon as the
     * hand-off is scheduled and an enqueue failure is reported rather than thrown.
     * Resolution does not guarantee execution: the backend controls what happens to
     * work during shutdown.
     */
    async dispatch(job, { transacting } = {}) {
        const envelope = this.#buildEnvelope(job);
        const id = new bson_objectid_1.default().toHexString();
        if (this.#outbox) {
            const { store, relay } = this.#outbox;
            await store.insert({ id, envelope }, { transacting });
            // The relay's poll is only a fallback; this process wakes it for its
            // own rows once they are visible.
            (0, after_commit_1.afterCommit)(transacting, () => relay.wake(), () => { });
            return;
        }
        // Direct path. The backend cannot join the caller's transaction, so the
        // nearest safe equivalent is to hand the job over once that transaction
        // commits: never before the write is visible, and not at all on rollback.
        // A crash between commit and hand-off loses the job, as it always has on
        // this path. Callers get one dispatch API either way and need no check.
        await (0, after_commit_1.afterCommit)(transacting, () => this.#enqueueDirect(id, envelope, transacting !== undefined), () => { });
    }
    // After a commit the caller has moved on, so a failure is reported rather
    // than thrown. Without a transaction it rejects dispatch as before.
    async #enqueueDirect(id, envelope, deferred) {
        try {
            await this.#backend.enqueue(id, envelope);
        }
        catch (err) {
            if (!deferred) {
                throw err;
            }
            const type = envelope.payload.job.type;
            this.#logging.error(`[Background Job] ${type} failed to enqueue after commit`, err);
            this.#sentry?.captureException(err, { tags: { job_type: type } });
        }
    }
    async scheduleRecurring(job, schedule) {
        this.#assertValidCron(schedule.cron);
        const envelope = this.#buildEnvelope(job);
        await this.#backend.scheduleRecurring(envelope, schedule);
    }
    // later.parse.cron does not strictly validate: it silently coerces a
    // malformed expression into a bogus schedule (garbage -> every minute,
    // out-of-range -> clamped, an impossible date -> effectively never), so
    // validate up front and fail loudly instead.
    #assertValidCron(cron) {
        const result = (0, cron_validate_1.default)(cron, {
            preset: 'default', // the seconds field is not supported in the default preset
            override: { useSeconds: true },
        });
        if (!result.isValid()) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Invalid cron expression: ${JSON.stringify(cron)}.`,
            });
        }
    }
    async start() {
        await this.#backend.start({
            processor: (envelope) => this.#process(envelope),
            queues: Object.fromEntries(this.#queues),
            onSettled: this.#outbox?.tracker?.onSettled,
        });
        if (this.#outbox) {
            await this.#releaseSubmitted(this.#outbox);
            this.#outbox.relay.start();
            this.#scheduleLease(this.#outbox);
        }
        else if (this.#logOutboxUnavailable) {
            this.#logging.warn('[Jobs] services:jobs:outbox is enabled but the outbox is unavailable here (it needs MySQL); using the legacy direct-dispatch path.');
        }
        const backend = this.#backend.constructor.name;
        const outboxMode = this.#outboxMode();
        const described = outboxMode === 'retain' ? 'on, keeping rows until their job settles' : outboxMode;
        const timings = this.#outbox
            ? { poll_interval_ms: this.#outbox.pollIntervalMs, lease_ms: this.#outbox.leaseMs }
            : {};
        this.#logging.info({ system: { event: 'jobs.started', backend, outbox_mode: outboxMode, ...timings } }, `[Jobs] Started on ${backend} with the outbox ${described}`);
    }
    // Only the store that keeps rows until settlement gets a tracker
    #outboxMode() {
        if (!this.#outbox) {
            return 'off';
        }
        return this.#outbox.tracker ? 'retain' : 'on';
    }
    // A row nobody has renewed within the lease belongs to a process that has
    // stopped, so its job may be lost. Live processes keep renewing their rows,
    // so this is safe with several processes per site.
    async #releaseSubmitted({ store, leaseMs }) {
        const { released, dropped } = await store.releaseSubmitted({
            replays: (type) => !this.#notReplayed.has(type),
            staleAfterMs: leaseMs,
        });
        if (dropped.length > 0) {
            this.#logging.info({ system: { event: 'jobs_outbox.dropped', count: dropped.length, rows: dropped } }, `[Jobs Outbox] Dropped ${dropped.length} submitted rows whose job types recover on their own`);
        }
        if (released.length > 0) {
            this.#logging.info({ system: { event: 'jobs_outbox.released', count: released.length, rows: released } }, `[Jobs Outbox] Released ${released.length} submitted rows to hand over again`);
        }
    }
    // Every quarter of the lease, renews the rows of jobs the backend still
    // holds and hands over rows no process has renewed, such as those of a
    // process that stopped. A backend without heldIds dedupes by id, so its
    // stale rows are re-enqueued harmlessly.
    #scheduleLease(outbox) {
        this.#leaseTimer = setTimeout(() => {
            this.#leaseTick = this.#renewLease(outbox).then(() => {
                if (this.#leaseTimer) {
                    this.#scheduleLease(outbox);
                }
            });
        }, outbox.leaseMs / 4);
    }
    async #renewLease(outbox) {
        try {
            const held = this.#backend.heldIds?.() ?? [];
            if (held.length > 0) {
                await outbox.store.renew(held);
            }
            await this.#releaseSubmitted(outbox);
        }
        catch (error) {
            this.#logging.error('[Jobs Outbox] renewing or releasing submitted rows failed', error);
            this.#sentry?.captureException(error);
        }
    }
    async shutdown(options) {
        try {
            if (this.#outbox) {
                await this.#outbox.relay.stop();
            }
            await this.#backend.shutdown(options);
        }
        finally {
            // Renewal runs until the backend has drained, so a job still finishing
            // keeps its row
            clearTimeout(this.#leaseTimer);
            this.#leaseTimer = undefined;
            await this.#leaseTick;
        }
    }
    // An in-process restart (test harness) re-runs handler registration on the
    // same instance, so all registration state resets - handlers and queue
    // declarations alike. The duplicate-type guard still holds within a boot.
    clearHandlers() {
        this.#registry.clear();
        this.#queueByType.clear();
        this.#queues.clear();
        this.#notReplayed.clear();
    }
    #buildEnvelope(job) {
        const type = this.#typeOf(job);
        const jobEnvelope = { type, payload: JSON.stringify(job) };
        const queue = this.#queueByType.get(type);
        return {
            version: 1,
            payload: queue === undefined ? { job: jobEnvelope } : { job: jobEnvelope, routing: { queue } },
        };
    }
    #typeOf(job) {
        const ctor = job.constructor;
        const type = ctor.type;
        if (typeof type !== 'string' || type.length === 0) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Cannot dispatch job: ${ctor.name ?? 'job'} is missing a static "type" string.`,
            });
        }
        return type;
    }
    async #process(envelope) {
        const deliver = this.#registry.get(envelope.type);
        if (!deliver) {
            // Fail the delivery so a durable backend can keep or retry the job, e.g.
            // when an older container receives a new job type during a rolling deploy.
            // The backend logs the failed delivery, so this does not log as well.
            throw new errors_1.default.IncorrectUsageError({
                message: `No handler registered for job type "${envelope.type}"; failing delivery.`,
            });
        }
        // The outbox mode lets dashboards compare jobs on sites with the outbox on
        const fields = (event, extra = {}) => ({
            system: { event, job_type: envelope.type, outbox_mode: this.#outboxMode(), ...extra },
        });
        const startedAt = Date.now();
        this.#logging.info(fields('job.started'), `[Background Job] ${envelope.type} started`);
        let result;
        try {
            result = await deliver(envelope.payload);
        }
        catch (err) {
            const durationMs = Date.now() - startedAt;
            this.#logging.error(err, fields('job.failed', { duration_ms: durationMs }), `[Background Job] ${envelope.type} failed after ${durationMs}ms`);
            this.#sentry?.captureException(err, { tags: { job_type: envelope.type } });
            throw err;
        }
        const durationMs = Date.now() - startedAt;
        if (result === 'interrupted') {
            this.#logging.info(fields('job.interrupted', { duration_ms: durationMs }), `[Background Job] ${envelope.type} interrupted after ${durationMs}ms`);
            return 'interrupted';
        }
        this.#logging.info(fields('job.completed', { duration_ms: durationMs }), `[Background Job] ${envelope.type} completed in ${durationMs}ms`);
    }
}
exports.JobsService = JobsService;
