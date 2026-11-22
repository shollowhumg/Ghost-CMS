"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOutboxConfig = getOutboxConfig;
const zod_1 = require("zod");
const schema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    // Keeps each row until its job settles, so a job cut short by a restart is
    // handed over again once its lease runs out. Off, the row goes at hand-off.
    keepUntilSettled: zod_1.z.boolean().default(false),
    // A fallback: dispatches in this process wake the relay on commit, so the
    // poll only picks up retries and rows written by another process.
    pollIntervalMs: zod_1.z.number().int().positive().default(30000),
    submissionTimeoutMs: zod_1.z.number().int().positive().default(10000),
    retryDelayMs: zod_1.z.number().int().positive().default(30000),
    // How long a submitted row can go without its holder renewing it before
    // another process hands it over again. submitted_at has one-second precision
    // and is renewed every quarter lease, so a shorter lease could expire between
    // renewals.
    leaseMs: zod_1.z.number().int().min(2000).default(120000),
});
function getOutboxConfig(config) {
    return schema.parse(config.get('services:jobs:outbox') ?? {});
}
