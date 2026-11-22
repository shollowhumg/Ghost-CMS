"use strict";
module.exports = class MemberPaidCancellationEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberPaidCancellationEvent(data, timestamp || new Date());
    }
};
