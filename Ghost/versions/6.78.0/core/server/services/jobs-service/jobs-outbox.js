"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsOutbox = exports.OutboxEnvelope = void 0;
const zod_1 = require("zod");
const date_1 = require("../../lib/db-types/date");
const json_1 = require("../../lib/db-types/json");
const TABLE = 'jobs_outbox';
// knex's generated name for the schema's ['submitted_at', 'available_at'] index on this table.
const CLAIM_INDEX = 'jobs_outbox_submitted_at_available_at_index';
exports.OutboxEnvelope = (0, json_1.DbJson)(zod_1.z.object({
    version: zod_1.z.literal(1),
    payload: zod_1.z.object({
        job: zod_1.z.object({ type: zod_1.z.string(), payload: zod_1.z.string() }),
        routing: zod_1.z.object({ queue: zod_1.z.string().optional() }).optional(),
    }),
}), { message: 'The stored jobs outbox envelope is not JSON.' });
// The row as the claim query returns it, validated before anything trusts it.
const ClaimedRow = zod_1.z.object({ id: zod_1.z.string(), envelope: zod_1.z.string(), created_at: date_1.DbDate });
const SubmittedRow = zod_1.z.object({ id: zod_1.z.string(), envelope: zod_1.z.string() });
// The job type of a submitted row, or null when its envelope cannot be read.
function typeOf(stored) {
    const result = zod_1.z.safeDecode(exports.OutboxEnvelope, stored);
    return result.success ? result.data.payload.job.type : null;
}
// A row whose type cannot be read is released, so the relay's retry path
// deals with it once it is claimed.
function partitionByReplay(rows, replays) {
    const outcome = { released: [], dropped: [] };
    for (const row of rows) {
        (row.type === null || replays(row.type) ? outcome.released : outcome.dropped).push(row);
    }
    return outcome;
}
// MySQL rounds a fractional DATETIME on insert, which can round available_at up
// and leave a freshly inserted row briefly ineligible.
function floorToSecond(date) {
    return new Date(Math.floor(date.getTime() / 1000) * 1000);
}
class JobsOutbox {
    #knex;
    #keepUntilSettled;
    constructor({ knex, keepUntilSettled }) {
        this.#knex = knex;
        this.#keepUntilSettled = keepUntilSettled;
    }
    async insert({ id, envelope }, { transacting } = {}) {
        const now = floorToSecond(new Date());
        const row = {
            id,
            envelope: zod_1.z.encode(exports.OutboxEnvelope, envelope),
            created_at: now,
            available_at: now,
        };
        const query = this.#knex(TABLE).insert(row);
        await (transacting ? query.transacting(transacting) : query);
    }
    async processNext(submit, { retryDelayMs }) {
        return this.#knex.transaction(async (trx) => {
            // InnoDB locks every row a locking read examines, not just the row it
            // returns. Left to the optimizer, a small table (or stale statistics
            // after a truncate) gets a table scan plus filesort, which reads and
            // locks every eligible row before the LIMIT applies, so one relay
            // holding a row starves the others and blocks inserts. Forcing the
            // claim index makes the scan stop at the first unlocked row, and
            // start past the rows already handed over.
            const raw = await trx
                .select('id', 'envelope', 'created_at')
                .from(trx.raw('?? force index (??)', [TABLE, CLAIM_INDEX]))
                .whereNull('submitted_at')
                .where('available_at', '<=', new Date())
                .orderBy([{ column: 'available_at' }, { column: 'id' }])
                .forUpdate()
                .skipLocked()
                .first();
            if (!raw) {
                return { status: 'idle' };
            }
            // A row that does not match the schema means drift that will hit every
            // row, so it throws out of the claim rather than taking the per-row
            // retry path, which needs a trusted id.
            const { id, envelope: stored, created_at: createdAt } = ClaimedRow.parse(raw);
            // Decoding is inside the try so a row that cannot be read takes the same
            // retry path as a rejected submission, instead of throwing out of the
            // transaction and being re-claimed first on every poll.
            let type;
            try {
                const envelope = zod_1.z.decode(exports.OutboxEnvelope, stored);
                type = envelope.payload.job.type;
                await submit(id, envelope);
            }
            catch (error) {
                await trx(TABLE)
                    .where('id', id)
                    .update({ available_at: new Date(Date.now() + retryDelayMs) });
                return { status: 'failed', id, error };
            }
            // If the process dies before this commits, the claim rolls back and the
            // row is handed over again, so the job can run twice either way.
            const handedOff = trx(TABLE).where('id', id);
            // A kept row stays, marked submitted, until its job settles. submitted_at
            // is a lease on the database clock, so containers on different servers
            // agree on when it has gone stale.
            await (this.#keepUntilSettled
                ? handedOff.update({ submitted_at: trx.raw('UTC_TIMESTAMP()') })
                : handedOff.delete());
            return { status: 'delivered', id, type, createdAt };
        });
    }
    async remove(id) {
        await this.#knex(TABLE).where('id', id).delete();
    }
    // Keeps the rows of jobs a live process still holds from going stale
    async renew(ids) {
        if (ids.length === 0) {
            return;
        }
        await this.#knex(TABLE)
            .whereIn('id', ids)
            .whereNotNull('submitted_at')
            .update({ submitted_at: this.#knex.raw('UTC_TIMESTAMP()') });
    }
    // Hands over again rows no process has renewed within staleAfterMs. A job
    // type that is not replayed has its own recovery, so its rows are deleted
    // rather than handed over again.
    async releaseSubmitted({ replays, staleAfterMs, }) {
        // Every statement re-checks staleness, so a renewal that lands between
        // the read and the write keeps its row.
        const stale = () => this.#knex(TABLE)
            .whereNotNull('submitted_at')
            .whereRaw('submitted_at < UTC_TIMESTAMP() - INTERVAL ? MICROSECOND', [staleAfterMs * 1000]);
        const rows = zod_1.z.array(SubmittedRow).parse(await stale().select('id', 'envelope'));
        const outcome = partitionByReplay(rows.map(({ id, envelope }) => ({ id, type: typeOf(envelope) })), replays);
        const ids = (list) => list.map(({ id }) => id);
        if (outcome.released.length > 0) {
            await stale().whereIn('id', ids(outcome.released)).update({ submitted_at: null });
        }
        if (outcome.dropped.length > 0) {
            await stale().whereIn('id', ids(outcome.dropped)).delete();
        }
        return outcome;
    }
}
exports.JobsOutbox = JobsOutbox;
