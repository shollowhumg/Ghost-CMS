"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
// the config loader turns all-digit environment values into numbers
const credential = zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform(String).optional();
/**
 * Connection settings for one Redis client, for any area that talks to Redis.
 * Keys are ioredis option names, so the parsed value is the client's options.
 * Loose: any other ioredis option passes through unchecked.
 */
exports.redisConnection = zod_1.z.looseObject({
    host: zod_1.z.string().min(1).optional().meta({ description: 'Defaults to localhost.' }),
    port: primitives_1.tcpPort.optional().meta({ description: 'Defaults to 6379.' }),
    username: credential,
    password: credential,
    db: zod_1.z.number().int().nonnegative().optional().meta({ description: 'Database index.' }),
    tls: zod_1.z
        .union([zod_1.z.boolean(), zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())])
        .optional()
        // ioredis wants an options object
        .transform((tls) => (tls === true ? {} : tls || undefined))
        .meta({
        description: 'true for TLS with default options, or Node TLS connect options.',
        examples: [true, { servername: 'redis.example.com' }],
    }),
});
