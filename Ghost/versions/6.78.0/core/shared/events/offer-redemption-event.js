"use strict";
/**
 * Server-side event firing on page views (page, post, tags...)
 */
module.exports = class OfferRedemptionEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new OfferRedemptionEvent(data, timestamp || new Date());
    }
};
