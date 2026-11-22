"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const manifest_1 = require("@tryghost/app-contracts/manifest");
const define_service_1 = require("../../../kernel/define-service");
const explore_ping_service_1 = require("./explore-ping-service");
exports.default = (0, define_service_1.defineService)('Explore ping', () => {
    const config = require('../../../shared/config');
    const service = new explore_ping_service_1.ExplorePingService({
        settingsCache: require('../../../shared/settings-cache'),
        config,
        logging: require('@tryghost/logging'),
        request: require('@tryghost/request'),
        posts: require('../posts/posts-service-instance')(),
        members: require('../members'),
        statsService: require('../stats').default.service,
    });
    // The explore ping is a background "phone home" request. It should not run
    // in the test environment (cf. the update-check service, which gates on the
    // same environments), where there is no explore URL configured, or for local
    // site URLs, which Explore rejects.
    // The final intention is to have this run on a schedule. For the initial
    // version, ping when the server starts, without waiting for the response.
    if (config.isProductionOrDevelopment() && !(0, manifest_1.isLocalhost)(new URL(config.get('url')).hostname)) {
        service.ping();
    }
    return service;
});
