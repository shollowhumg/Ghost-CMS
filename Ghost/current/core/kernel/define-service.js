"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineService = defineService;
const errors_1 = require("@tryghost/errors");
function defineService(name, definition, extras) {
    const lifecycle = typeof definition === 'function' ? { create: definition } : definition;
    let created;
    // Set by the first successful start; stop() does not clear it.
    let ready = false;
    let started = false;
    let initialization;
    async function startService() {
        const { service } = (created ??= { service: await lifecycle.create() });
        try {
            await lifecycle.start?.(service);
        }
        catch (error) {
            await lifecycle.stop?.(service);
            throw error;
        }
        ready = true;
        started = true;
    }
    const root = {
        init() {
            initialization ??= startService().catch((error) => {
                initialization = undefined;
                throw error;
            });
            return initialization;
        },
        async stop() {
            if (!started || created === undefined) {
                return;
            }
            started = false;
            initialization = undefined;
            await lifecycle.stop?.(created.service);
        },
        get service() {
            if (!ready || created === undefined) {
                throw new errors_1.IncorrectUsageError({
                    message: `${name} used before init(). Call init() from boot first.`,
                });
            }
            return created.service;
        },
    };
    return extras === undefined ? root : Object.assign(root, { extras });
}
