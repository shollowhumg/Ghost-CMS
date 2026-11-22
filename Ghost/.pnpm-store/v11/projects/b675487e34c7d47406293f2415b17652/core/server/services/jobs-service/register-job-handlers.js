"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = registerJobHandlers;
const email_analytics_gift_fetch_latest_job_1 = __importDefault(require("../email-analytics/jobs/email-analytics-gift-fetch-latest-job"));
const email_analytics_automation_fetch_latest_job_1 = __importDefault(require("../email-analytics/jobs/email-analytics-automation-fetch-latest-job"));
const email_analytics_fetch_latest_job_1 = __importDefault(require("../email-analytics/jobs/email-analytics-fetch-latest-job"));
const clean_tokens_job_1 = __importDefault(require("../members/jobs/clean-tokens-job"));
const clean_expired_comped_job_1 = __importDefault(require("../members/jobs/clean-expired-comped-job"));
const clean_gifts_job_1 = __importDefault(require("../gifts/jobs/clean-gifts-job"));
const send_gift_reminders_job_1 = __importDefault(require("../gifts/jobs/send-gift-reminders-job"));
const external_media_inliner_job_1 = __importDefault(require("../media-inliner/external-media-inliner-job"));
const content_csv_import_job_1 = __importDefault(require("../content-import/jobs/content-csv-import-job"));
const content_import_job_1 = __importDefault(require("../../data/importer/jobs/content-import-job"));
const members_import_job_1 = __importDefault(require("../members/jobs/members-import-job"));
const update_check_job_1 = __importDefault(require("../update-check/jobs/update-check-job"));
const tinybird_sync_job_1 = __importDefault(require("../tinybird-sync/jobs/tinybird-sync-job"));
const process_webmention_job_1 = __importDefault(require("../mentions/process-webmention-job"));
const send_webmentions_job_1 = __importDefault(require("../mentions/send-webmentions-job"));
const send_email_job_1 = __importDefault(require("../email-service/jobs/send-email-job"));
const check_signing_keys_job_1 = __importDefault(require("../signing-keys/check-signing-keys-job"));
// Webmention processing fetches external pages and is triggered by
// unauthenticated requests, so webmention jobs run in their own lane where a
// flood cannot occupy the shared workers. The concurrency matches the old
// dedicated mentions job queue. Every webmention job type must register with
// this shared declaration so none can declare the queue with a different
// concurrency.
const WEBMENTIONS_QUEUE = { queue: 'webmentions', concurrency: 3 };
// Keep newsletter sends independent of imports and other shared work. Two sends
// can progress at once, each with its own two batch workers, so a long send or
// retry does not hold up every other newsletter.
const EMAIL_QUEUE = { queue: 'email', concurrency: 2 };
function registerJobHandlers({ jobsService, gifts, automationAnalytics, newsletters, memberJobs, giftService, mediaInliner, mentionsController, mentionsSendingService, membersService, emailService, siteImporter, tinybirdSync, contentImport, updateCheck, signingKeys, }) {
    // Each email analytics pipeline fetches on its own five-minute tick and the
    // wrapper skips a tick while its previous fetch is still running. The second
    // slot lets an overlapping tick reach that guard and be skipped straight away
    // instead of queueing behind the running fetch and firing late.
    for (const [JobClass, pipeline] of [
        [email_analytics_fetch_latest_job_1.default, newsletters],
        [email_analytics_automation_fetch_latest_job_1.default, automationAnalytics],
        [email_analytics_gift_fetch_latest_job_1.default, gifts],
    ]) {
        jobsService.handle(JobClass, () => pipeline.startFetch(), {
            queue: JobClass.type,
            concurrency: 2,
        });
    }
    jobsService.handle(clean_tokens_job_1.default, async () => {
        await memberJobs.cleanTokens();
    });
    jobsService.handle(clean_expired_comped_job_1.default, async () => {
        await memberJobs.cleanExpiredComped();
    });
    jobsService.handle(clean_gifts_job_1.default, async () => {
        await giftService.cleanup();
    });
    jobsService.handle(send_gift_reminders_job_1.default, async () => {
        await giftService.processReminders();
    });
    jobsService.handle(external_media_inliner_job_1.default, async (job) => {
        await mediaInliner.inline(job.domains);
    });
    jobsService.handle(content_csv_import_job_1.default, async (job) => {
        await contentImport.handleJob(job);
    });
    jobsService.handle(content_import_job_1.default, async (job) => {
        await siteImporter.executeImport(job);
    });
    jobsService.handle(members_import_job_1.default, async (job) => {
        await membersService.handleImportJob(job);
    });
    jobsService.handle(update_check_job_1.default, async () => {
        await updateCheck({ rethrowErrors: true });
    });
    jobsService.handle(check_signing_keys_job_1.default, async () => {
        await signingKeys.check();
    });
    jobsService.handle(process_webmention_job_1.default, async (job) => {
        await mentionsController.processWebmention(job);
    }, WEBMENTIONS_QUEUE);
    jobsService.handle(send_webmentions_job_1.default, async (job) => {
        await mentionsSendingService.sendWebmentions(job);
    }, WEBMENTIONS_QUEUE);
    jobsService.handle(send_email_job_1.default, async (job) => emailService.handleSendEmailJob(job), EMAIL_QUEUE);
    jobsService.handle(tinybird_sync_job_1.default, async () => {
        await tinybirdSync.sync();
    }, { queue: tinybird_sync_job_1.default.type, concurrency: 1 });
}
