"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.betterAuthRouter = betterAuthRouter;
const node_1 = require("better-auth/node");
const client_ip_1 = require("../../../../auth/better-auth/client-ip");
const express = require('../../../../../shared/express');
/** Serves Better Auth's native routes under `/auth/*`, which Better Auth rate limits itself. */
function betterAuthRouter(auth) {
    const router = express.Router('admin api better auth');
    router.all('/auth/*', client_ip_1.setClientIPHeader, (0, node_1.toNodeHandler)(auth));
    return router;
}
