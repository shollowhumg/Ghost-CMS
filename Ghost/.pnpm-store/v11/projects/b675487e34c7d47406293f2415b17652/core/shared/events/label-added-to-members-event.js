"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelAddedToMembersEvent = void 0;
class LabelAddedToMembersEvent {
    timestamp = new Date();
    data;
    constructor(labelId, memberIds) {
        this.data = { labelId, memberIds: [...memberIds] };
    }
}
exports.LabelAddedToMembersEvent = LabelAddedToMembersEvent;
