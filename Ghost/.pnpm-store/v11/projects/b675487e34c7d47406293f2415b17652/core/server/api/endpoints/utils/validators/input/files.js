"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const limits_1 = require("../../../../../services/limits");
module.exports = {
    async upload(apiConfig, frame) {
        await limits_1.limitService.errorIfIsOverLimit('uploads', { currentCount: frame.file.size });
    },
};
