"use strict";
module.exports = class MemberSubscribeEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberSubscribeEvent(data, timestamp || new Date());
    }
};
