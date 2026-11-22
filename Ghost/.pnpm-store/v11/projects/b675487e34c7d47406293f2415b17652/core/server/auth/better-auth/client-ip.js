"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_IP_HEADER = void 0;
exports.setClientIPHeader = setClientIPHeader;
/** Carries the client IP Express resolved to Better Auth; only Ghost sets it. */
exports.CLIENT_IP_HEADER = 'x-ghost-client-ip';
/**
 * Replaces any copy of the client IP header a client sent with `req.ip`, as
 * `trust proxy` resolved it. Mount before every route that hands the request
 * headers to Better Auth.
 */
function setClientIPHeader(req, _res, next) {
    delete req.headers[exports.CLIENT_IP_HEADER];
    if (req.ip) {
        req.headers[exports.CLIENT_IP_HEADER] = req.ip;
    }
    next();
}
