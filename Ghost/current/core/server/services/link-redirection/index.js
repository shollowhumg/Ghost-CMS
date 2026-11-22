"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@tryghost/errors");
const define_service_1 = require("../../../kernel/define-service");
let linkRedirectRepository;
// Link tracking still reaches through for the repository to rebuild its post links.
// Narrowing it to the service API is a separate change, so the reach-through is transitional.
const extras = {
    linkRedirectRepository() {
        if (linkRedirectRepository === undefined) {
            throw new errors_1.IncorrectUsageError({
                message: 'Link redirection used before init(). Call init() from boot first.',
            });
        }
        return linkRedirectRepository;
    },
};
// Runs in the frontend services phase so the route mounts a ready handler and link tracking
// finds its repository. Models and the cache adapter are only available once boot reaches it.
exports.default = (0, define_service_1.defineService)('Link redirection', () => {
    const config = require('../../../shared/config');
    const urlUtils = require('../../../shared/url-utils').default;
    const adapterManager = require('../adapter-manager').default;
    const EventRegistry = require('../../lib/common/events');
    const DomainEvents = require('@tryghost/domain-events');
    const models = require('../../models');
    const LinkRedirectRepository = require('./link-redirect-repository');
    const LinkRedirectsService = require('./link-redirects-service');
    // Parse the site URL before the repository registers its cache listener, so an invalid URL
    // fails init() without leaving a listener behind for the retry.
    const baseURL = new URL(urlUtils.getSiteUrl());
    const repository = new LinkRedirectRepository({
        LinkRedirect: models.Redirect,
        urlUtils,
        cacheAdapter: config.get('hostSettings:linkRedirectsPublicCache:enabled')
            ? adapterManager.getAdapter('cache:linkRedirectsPublic')
            : null,
        EventRegistry,
    });
    const service = new LinkRedirectsService({
        linkRedirectRepository: repository,
        DomainEvents,
        config: {
            baseURL,
        },
    });
    linkRedirectRepository = repository;
    return service;
}, extras);
