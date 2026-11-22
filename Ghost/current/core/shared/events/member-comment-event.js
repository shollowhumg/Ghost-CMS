"use strict";
/**
 * Server-side event firing on page views (page, post, tags...)
 */
module.exports = class MemberCommentEvent {
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp) {
        return new MemberCommentEvent(data, timestamp || new Date());
    }
};
