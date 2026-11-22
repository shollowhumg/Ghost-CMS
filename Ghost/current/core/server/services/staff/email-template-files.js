"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStaffEmailTemplateFiles = createStaffEmailTemplateFiles;
const errors_1 = require("@tryghost/errors");
// Relative to the service's email-templates directory. The renderer can read
// exactly these files: an HTML template per notification and the shared partials.
const TEMPLATES = {
    donation: 'donation.hbs',
    gift: 'gift.hbs',
    'new-free-signup': 'new-free-signup.hbs',
    'new-gift-subscription': 'new-gift-subscription.hbs',
    'new-milestone-received': 'new-milestone-received.hbs',
    'new-paid-cancellation': 'new-paid-cancellation.hbs',
    'new-paid-started': 'new-paid-started.hbs',
    'recommendation-received': 'recommendation-received.hbs',
};
const PARTIALS = {
    preview: 'partials/preview.hbs',
    styles: 'partials/styles.hbs',
};
function isTemplateName(name) {
    return Object.hasOwn(TEMPLATES, name);
}
/**
 * Restricts template reads to the fixed staff files. The caller supplies readers
 * scoped to the email-templates directory, so this module performs no I/O itself.
 */
function createStaffEmailTemplateFiles({ readFile, readFileSync, }) {
    return {
        async readTemplate(name) {
            if (!isTemplateName(name)) {
                throw new errors_1.IncorrectUsageError({
                    message: `Unknown staff email template: ${name}`,
                });
            }
            return readFile(TEMPLATES[name]);
        },
        readPartials() {
            return Object.entries(PARTIALS).map(([name, file]) => ({
                name,
                source: readFileSync(file),
            }));
        },
    };
}
