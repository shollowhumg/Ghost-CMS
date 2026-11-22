"use strict";
module.exports = class SubscriptionCancelledEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new SubscriptionCancelledEvent(data, timestamp || new Date());
    }
};
