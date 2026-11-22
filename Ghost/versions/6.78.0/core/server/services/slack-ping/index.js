"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const define_service_1 = require("../../../kernel/define-service");
const slack_ping_service_1 = require("./slack-ping-service");
exports.default = (0, define_service_1.defineService)('Slack ping', {
    create: () => new slack_ping_service_1.SlackPingService({
        blogIcon: require('../../lib/image').blogIcon,
        events: require('../../lib/common/events'),
        logging: require('@tryghost/logging'),
        request: require('../../lib/request-external'),
        settingsCache: require('../../../shared/settings-cache'),
        urlService: require('../url'),
        urlUtils: require('../../../shared/url-utils').default,
    }),
    start: (service) => service.subscribeEvents(),
    // Also removes the listeners of a partial subscription when start fails.
    stop: (service) => service.unsubscribeEvents(),
});
