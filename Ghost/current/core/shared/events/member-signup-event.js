"use strict";
module.exports = class MemberSignupEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberSignupEvent(data, timestamp || new Date());
    }
};
