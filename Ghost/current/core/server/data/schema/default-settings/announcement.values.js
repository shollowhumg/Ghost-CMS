"use strict";
// Allowed values for the announcement settings. default-settings.json can't import these,
// so a unit test keeps its announcement_background isIn list in sync.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANNOUNCEMENT_BACKGROUND_VALUES = exports.ANNOUNCEMENT_VISIBILITY_VALUES = exports.ANNOUNCEMENT_VISIBILITY = void 0;
exports.ANNOUNCEMENT_VISIBILITY = {
    VISITORS: 'visitors',
    FREE_MEMBERS: 'free_members',
    PAID_MEMBERS: 'paid_members',
};
exports.ANNOUNCEMENT_VISIBILITY_VALUES = Object.values(exports.ANNOUNCEMENT_VISIBILITY);
exports.ANNOUNCEMENT_BACKGROUND_VALUES = ['accent', 'dark', 'light'];
