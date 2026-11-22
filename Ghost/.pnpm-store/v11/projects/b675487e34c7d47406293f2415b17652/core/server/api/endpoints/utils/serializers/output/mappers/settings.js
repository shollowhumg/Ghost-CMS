"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
module.exports = (attrs) => {
    if (Array.isArray(attrs)) {
        return attrs.map((setting) => {
            return lodash_1.default.pick(setting, ['key', 'value', 'is_read_only']);
        });
    }
    return attrs;
};
