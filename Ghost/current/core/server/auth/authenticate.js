"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const session = require('./session').default;
const apiKeyAuth = require('./api-key');
const members = require('./members');
const authenticate = {
    authenticateAdminApi: [apiKeyAuth.admin.authenticate, session.authenticate],
    authenticateAdminApiWithUrl: [apiKeyAuth.admin.authenticateWithUrl],
    authenticateContentApi: [
        apiKeyAuth.content.authenticateContentApiKey,
        members.authenticateMembersToken,
    ],
};
exports.default = authenticate;
