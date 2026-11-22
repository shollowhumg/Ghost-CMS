"use strict";
module.exports = class MemberPaidConversionEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberPaidConversionEvent(data, timestamp || new Date());
    }
};
