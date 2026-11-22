"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class SendEmailJob extends job_1.Job {
    static type = 'send-email';
    // The newsletter boot scan recovers interrupted sends after checking their
    // age and post. A replayed job would skip those checks and race the scan.
    static replayAfterRestart = false;
    emailId;
    constructor({ emailId }) {
        super();
        this.emailId = emailId;
    }
}
exports.default = SendEmailJob;
