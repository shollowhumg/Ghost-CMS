"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createSessionService;
const errors = __importStar(require("@tryghost/errors"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const totp = __importStar(require("../totp"));
const { BadRequestError } = errors;
const emailTemplate = require('./emails/signin');
// ua-parser-js ships no types; got is ESM-only
const UAParser = require('ua-parser-js');
const got = require('got').default;
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i;
const AUTH_CODE_VALIDITY_MS = 5 * 60 * 1000;
const AUTH_CODE_CHALLENGE_BYTES = 16;
function createSessionService({ getSession, findUserById, getOriginOfRequest, getSettingsCache, getBlogLogo, mailer, urlUtils, isStaffDeviceVerificationDisabled, limitVerificationEmailForUser, resetVerificationEmailForUser, consumeAuthCodeAttempt, t, }) {
    // Await the reset so the next sign-in starts with a fresh email budget.
    // Store failures must not prevent a successfully verified user from signing in.
    async function clearVerificationEmailLimit(userId) {
        try {
            await resetVerificationEmailForUser(userId);
        }
        catch (err) {
            // best-effort. Don't block sign-in on a limiter reset failure
        }
    }
    function createAuthCodeChallenge() {
        return node_crypto_1.default.randomBytes(AUTH_CODE_CHALLENGE_BYTES).toString('hex');
    }
    function rotateAuthCodeChallenge(session) {
        session.auth_code_challenge = createAuthCodeChallenge();
        session.auth_code_generated_at = Date.now();
    }
    function ensureAuthCodeChallenge(session) {
        if (!session.auth_code_challenge) {
            rotateAuthCodeChallenge(session);
        }
        return session.auth_code_challenge;
    }
    function invalidateAuthCodeChallenge(session) {
        session.auth_code_challenge = undefined;
        session.auth_code_generated_at = undefined;
    }
    function hasValidAuthCodeChallenge(session) {
        if (!session.auth_code_challenge || !session.auth_code_generated_at) {
            return false;
        }
        return Date.now() - session.auth_code_generated_at <= AUTH_CODE_VALIDITY_MS;
    }
    async function verifyAuthCode(session, token, secret) {
        if (!token || !session.user_id || !hasValidAuthCodeChallenge(session)) {
            return false;
        }
        // The challenge survives session regeneration. Its shared, atomic budget also
        // covers concurrent requests and requests from different IP addresses.
        await consumeAuthCodeAttempt(session.auth_code_challenge);
        const verified = totp.verify(session.user_id, token, secret, session.auth_code_challenge);
        if (verified) {
            invalidateAuthCodeChallenge(session);
        }
        return verified;
    }
    // Reject any request whose origin isn't the admin site. This check is
    // used to prevent cross-origin logins (login CSRF).
    function assertRequestFromAdminOrigin(origin) {
        const adminOrigin = urlUtils.getAdminOrigin();
        if (origin !== adminOrigin) {
            throw new BadRequestError({
                message: `Request made from incorrect origin. Expected '${adminOrigin}' received '${origin}'.`,
            });
        }
    }
    function cookieCsrfProtection(req, session) {
        const origin = getOriginOfRequest(req);
        // Check that the origin matches the admin URL to prevent cross-origin
        // requests (e.g. no-cors form submissions from phishing sites)
        assertRequestFromAdminOrigin(origin);
        // If there is no origin on the session object it means this is a *new*
        // session, that hasn't been initialised yet. So we don't need CSRF protection
        if (!session.origin) {
            return;
        }
        if (session.origin !== origin) {
            throw new BadRequestError({
                message: `Request made from incorrect origin. Expected '${session.origin}' received '${origin}'.`,
            });
        }
    }
    /**
     * isVerificationRequired
     * Determines if 2FA verification is required based on site settings
     */
    function isVerificationRequired() {
        return getSettingsCache('require_email_mfa') === true;
    }
    async function assignUserToSession({ session, user, origin, userAgent, ip, verificationToken, }) {
        if (!origin) {
            throw new BadRequestError({
                message: 'Could not determine origin of request. Please ensure an Origin or Referrer header is present.',
            });
        }
        // A session may only ever be created for the admin panel's own origin, so a
        // cross-origin request (e.g. a login-CSRF form post) can't create a session.
        assertRequestFromAdminOrigin(origin);
        if (session.user_id && session.user_id !== user.id) {
            invalidateAuthCodeChallenge(session);
        }
        session.user_id = user.id;
        session.origin = origin;
        session.user_agent = userAgent;
        session.ip = ip;
        // If a verification token was provided with the login request, verify it
        if (verificationToken) {
            const secret = getSettingsCache('admin_session_secret');
            const isAuthCodeVerified = await verifyAuthCode(session, verificationToken, secret);
            if (isAuthCodeVerified) {
                session.verified = true;
                session.verified_user_id = user.id;
                invalidateAuthCodeChallenge(session);
                await clearVerificationEmailLimit(user.id);
            }
        }
        if (isStaffDeviceVerificationDisabled()) {
            session.verified = true;
            session.verified_user_id = user.id;
        }
    }
    async function createSessionForUser(req, res, user) {
        const previousSession = await getSession(req, res);
        // Carried over to the new session so verification state survives login
        const { user_id: previousUserId, verified: previousVerified, verified_user_id: previousVerifiedUserId, auth_code_challenge: previousAuthCodeChallenge, auth_code_generated_at: previousAuthCodeGeneratedAt, } = previousSession;
        // Ensure a new session is always created
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        const session = req.session;
        session.user_id = previousUserId;
        // Verification is bound to the user who completed it — any other user
        // (including sessions with no verified_user_id) must verify again
        const carryVerification = previousVerified === true && previousVerifiedUserId === user.id;
        session.verified = carryVerification ? true : undefined;
        session.verified_user_id = carryVerification ? previousVerifiedUserId : undefined;
        session.auth_code_challenge = previousAuthCodeChallenge;
        session.auth_code_generated_at = previousAuthCodeGeneratedAt;
        const origin = getOriginOfRequest(req);
        await assignUserToSession({
            session,
            user,
            origin,
            userAgent: req.get('user-agent'),
            ip: req.ip,
            verificationToken: req.body && req.body.token,
        });
    }
    async function createVerifiedSessionForUser(req, res, user) {
        await createSessionForUser(req, res, user);
        await verifySession(req, res);
    }
    async function assignVerifiedUserToSession({ session, user, origin, userAgent, ip, }) {
        await assignUserToSession({
            session,
            user,
            origin,
            userAgent,
            ip,
        });
        session.verified = true;
        session.verified_user_id = user.id;
        invalidateAuthCodeChallenge(session);
    }
    /**
     * rotateAndAssignVerifiedUserToSession
     * Regenerates the Express session (issuing a new session_id) and then
     * assigns the verified user to the new session. Used after a password
     * change or reset so that any cloned or stolen copy of the pre-change
     * cookie is rejected on its next request.
     */
    async function rotateAndAssignVerifiedUserToSession({ req, user, ip, }) {
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        await assignVerifiedUserToSession({
            session: req.session,
            user,
            origin: getOriginOfRequest(req),
            ip,
        });
    }
    async function generateAuthCodeForUser(req, res) {
        const session = await getSession(req, res);
        const secret = getSettingsCache('admin_session_secret');
        const challenge = ensureAuthCodeChallenge(session);
        return totp.generate(session.user_id, secret, challenge);
    }
    async function verifyAuthCodeForUser(req, res) {
        const session = await getSession(req, res);
        cookieCsrfProtection(req, session);
        const secret = getSettingsCache('admin_session_secret');
        const token = req.body && req.body.token;
        return verifyAuthCode(session, token, secret);
    }
    const formatTime = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
    }).format;
    /**
     * Get a readable location string from an IP address.
     */
    async function getGeolocationFromIP(ip) {
        if (!ip || (!IPV4_REGEX.test(ip) && !IPV6_REGEX.test(ip))) {
            return 'Unknown';
        }
        const gotOpts = {
            timeout: {
                request: 500,
            },
        };
        if (process.env.NODE_ENV?.startsWith('test')) {
            gotOpts.retry = {
                limit: 0,
            };
        }
        const geojsUrl = `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`;
        try {
            const response = await got(geojsUrl, gotOpts).json();
            const { city, region, country } = response || {};
            // Only include non-empty parts in the result
            const locationParts = [city, region, country].filter(Boolean);
            // If no valid parts, return 'Unknown'
            return locationParts.length > 0 ? locationParts.join(', ').trim() : 'Unknown';
        }
        catch (error) {
            return 'Unknown';
        }
    }
    async function getDeviceDetails(userAgent, ip) {
        const parser = new UAParser();
        parser.setUA(userAgent);
        const result = parser.getResult();
        const deviceParts = [result.browser?.name || '', result.os?.name || ''].filter(Boolean);
        return {
            device: deviceParts.join(', '),
            location: await getGeolocationFromIP(ip),
            time: formatTime(new Date()),
        };
    }
    async function sendAuthCodeToUser(req, res) {
        const session = await getSession(req, res);
        cookieCsrfProtection(req, session);
        if (!session.user_id) {
            throw new BadRequestError({
                message: 'Could not fetch user from the session.',
            });
        }
        // Rate-limit verification emails per user (independent of IP/session) so a
        // caller with valid credentials can't flood a user's inbox by repeating
        // sign-in. Throws a TooManyRequestsError once the limit is exceeded.
        await limitVerificationEmailForUser(session.user_id);
        rotateAuthCodeChallenge(session);
        const token = await generateAuthCodeForUser(req, res);
        let user;
        try {
            user = await findUserById({ id: session.user_id });
        }
        catch (error) {
            // User session likely doesn't contain a valid user ID
            throw new BadRequestError({
                message: 'Could not fetch user from the session.',
            });
        }
        const recipient = user.get('email');
        const siteTitle = getSettingsCache('title');
        const siteLogo = getBlogLogo();
        const siteUrl = urlUtils.urlFor('home', true);
        const domain = urlUtils
            .urlFor('home', true)
            .match(new RegExp('^https?://([^/:?#]+)(?:[/:?#]|$)', 'i'));
        const siteDomain = domain && domain[1];
        const email = emailTemplate({
            t,
            siteTitle: siteTitle,
            email: recipient,
            siteDomain: siteDomain,
            siteUrl: siteUrl,
            siteLogo: siteLogo,
            token: token,
            deviceDetails: await getDeviceDetails(session.user_agent, session.ip),
            is2FARequired: isVerificationRequired(),
        });
        try {
            await mailer.send({
                to: recipient,
                subject: `${token} is your Ghost sign in verification code`,
                html: email,
            });
        }
        catch (error) {
            throw new errors.EmailError({
                ...error,
                message: 'Failed to send email. Please check your site configuration and try again.',
            });
        }
    }
    async function verifySession(req, res) {
        const session = await getSession(req, res);
        session.verified = true;
        session.verified_user_id = session.user_id;
        invalidateAuthCodeChallenge(session);
        await clearVerificationEmailLimit(session.user_id);
    }
    async function isVerifiedSession(req, res) {
        const session = await getSession(req, res);
        // Verification is bound to a user; a session with no verified_user_id
        // (e.g. logged out, or predating this field) fails closed rather than
        // matching an absent user_id via undefined === undefined
        return (session.verified === true &&
            !!session.verified_user_id &&
            session.verified_user_id === session.user_id);
    }
    async function removeUserForSession(req, res) {
        const session = await getSession(req, res);
        if (isVerificationRequired()) {
            session.verified = undefined;
            session.verified_user_id = undefined;
        }
        invalidateAuthCodeChallenge(session);
        session.user_id = undefined;
    }
    async function getUserForSession(req, res) {
        // CASE: we don't have a cookie header so allow fallthrough to other
        // auth middleware or final "ensure authenticated" check
        if (!req.headers || !req.headers.cookie) {
            return null;
        }
        const session = await getSession(req, res);
        // Enable CSRF bypass (useful for OAuth for example)
        if (!res || !res.locals || !res.locals.bypassCsrfProtection) {
            cookieCsrfProtection(req, session);
        }
        if (!session || !session.user_id) {
            return null;
        }
        try {
            const user = await findUserById({ id: session.user_id });
            return user;
        }
        catch (err) {
            return null;
        }
    }
    return {
        getUserForSession,
        createSessionForUser,
        createVerifiedSessionForUser,
        assignVerifiedUserToSession,
        rotateAndAssignVerifiedUserToSession,
        removeUserForSession,
        verifySession,
        isVerifiedSession,
        sendAuthCodeToUser,
        verifyAuthCodeForUser,
        generateAuthCodeForUser,
        isVerificationRequired,
    };
}
