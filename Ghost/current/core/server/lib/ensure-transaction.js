"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionOf = transactionOf;
exports.ensureTransaction = ensureTransaction;
/**
 * The transaction `executor` is, or undefined when `executor` is a plain connection.
 *
 * Knex sets `executionPromise` on a transaction before it runs anything inside that transaction,
 * and never sets `executionPromise` on a plain connection.
 */
function transactionOf(executor) {
    return 'executionPromise' in executor ? executor : undefined;
}
/**
 * Runs `fn` inside one transaction, so everything `fn` writes is stored together or not at all.
 *
 * When `executor` is already a transaction, `fn` joins that transaction: `fn` is handed the same
 * transaction, nothing is committed here, and a failure in `fn` is the caller's to roll back.
 * When `executor` is a plain connection, a new transaction is opened on it, committed when `fn`
 * resolves and rolled back when `fn` rejects.
 *
 * Joining never opens a savepoint, which is what calling `transaction()` on a transaction does.
 * A savepoint can be rolled back while the transaction around it still commits, and its
 * `executionPromise` resolves when the savepoint is released rather than when the transaction
 * commits, so work waiting for the commit would run too early.
 */
function ensureTransaction(executor, fn) {
    const joined = transactionOf(executor);
    return joined ? fn(joined) : executor.transaction(fn);
}
