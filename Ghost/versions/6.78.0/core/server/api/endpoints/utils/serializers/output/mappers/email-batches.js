"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const batchFields = [
    'id',
    'mailgun_message_id',
    'status',
    'member_segment',
    'created_at',
    'updated_at',
    'error_status_code',
    'error_message',
    'error_data',
];
const countFields = ['recipients'];
const batchMapper = (model, frame) => {
    const jsonModel = model.toJSON ? model.toJSON(frame.options) : model;
    const response = lodash_1.default.pick(jsonModel, batchFields);
    if (jsonModel.count) {
        response.count = lodash_1.default.pick(jsonModel.count, countFields);
    }
    return response;
};
module.exports = batchMapper;
