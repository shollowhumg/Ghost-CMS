"use strict";
/**
 * Server-side event firing on page views (page, post, tags...)
 */
module.exports = class MemberPageViewEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberPageViewEvent(data, timestamp || new Date());
    }
};
