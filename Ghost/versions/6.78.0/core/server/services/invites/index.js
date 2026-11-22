"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const limit_service_1 = require("@tryghost/limit-service");
const config_1 = __importDefault(require("../../../shared/config"));
const define_service_1 = require("../../../kernel/define-service");
const invites_1 = require("./invites");
const invitation_limiter_1 = __importDefault(require("./invitation-limiter"));
exports.default = (0, define_service_1.defineService)('Invites', () => {
    const { limitService } = require('../limits');
    const settingsCache = require('../../../shared/settings-cache');
    const settingsHelpers = require('../settings-helpers');
    const mailService = require('../../lib/mail');
    const urlUtils = require('../../../shared/url-utils').default;
    const models = require('../../models');
    const logging = require('@tryghost/logging');
    return new invites_1.Invites({
        settingsCache,
        settingsHelpers,
        mailService,
        urlUtils,
        models,
        logging,
        invitationLimiter: new invitation_limiter_1.default({
            transaction: (callback) => models.Base.transaction(callback),
            limitService,
            Settings: models.Settings,
            getPeriodStart: () => config_1.default.get('hostSettings:limits:inviteEmails:maxPeriodic') !== undefined
                ? (0, limit_service_1.lastPeriodStart)(config_1.default.get('hostSettings:subscription:start'), 'month')
                : null,
        }),
    });
});
