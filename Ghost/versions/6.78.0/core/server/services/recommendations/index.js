"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const define_service_1 = require("../../../kernel/define-service");
const recommendation_url_1 = require("./recommendation-url");
// Boot awaits Mentions before this root, so the facade is ready here. Every
// construction failure happens before the detached refreshes, the mentions mapper
// and the event subscription, so a failed attempt leaves nothing to release.
exports.default = (0, define_service_1.defineService)('Recommendations', () => {
    const { BookshelfRecommendationRepository, RecommendationService, RecommendationController, WellknownService, WellknownController, BookshelfClickEventRepository, IncomingRecommendationController, IncomingRecommendationService, IncomingRecommendationEmailRenderer, RecommendationMetadataService, } = require('./service');
    const RecommendationEnablerService = require('./recommendation-enabler-service');
    const config = require('../../../shared/config');
    const logging = require('@tryghost/logging');
    const sentry = require('../../../shared/sentry');
    const urlUtils = require('../../../shared/url-utils').default;
    const models = require('../../models');
    const mail = require('../../lib/mail');
    const externalRequest = require('../../lib/request-external');
    const DomainEvents = require('@tryghost/domain-events');
    const MentionCreatedEvent = require('../mentions/mention-created-event');
    const mentions = require('../mentions').default;
    const oembedService = require('../oembed');
    const settings = require('../settings');
    const staff = require('../staff').default;
    // The renderer reads the ready Staff service for each email.
    const staffService = {
        get api() {
            return staff.service;
        },
    };
    const mentionsFacade = mentions.service;
    const recommendationEnablerService = new RecommendationEnablerService({
        settingsService: settings.getSettingsBREADServiceInstance(),
    });
    const repository = new BookshelfRecommendationRepository(models.Recommendation, {
        sentry,
        logging,
    });
    const clickEventRepository = new BookshelfClickEventRepository(models.RecommendationClickEvent, {
        sentry,
        logging,
    });
    const subscribeEventRepository = new BookshelfClickEventRepository(models.RecommendationSubscribeEvent, {
        sentry,
        logging,
    });
    const service = new RecommendationService({
        repository,
        recommendationEnablerService,
        wellknownService: new WellknownService({ urlUtils }),
        mentionSendingService: mentionsFacade.sendingService,
        clickEventRepository,
        subscribeEventRepository,
        recommendationMetadataService: new RecommendationMetadataService({
            oembedService,
            externalRequest,
        }),
        logging,
    });
    const mailer = new mail.GhostMailer();
    const incomingRecommendationService = new IncomingRecommendationService({
        mentionsApi: mentionsFacade.api,
        recommendationService: service,
        emailService: {
            async send(to, subject, html, text) {
                return mailer.send({ to, subject, html, text });
            },
        },
        async getEmailRecipients() {
            const users = await models.User.getEmailAlertUsers('recommendation-received');
            return users.map((model) => {
                return {
                    email: model.email,
                    slug: model.slug,
                };
            });
        },
        emailRenderer: new IncomingRecommendationEmailRenderer({ staffService }),
        logging,
    });
    const result = {
        controller: new RecommendationController({ service }),
        wellknownController: new WellknownController({ service }),
        incomingRecommendationController: new IncomingRecommendationController({
            service: incomingRecommendationService,
        }),
    };
    // Side effects come last, in this order; nothing above needs unwinding when it throws.
    if (config.get('services:recommendations:enabled') === false) {
        logging.info('[Recommendations] Background refreshes are disabled via config');
    }
    else {
        service.init().catch(logging.error);
        incomingRecommendationService.init().catch(logging.error);
    }
    mentionsFacade.metadata.addMapper((url) => {
        if ((0, recommendation_url_1.isRecommendationUrl)(url)) {
            const newUrl = new URL(url.toString());
            newUrl.pathname = newUrl.pathname.slice(0, -recommendation_url_1.PATH_SUFFIX.length);
            return newUrl;
        }
    });
    DomainEvents.subscribe(MentionCreatedEvent, async (event) => {
        if (event.data.mention.verified && (0, recommendation_url_1.isRecommendationUrl)(event.data.mention.source)) {
            logging.info('[INCOMING RECOMMENDATION] Received recommendation from ' + event.data.mention.source);
            await incomingRecommendationService.sendRecommendationEmail(event.data.mention);
        }
    });
    return result;
});
