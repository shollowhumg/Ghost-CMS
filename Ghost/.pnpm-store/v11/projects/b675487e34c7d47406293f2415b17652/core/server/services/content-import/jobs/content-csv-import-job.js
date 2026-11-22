"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class ContentCSVImportJob extends job_1.Job {
    static type = 'content-csv-import';
    importId;
    file;
    mapping;
    importTagNames;
    emailRecipient;
    total;
    constructor(data) {
        super();
        this.importId = data.importId;
        this.file = data.file;
        this.mapping = data.mapping;
        this.importTagNames = data.importTagNames;
        this.emailRecipient = data.emailRecipient;
        this.total = data.total ?? 0;
    }
}
exports.default = ContentCSVImportJob;
