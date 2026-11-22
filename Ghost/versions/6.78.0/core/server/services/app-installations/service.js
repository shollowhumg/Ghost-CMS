"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppInstallationsService = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const app_installations_repository_1 = require("./app-installations-repository");
const decide_on_manifest_1 = require("./decide-on-manifest");
const history_1 = require("./history");
function notFound() {
    return new errors_1.default.NotFoundError({ message: 'App installation not found.' });
}
/** The installation doesn't exist or has been uninstalled. */
function notInstalled() {
    return new errors_1.default.NotFoundError({
        message: 'This app is not installed.',
        code: 'APP_NOT_INSTALLED',
    });
}
/** The installation has been uninstalled, so there's nothing to approve. */
function uninstalled() {
    return new errors_1.default.ConflictError({
        message: 'This app has been uninstalled.',
        code: 'APP_INSTALLATION_UNINSTALLED',
    });
}
/**
 * The app's manifest URL doesn't serve a usable manifest for this app, or one that passes
 * the identity check. The session fails with the failure's own code, which Admin reads to
 * tell an app that's down or broken from one Ghost couldn't confirm. Nothing is written, so
 * the app opens again once the URL serves one.
 */
function unavailable(err) {
    return new errors_1.default.ConflictError({
        message: err.message,
        context: err.context,
        code: err.code ?? 'APP_UNAVAILABLE',
    });
}
/** The reviewed manifest is for a different app than the installed one. */
function forAnotherApp(appId) {
    return new errors_1.default.ValidationError({
        message: `The reviewed manifest is for ${appId}, not the app that is installed.`,
        code: 'APP_MANIFEST_OTHER_APP',
    });
}
/** The icon the installation shows once `write` is stored. */
function iconCopyKeptBy(write, current, pending) {
    switch (write.kind) {
        case 'nothing':
            return current.icon_data_url;
        case 'approve_existing':
            return write.manifestId === pending?.id ? pending.icon_data_url : current.icon_data_url;
        case 'add_approved':
        case 'add_pending':
            return write.row.iconDataUrl;
    }
}
class AppInstallationsService {
    repository;
    recordAction;
    loadManifest;
    identity;
    fetchIcon;
    /** Re-checks in progress, by installation ID. Sessions that start together share one. */
    rechecking = new Map();
    constructor({ knex, recordAction, loadManifest, identity, fetchIcon, }) {
        this.repository = new app_installations_repository_1.AppInstallationsRepository(knex);
        this.recordAction = recordAction;
        this.loadManifest = loadManifest;
        this.identity = identity;
        this.fetchIcon = fetchIcon;
    }
    /** Lists installed apps, suspended ones included. Uninstalled apps aren't listed. */
    async browse() {
        return this.repository.list();
    }
    /**
     * Unlike `browse`, this also returns uninstalled apps.
     * That way their details page still works.
     */
    async read(id, { withHistory = false } = {}) {
        const installation = await this.repository.find(id);
        if (!installation) {
            throw notFound();
        }
        if (withHistory) {
            installation.history = await this.historyOf(id);
        }
        return installation;
    }
    /**
     * Fetches and checks an app's manifest, and runs the identity check, for the publisher to
     * review. Stores nothing.
     */
    async preview(manifestUrl) {
        const { loaded, started } = await this.load(manifestUrl);
        return this.previewOf(await this.review(loaded, started));
    }
    /** Installs an app after the publisher has reviewed its manifest, as previewed. */
    async create(context, { manifestUrl, digest }) {
        const { loaded } = await this.fetchReviewed(manifestUrl, digest);
        const iconDataUrl = await this.fetchIcon(loaded.manifest.icon).catch(async (error) => {
            // An installed app can't be installed, whatever went wrong with its icon. The insert
            // reports the same when the app is installed after the fetch.
            throw (await this.repository.isInstalled(loaded.manifest.id))
                ? (0, app_installations_repository_1.alreadyInstalled)(loaded.manifest.id)
                : error;
        });
        const installation = await this.repository.insert(loaded, iconDataUrl);
        await this.recordAction({
            context,
            event: 'installed',
            subject: installation.id,
            details: { primary_name: loaded.manifest.name, app_id: loaded.manifest.id },
        });
        return installation;
    }
    /**
     * Approves a reviewed manifest for an existing installation: pending changes, or the
     * same app at a new manifest URL. The installation keeps its ID and history.
     *
     * `revision` is the installation's revision when the review was shown. If the
     * installation changed since, the approval fails with a new preview, so the publisher
     * reviews again.
     *
     * Approving the manifest that's already approved, with nothing pending, writes and
     * records nothing.
     */
    async approve(context, id, { manifestUrl, digest, revision }) {
        const current = await this.repository.find(id);
        if (!current) {
            throw notFound();
        }
        // Skip the fetches for an uninstalled app. Anything that changes during them is caught
        // by the revision check when storing.
        if (current.status === 'uninstalled') {
            throw uninstalled();
        }
        const checked = await this.fetchReviewed(manifestUrl, digest, current);
        const { loaded } = checked;
        if (current.revision !== revision) {
            throw await this.changedSinceReview(checked, id);
        }
        const write = await this.withIconCopy((0, decide_on_manifest_1.approvalWrite)({ current, pending: await this.pendingManifestOf(current), loaded })).catch((iconError) => ({ iconError }));
        const stored = await this.store(current, write);
        if (stored.status === 'uninstalled') {
            throw uninstalled();
        }
        if (stored.status === 'changed') {
            throw await this.changedSinceReview(checked, id);
        }
        const approved = stored.value;
        if (approved) {
            await this.recordAction({
                context,
                event: 'changes_approved',
                subject: id,
                details: {
                    primary_name: loaded.manifest.name,
                    app_id: loaded.manifest.id,
                    from_manifest_id: current.manifest_id,
                    to_manifest_id: approved,
                },
            });
        }
        return this.read(id);
    }
    /**
     * Starts an app session when Admin opens an app page. Re-checks the manifest, then
     * returns the installation, which Admin decides what to show from. Nothing about the
     * session is stored.
     */
    async startSession(id) {
        await this.recheck(id);
        const installation = await this.read(id);
        // Uninstalled after the re-check, or during a re-check this session shared.
        if (installation.status === 'uninstalled') {
            throw notInstalled();
        }
        return { installation };
    }
    /**
     * Uninstalls an app. The row is kept as a record of what was installed.
     *
     * Uninstalling an app that's already uninstalled does nothing, so a repeated request
     * doesn't add a second entry to the history.
     */
    async uninstall(context, id) {
        const installation = await this.read(id);
        const ended = await this.repository.uninstall(id);
        if (!ended) {
            return;
        }
        await this.recordAction({
            context,
            event: 'uninstalled',
            subject: id,
            details: { primary_name: installation.manifest.name, app_id: installation.app_id },
        });
    }
    async historyOf(id) {
        const { manifests, actions } = await this.repository.historyRows(id);
        return (0, history_1.buildHistory)(manifests, actions, await this.repository.loadManifestContents((0, history_1.approvalManifestIds)(actions)));
    }
    /**
     * What the site holds manifests signed with an identity key to: that key, and the backend
     * keys replaced on any installation of the app signed with it.
     */
    async pinnedIdentityOf(appId, identityKeyThumbprint) {
        return {
            identityKeyThumbprint,
            retiredBackendKeys: await this.repository.retiredBackendKeysOf(appId, identityKeyThumbprint),
        };
    }
    /**
     * Loads a manifest with its origin's challenge already on the way, so the two requests
     * run together rather than one after the other.
     */
    async load(manifestUrl) {
        const started = this.identity.challenge(manifestUrl);
        return { loaded: await this.loadManifest(manifestUrl), started };
    }
    /**
     * Runs the identity check on a manifest a publisher is to review, against `installation`,
     * or else the site's installation of that app, if it has one. Without one, a manifest
     * signed with the same key as an ended installation still can't name a backend key it
     * replaced, so uninstalling and installing again can't bring a retired key back.
     */
    async review(loaded, started, installation) {
        const current = installation ?? (await this.repository.currentInstallationOf(loaded.manifest.id)) ?? null;
        const pinned = await this.pinnedIdentityOf(loaded.manifest.id, current?.identity_key_thumbprint ?? loaded.identityKeyThumbprint);
        const { trustedOrigins } = await this.identity.check(loaded, pinned, started);
        return { loaded, trustedOrigins, installation: current };
    }
    /**
     * Shows the icon approving would store. A reused row shows its stored copy without a
     * fetch, so the review works even if the icon URL stopped loading. The digest doesn't
     * cover the icon, so confirming fetches it again.
     */
    async previewOf({ loaded, trustedOrigins, installation: current, }) {
        const reviewed = {
            manifest_url: loaded.manifestUrl,
            manifest: loaded.manifest,
            digest: loaded.digest,
            trusted_origins: trustedOrigins,
        };
        if (!current) {
            return {
                ...reviewed,
                icon_data_url: await this.fetchIcon(loaded.manifest.icon),
                installation: null,
            };
        }
        const pending = await this.pendingManifestOf(current);
        const write = await this.withIconCopy((0, decide_on_manifest_1.approvalWrite)({ current, pending, loaded }));
        return {
            ...reviewed,
            icon_data_url: iconCopyKeptBy(write, current, pending),
            // The approved manifest shown is the one the changes were computed from, so the
            // review matches the list of changes.
            installation: {
                id: current.id,
                status: current.status,
                revision: current.revision,
                manifest_url: current.manifest_url,
                manifest: current.manifest,
                icon_data_url: current.icon_data_url,
                changes: (0, decide_on_manifest_1.changesFrom)(current, loaded),
            },
        };
    }
    /**
     * Fetches the icon for a write that adds a row, before the transaction opens so it never
     * waits on the app. Other writes skip the fetch, so a stored copy never changes.
     */
    async withIconCopy(write) {
        switch (write.kind) {
            case 'nothing':
            case 'approve_existing':
                return write;
            case 'add_approved':
            case 'add_pending': {
                const iconDataUrl = await this.fetchIcon(write.row.loaded.manifest.icon);
                return { kind: write.kind, row: { ...write.row, iconDataUrl } };
            }
        }
    }
    /**
     * Fetches the manifest again, runs the identity check again, and checks its digest
     * matches the one the publisher reviewed. For an existing installation, the manifest must
     * be for its app, and is checked against its pinned keys. If the digest doesn't match,
     * the error carries a new preview so they can review the new version.
     */
    async fetchReviewed(manifestUrl, digest, installation) {
        const { loaded, started } = await this.load(manifestUrl);
        if (installation && loaded.manifest.id !== installation.app_id) {
            throw forAnotherApp(loaded.manifest.id);
        }
        const checked = await this.review(loaded, started, installation);
        if (loaded.digest !== digest) {
            throw new errors_1.default.ConflictError({
                message: 'The app changed while it was being reviewed.',
                code: 'APP_MANIFEST_CHANGED',
                errorDetails: await this.previewOf(checked),
            });
        }
        return checked;
    }
    /**
     * The installation changed since the review, so the error carries a new preview of it as
     * it is now, unless it has been uninstalled and there's nothing left to review.
     */
    async changedSinceReview(checked, id) {
        const installation = await this.currentInstallation(id);
        if (!installation) {
            return uninstalled();
        }
        return new errors_1.default.ConflictError({
            message: 'The installation changed while the app was being reviewed.',
            code: 'APP_INSTALLATION_CHANGED',
            errorDetails: await this.previewOf({ ...checked, installation }),
        });
    }
    /** The pending manifest's ID, digest and icon copy, or null if nothing is pending. */
    async pendingManifestOf(installation) {
        const id = installation.pending_manifest_id;
        if (id === null) {
            return null;
        }
        const pending = await this.repository.findDigestAndIcon(id);
        return pending ? { id, ...pending } : null;
    }
    /**
     * Applies a write planned from `current`, unless the installation changed since. Returns
     * the newly approved or pending manifest's ID, or null for `nothing`. Throws the error of an
     * icon fetch that failed, but only once the installation is known to be unchanged.
     */
    store(current, write) {
        return this.repository.whileUnchanged(current, async (locked) => {
            // Thrown under the lock, so an uninstall or change during the icon fetch wins.
            if ('iconError' in write) {
                throw write.iconError;
            }
            switch (write.kind) {
                case 'nothing':
                    return null;
                case 'approve_existing':
                    await locked.activate(write.manifestId);
                    return write.manifestId;
                case 'add_approved': {
                    const added = await locked.addManifest(write.row);
                    await locked.activate(added);
                    return added;
                }
                case 'add_pending': {
                    const added = await locked.addManifest(write.row);
                    await locked.suspend(added);
                    return added;
                }
                default: {
                    const _exhaustive = write;
                    throw new errors_1.default.InternalServerError({
                        message: `Unhandled manifest write: ${JSON.stringify(_exhaustive)}`,
                    });
                }
            }
        });
    }
    recheck(id) {
        const inFlight = this.rechecking.get(id);
        if (inFlight) {
            return inFlight;
        }
        const run = this.recheckOnce(id).finally(() => this.rechecking.delete(id));
        this.rechecking.set(id, run);
        return run;
    }
    /**
     * Fetches the app's manifest again from its approved manifest URL and stores what
     * changed. Silent changes are applied. Changes that need approval become the pending
     * manifest, which suspends the app. No person made these changes, so nothing goes into
     * the staff history; the manifest rows record them.
     *
     * If the manifest can't be loaded, fails the identity check, or is for a different app,
     * the app is broken or its URL now serves someone else. The session then fails instead of
     * running the approved manifest, with the failure's own code. So does an icon that can't
     * be loaded when a new row needs storing, even for a silent change; a re-check that stores
     * nothing doesn't fetch it. The challenge goes out with the manifest fetch, so a session
     * start waits for one round trip to the app, not two.
     *
     * Everything is looked up by installation ID, never app ID, so a re-check that started
     * before an uninstall can't bring that installation back or change a newer installation
     * of the same app. If the installation changed while the manifest was loading, the
     * re-check does nothing, because the loaded manifest may be older than that change.
     */
    async recheckOnce(id) {
        const before = await this.currentInstallation(id);
        if (!before) {
            throw notInstalled();
        }
        let write;
        try {
            // The retired keys are read while the manifest loads.
            const [fetched, pinned] = await Promise.all([
                this.load(before.manifest_url),
                this.pinnedIdentityOf(before.app_id, before.identity_key_thumbprint),
            ]);
            const { loaded } = fetched;
            if (loaded.manifest.id !== before.app_id) {
                throw new errors_1.default.ValidationError({
                    message: `${before.manifest_url} now serves ${loaded.manifest.id}.`,
                    code: 'APP_MANIFEST_OTHER_APP',
                });
            }
            await this.identity.check(loaded, pinned, fetched.started);
            write = await this.withIconCopy((0, decide_on_manifest_1.recheckWrite)({ current: before, pending: await this.pendingManifestOf(before), loaded }));
        }
        catch (err) {
            // A ValidationError means the app served something that can't be used. Anything else
            // is a fault in Ghost, which fails the session as it is.
            if (!(err instanceof errors_1.default.ValidationError)) {
                throw err;
            }
            return this.unavailableUnlessChanged(before, err);
        }
        const stored = await this.store(before, write);
        if (stored.status === 'uninstalled') {
            throw notInstalled();
        }
    }
    /** The installation, unless it doesn't exist or has been uninstalled. */
    async currentInstallation(id) {
        const installation = await this.repository.find(id);
        return installation?.status === 'uninstalled' ? undefined : installation;
    }
    /**
     * Fails the session with why the manifest couldn't be used in the error's context, which
     * the request log records. If the installation changed while the manifest was loading, it
     * may no longer use that URL, so the session returns the installation as it is instead.
     */
    async unavailableUnlessChanged(before, err) {
        const current = await this.currentInstallation(before.id);
        if (!current) {
            throw notInstalled();
        }
        if (current.revision !== before.revision) {
            return;
        }
        throw unavailable(err);
    }
}
exports.AppInstallationsService = AppInstallationsService;
