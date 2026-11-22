"use strict";
/**
 * Server-side event firing on page views (page, post, tags...)
 */
module.exports = class MemberLinkClickEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberLinkClickEvent(data, timestamp || new Date());
    }
};
