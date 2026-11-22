"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_framework_1 = require("@tryghost/api-framework");
const debug_1 = __importDefault(require("@tryghost/debug"));
const debug = (0, debug_1.default)('api:endpoints:utils:serializers:input:exports');
const optionsUtil = api_framework_1.utils.options;
module.exports = {
    download(apiConfig, frame) {
        debug('download');
        // `components` arrives as a comma-separated string, or as an array
        // when the query param is repeated; absent stays absent
        if (frame.options.components !== undefined) {
            frame.options.components = optionsUtil
                .trimAndLowerCase(frame.options.components)
                .filter((component) => component !== '');
        }
    },
};
