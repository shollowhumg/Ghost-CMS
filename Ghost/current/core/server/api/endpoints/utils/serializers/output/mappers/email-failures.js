"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const memberFields = ['id', 'uuid', 'name', 'email', 'avatar_image'];
const failureFields = [
    'id',
    'code',
    'enhanced_code',
    'message',
    'severity',
    'failed_at',
    'event_id',
];
const emailRecipientFields = [
    'id',
    'batch_id',
    'processed_at',
    'delivered_at',
    'opened_at',
    'failed_at',
    'member_uuid',
    'member_email',
    'member_name',
];
const failureMapper = (model, frame) => {
    const jsonModel = model.toJSON ? model.toJSON(frame.options) : model;
    const response = lodash_1.default.pick(jsonModel, failureFields);
    if (jsonModel.member) {
        response.member = lodash_1.default.pick(jsonModel.member, memberFields);
    }
    else {
        response.member = null;
    }
    if (jsonModel.emailRecipient) {
        response.email_recipient = lodash_1.default.pick(jsonModel.emailRecipient, emailRecipientFields);
    }
    else {
        response.email_recipient = null;
    }
    return response;
};
module.exports = failureMapper;
