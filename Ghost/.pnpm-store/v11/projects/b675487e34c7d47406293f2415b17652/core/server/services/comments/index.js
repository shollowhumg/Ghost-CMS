"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const errors_1 = require("@tryghost/errors");
const define_service_1 = require("../../../kernel/define-service");
// The renderer reads its HTML template on every send. The reader closes over this fixed
// map, so the renderer can read exactly these files and nothing else.
const TEMPLATE_FILES = {
    'new-comment': './email-templates/new-comment.hbs',
    'new-comment-reply': './email-templates/new-comment-reply.hbs',
    report: './email-templates/report.hbs',
};
function readTemplate(name) {
    if (!Object.hasOwn(TEMPLATE_FILES, name)) {
        throw new errors_1.IncorrectUsageError({
            message: `Unknown comment email template: ${String(name)}`,
        });
    }
    return (0, promises_1.readFile)(node_path_1.default.join(__dirname, TEMPLATE_FILES[name]), 'utf8');
}
exports.default = (0, define_service_1.defineService)('Comments', () => {
    const CommentsService = require('./comments-service');
    const CommentsController = require('./comments-controller');
    const CommentsStats = require('./comments-stats-service');
    const config = require('../../../shared/config');
    const logging = require('@tryghost/logging');
    const models = require('../../models');
    const { GhostMailer } = require('../../lib/mail');
    const settingsCache = require('../../../shared/settings-cache');
    const settingsHelpers = require('../settings-helpers');
    const urlService = require('../url');
    const urlUtils = require('../../../shared/url-utils').default;
    const membersService = require('../members');
    const db = require('../../data/db');
    const DomainEvents = require('@tryghost/domain-events');
    const { MemberCommentEvent } = require('../../../shared/events');
    const { byNQL } = require('../../models/base/plugins/bulk-filters');
    const { t } = require('../../../shared/i18n');
    const emailService = require('../email-service');
    const api = new CommentsService({
        config,
        logging,
        models,
        mailer: new GhostMailer(),
        settingsCache,
        settingsHelpers,
        urlService,
        urlUtils,
        contentGating: membersService.contentGating,
        DomainEvents,
        MemberCommentEvent,
        byNQL,
        t,
        // Email's renderer exists only once that service has initialized, which
        // happens alongside this one; resolve it when a reply notification is sent.
        createUnsubscribeUrl: (uuid, options) => emailService.renderer.createUnsubscribeUrl(uuid, options),
        readTemplate,
    });
    const controller = new CommentsController(api, new CommentsStats({ db }));
    return { api, controller };
});
