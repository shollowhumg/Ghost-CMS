"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxTracker = void 0;
// Ends an outbox row's life once its job has settled, completed or dead. The
// row stays until then so a job lost after hand-off can be handed over again.
class OutboxTracker {
    #store;
    #logging;
    constructor({ store, logging }) {
        this.#store = store;
        this.#logging = logging;
    }
    // A failure leaves the row to be handed over again; it never changes the
    // job's own outcome
    onSettled = async (id, _settlement) => {
        try {
            await this.#store.remove(id);
        }
        catch (err) {
            this.#logging.error(err, `[Jobs Outbox] job ${id} settled but its row remains`);
        }
    };
}
exports.OutboxTracker = OutboxTracker;
