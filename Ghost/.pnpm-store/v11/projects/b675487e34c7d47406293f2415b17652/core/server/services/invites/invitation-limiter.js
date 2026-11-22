"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = __importDefault(require("@tryghost/errors"));
const INVITE_EMAIL_COUNTER_KEY = 'invite_emails_limit_usage';
class InvitationLimiter {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    isLimited() {
        return (this.deps.limitService.isLimited('allStaff') ||
            this.deps.limitService.isLimited('inviteEmails'));
    }
    async run(email, prepare) {
        if (!this.isLimited()) {
            return prepare();
        }
        return this.deps.transaction(async (transaction) => {
            const counterValue = await this.getAndLockInviteEmailCounter(transaction);
            const options = { transacting: transaction };
            if (this.deps.limitService.isLimited('inviteEmails')) {
                await this.reserveEmail(transaction, counterValue);
            }
            // Replacing a pending invitation does not occupy another seat, even after an import.
            if (this.deps.limitService.isLimited('allStaff')) {
                const existingInvite = await transaction('invites')
                    .where('email', email.trim())
                    .forUpdate()
                    .first('id');
                if (!existingInvite) {
                    await this.deps.limitService.errorIfWouldGoOverLimit('allStaff', options);
                }
            }
            return prepare(transaction);
        });
    }
    async getAndLockInviteEmailCounter(transaction) {
        const setting = await this.deps.Settings.findOne({ key: INVITE_EMAIL_COUNTER_KEY }, { transacting: transaction, forUpdate: true });
        if (!setting) {
            throw new errors_1.default.InternalServerError({
                message: 'Cannot lock the staff invitation email counter.',
            });
        }
        return setting.get('value');
    }
    async reserveEmail(transaction, counterValue) {
        const periodStart = this.deps.getPeriodStart();
        await this.deps.limitService.errorIfWouldGoOverLimit('inviteEmails', {
            transacting: transaction,
        });
        await this.incrementEmailCounter(transaction, counterValue, periodStart);
    }
    async incrementEmailCounter(transaction, counterValue, periodStart) {
        const previous = JSON.parse(counterValue ?? 'null');
        const count = previous?.periodStart === periodStart ? previous.count : 0;
        // The invitation and reservation commit together. Delivery happens afterwards.
        await transaction('settings')
            .where('key', INVITE_EMAIL_COUNTER_KEY)
            .update({ value: JSON.stringify({ periodStart, count: count + 1 }) });
    }
}
exports.default = InvitationLimiter;
