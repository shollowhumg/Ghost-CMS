"use strict";
module.exports = class MemberEntryViewEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberEntryViewEvent(data, timestamp || new Date());
    }
};
