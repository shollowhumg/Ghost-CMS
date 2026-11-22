"use strict";
/**
 * Fired when a subscription becomes active.
 */
module.exports = class SubscriptionActivatedEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new SubscriptionActivatedEvent(data, timestamp ?? new Date());
    }
};
