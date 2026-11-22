"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PASSWORD_PLACEHOLDER = void 0;
exports.readPasswordHash = readPasswordHash;
exports.writePasswordHash = writePasswordHash;
const enabled_1 = require("./enabled");
const ghost_models_1 = require("./ghost-models");
// Legacy password store (plan §4.5): the `credential` row in `user_accounts`
// with auth:betterAuthDev, otherwise `users.password`
/** `users.password` once the credential row holds the hash; never a valid bcrypt hash */
exports.PASSWORD_PLACEHOLDER = '!';
/**
 * The user's password hash. A user without a credential row gets the
 * placeholder, which no password matches.
 */
async function readPasswordHash(executor, user, { forUpdate = false } = {}) {
    if (!(0, enabled_1.usesBetterAuth)()) {
        return user.password ?? exports.PASSWORD_PLACEHOLDER;
    }
    const query = executor('user_accounts')
        .where({ provider_id: 'credential', account_id: user.id })
        .first('password');
    const account = await (forUpdate ? query.forUpdate() : query);
    return account?.password ?? exports.PASSWORD_PLACEHOLDER;
}
/**
 * Stores a user's new hash in their credential row, creating it if missing.
 * Pass the user write's transaction so both commit together.
 *
 * Not an upsert: `ON DUPLICATE KEY UPDATE` takes next-key locks that deadlock
 * concurrent user inserts in MySQL. `isNew` skips straight to the insert.
 */
async function writePasswordHash(executor, userId, hash, { isNew = false } = {}) {
    const now = new Date();
    if (!isNew) {
        const updated = await executor('user_accounts')
            .where({ provider_id: 'credential', account_id: userId })
            .update({ password: hash, updated_at: now });
        if (updated) {
            return;
        }
    }
    await executor('user_accounts').insert({
        id: (0, ghost_models_1.generateGhostId)(),
        user_id: userId,
        account_id: userId,
        provider_id: 'credential',
        password: hash,
        created_at: now,
        updated_at: now,
    });
}
