"use strict";
module.exports = class MemberUnsubscribeEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberUnsubscribeEvent(data, timestamp || new Date());
    }
};
