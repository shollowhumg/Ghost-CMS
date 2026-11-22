"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_framework_1 = require("@tryghost/api-framework");
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("@tryghost/debug"));
const debug = (0, debug_1.default)('api:endpoints:utils:serializers:input:db');
const optionsUtil = api_framework_1.utils.options;
const INTERNAL_OPTIONS = ['transacting', 'forUpdate'];
module.exports = {
    all(apiConfig, frame) {
        debug('serialize all');
        if (frame.options.include) {
            frame.options.include = optionsUtil.trimAndLowerCase(frame.options.include);
        }
        if (!frame.options.context.internal) {
            debug('omit internal options');
            frame.options = lodash_1.default.omit(frame.options, INTERNAL_OPTIONS);
        }
    },
};
