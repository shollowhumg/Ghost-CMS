"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const define_service_1 = require("../../../kernel/define-service");
const users_service_1 = require("./users-service");
// Runs in the services phase: the users and authentication endpoints read the ready instance
// per request, and the update check may load the users endpoint before any Admin request.
exports.default = (0, define_service_1.defineService)('Users', () => {
    const revisions = require('../../lib/post-revisions');
    return new users_service_1.UsersService({
        models: require('../../models'),
        DomainEvents: require('@tryghost/domain-events'),
        PostsBulkAddTagsEvent: require('../../../shared/events-ts').PostsBulkAddTagsEvent,
        removeAuthorFromRevisions: revisions.removeAuthorFromRevisions,
    });
});
