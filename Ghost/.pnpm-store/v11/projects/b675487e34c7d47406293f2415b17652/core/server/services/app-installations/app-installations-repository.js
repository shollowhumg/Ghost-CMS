"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppInstallationsRepository = void 0;
exports.alreadyInstalled = alreadyInstalled;
const errors_1 = __importDefault(require("@tryghost/errors"));
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const zod_1 = require("zod");
const date_1 = require("../../lib/db-types/date");
const codec_1 = require("./codec");
const schema_1 = require("./schema");
const INSTALLATIONS = 'app_installations';
const MANIFESTS = 'app_installation_manifests';
const HistoryManifestRow = schema_1.DbAppInstallationManifest.pick({
    id: true,
    source: true,
    requires_approval: true,
    created_at: true,
});
const ManifestContentRow = schema_1.DbAppInstallationManifest.pick({ id: true, manifest: true });
const DigestAndIconRow = schema_1.DbAppInstallationManifest.pick({ digest: true, icon_data_url: true });
const BackendKeyRow = schema_1.DbAppInstallationManifest.pick({ backend_key_thumbprint: true });
const HistoryActionRow = zod_1.z
    .object({
    id: zod_1.z.string(),
    event: zod_1.z.string(),
    actor_id: zod_1.z.string(),
    actor_name: zod_1.z.string().nullable(),
    context: zod_1.z.string().nullable(),
    created_at: date_1.DbDate,
})
    .transform((row) => ({
    id: row.id,
    event: row.event,
    context: row.context,
    created_at: row.created_at,
    actor: { id: row.actor_id, name: row.actor_name },
}));
// Both tables have `id` and `created_at`, so each column names the table it's read from.
const INSTALLATION_COLUMNS = [
    ...Object.keys(codec_1.InstallationFields.shape).map((column) => `installation.${column}`),
    ...Object.keys(codec_1.ApprovedManifestFields.shape).map((column) => `approved.${column}`),
];
const LockedRow = schema_1.DbAppInstallation.pick({ status: true, revision: true });
function isUniqueViolation(err) {
    const code = err?.code;
    return (code === 'ER_DUP_ENTRY' || (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')));
}
/** Every write to an installation moves its revision on, which ends its app sessions. */
function nextRevision(db) {
    return { revision: db.raw('?? + 1', ['revision']), updated_at: (0, date_1.toDatabaseDate)(new Date()) };
}
/**
 * An installation `whileUnchanged` has locked, and the writes to it. Only `whileUnchanged`
 * makes one, so these writes only happen under the lock, and only to that installation.
 */
class LockedInstallation {
    trx;
    id;
    constructor(trx, id) {
        this.trx = trx;
        this.id = id;
    }
    /** Adds a manifest row for the installation, and returns its ID. */
    async addManifest({ loaded, source, requiresApproval, iconDataUrl }) {
        const id = new bson_objectid_1.default().toHexString();
        await this.trx(MANIFESTS).insert({
            id,
            installation_id: this.id,
            manifest_url: loaded.manifestUrl,
            manifest: loaded.serialised,
            digest: loaded.digest,
            backend_key_thumbprint: loaded.backendKeyThumbprint,
            icon_data_url: iconDataUrl,
            source,
            requires_approval: requiresApproval,
            created_at: (0, date_1.toDatabaseDate)(new Date()),
        });
        return id;
    }
    /**
     * Makes a manifest the approved manifest and lets go of any pending one. Suspended only
     * means changes are waiting for approval, so with none left it's active.
     */
    async activate(manifestId) {
        await this.trx(INSTALLATIONS)
            .where({ id: this.id })
            .update({
            status: 'active',
            manifest_id: manifestId,
            pending_manifest_id: null,
            ...nextRevision(this.trx),
        });
    }
    /**
     * Makes a manifest the pending manifest, which suspends the installation until that's
     * approved. The approved manifest stays as it is.
     */
    async suspend(manifestId) {
        await this.trx(INSTALLATIONS)
            .where({ id: this.id })
            .update({ status: 'suspended', pending_manifest_id: manifestId, ...nextRevision(this.trx) });
    }
}
/**
 * The installations and their manifest rows. Manifest rows are only ever added, never
 * changed, and every write to an installation moves its revision on.
 */
/** The app has a current installation, so it can't be installed again. */
function alreadyInstalled(appId) {
    return new errors_1.default.ConflictError({
        message: `The app ${appId} is already installed.`,
        code: 'APP_ALREADY_INSTALLED',
    });
}
class AppInstallationsRepository {
    knex;
    constructor(knex) {
        this.knex = knex;
    }
    /** Installations that haven't been uninstalled, oldest first. */
    async list() {
        const rows = await this.withApprovedManifest()
            .whereNot('installation.status', 'uninstalled')
            .orderBy('installation.created_at', 'asc')
            .orderBy('installation.id', 'asc')
            .select(INSTALLATION_COLUMNS);
        return rows.map((row) => zod_1.z.decode(codec_1.InstallationRow, row));
    }
    /** An installation by ID, uninstalled or not. */
    async find(id) {
        const row = await this.withApprovedManifest()
            .where('installation.id', id)
            .first(INSTALLATION_COLUMNS);
        return row ? zod_1.z.decode(codec_1.InstallationRow, row) : undefined;
    }
    /** The app's current installation, if it has one. */
    async currentInstallationOf(appId) {
        const row = await this.withApprovedManifest()
            .where('installation.current_app_id', appId)
            .first(INSTALLATION_COLUMNS);
        return row ? zod_1.z.decode(codec_1.InstallationRow, row) : undefined;
    }
    /** Whether the app has a current installation. Reads no manifest, so nothing can fail to decode. */
    async isInstalled(appId) {
        return Boolean(await this.knex(INSTALLATIONS).where('current_app_id', appId).first('id'));
    }
    /**
     * Reads only the digest and icon copy, skipping the manifest: a row stored under an older
     * contract may no longer decode, but we still compare against it.
     */
    async findDigestAndIcon(id) {
        const row = await this.knex(MANIFESTS)
            .where({ id })
            .first('digest', 'icon_data_url');
        return row ? zod_1.z.decode(DigestAndIconRow, row) : undefined;
    }
    /**
     * The backend keys replaced for an app signed with this identity key: every key named by
     * a manifest row of any of its installations, ended ones included, other than the current
     * key. Rows are only added for verified manifests, pending ones included, so a key is
     * retired as soon as a verified manifest names a newer one, and uninstalling and
     * installing again doesn't bring it back.
     *
     * The current key is the one the newest installation's pending manifest names, or else its
     * approved manifest's. Every added row becomes one of those straight away, so rows aren't
     * ordered by `created_at`, which comes from each instance's clock and is only to the
     * second. Only installations are, and those are an uninstall and an install apart.
     */
    async retiredBackendKeysOf(appId, identityKeyThumbprint) {
        const rows = () => this.knex(`${MANIFESTS} as manifest`)
            .join(`${INSTALLATIONS} as installation`, 'installation.id', 'manifest.installation_id')
            .where({
            'installation.app_id': appId,
            'installation.identity_key_thumbprint': identityKeyThumbprint,
        });
        const current = rows()
            .whereRaw('?? = coalesce(??, ??)', [
            'manifest.id',
            'installation.pending_manifest_id',
            'installation.manifest_id',
        ])
            .orderBy('installation.created_at', 'desc')
            .orderBy('installation.id', 'desc')
            .limit(1)
            .select('manifest.backend_key_thumbprint');
        const retired = await rows()
            .whereNot('manifest.backend_key_thumbprint', current)
            .distinct('manifest.backend_key_thumbprint');
        return new Set(retired.map((row) => zod_1.z.decode(BackendKeyRow, row).backend_key_thumbprint));
    }
    /** An installation's manifest rows and staff actions, oldest first. */
    async historyRows(id) {
        const manifestRows = this.knex(MANIFESTS)
            .where({ installation_id: id })
            .orderBy('created_at', 'asc')
            .orderBy('id', 'asc')
            .select('id', 'source', 'requires_approval', 'created_at');
        const actionRows = this.knex('actions as action')
            // Left join, so actions by deleted users still show, just without a name.
            .leftJoin('users as actor', 'actor.id', 'action.actor_id')
            .where({ 'action.resource_type': 'app_installation', 'action.resource_id': id })
            .orderBy('action.created_at', 'asc')
            .orderBy('action.id', 'asc')
            .select('action.id', 'action.event', 'action.actor_id', 'action.context', 'action.created_at', 'actor.name as actor_name');
        const [manifestData, actionData] = await Promise.all([manifestRows, actionRows]);
        return {
            manifests: manifestData.map((row) => zod_1.z.decode(HistoryManifestRow, row)),
            actions: actionData.map((row) => zod_1.z.decode(HistoryActionRow, row)),
        };
    }
    /**
     * Loads the contents of these manifests, by id.
     * A row that no longer decodes is skipped, so one bad row can't break the page.
     */
    async loadManifestContents(ids) {
        if (ids.length === 0) {
            return new Map();
        }
        const rows = await this.knex(MANIFESTS)
            .whereIn('id', ids)
            .select('id', 'manifest');
        const contents = new Map();
        for (const row of rows) {
            const decoded = ManifestContentRow.safeDecode(row);
            if (decoded.success) {
                contents.set(decoded.data.id, decoded.data.manifest);
            }
        }
        return contents;
    }
    /**
     * Every install creates a new installation with a new ID, reinstalls included; an
     * uninstalled installation is never reused. The unique `current_app_id` column blocks a
     * second installation of the same app, so when two installs race, one succeeds and the
     * other gets `APP_ALREADY_INSTALLED`.
     */
    async insert(loaded, iconDataUrl) {
        const { manifest } = loaded;
        const id = new bson_objectid_1.default().toHexString();
        const manifestId = new bson_objectid_1.default().toHexString();
        const now = (0, date_1.toDatabaseDate)(new Date());
        // The row as the read query would return it. Decoding it with the same codec gives the
        // result without reading the row back.
        const written = {
            id,
            app_id: manifest.id,
            identity_key_thumbprint: loaded.identityKeyThumbprint,
            status: 'active',
            manifest_id: manifestId,
            pending_manifest_id: null,
            revision: 0,
            manifest_url: loaded.manifestUrl,
            manifest: loaded.serialised,
            icon_data_url: iconDataUrl,
            created_at: now,
            updated_at: now,
        };
        for (let attempt = 0;; attempt += 1) {
            try {
                await this.knex.transaction(async (trx) => {
                    await trx(INSTALLATIONS).insert({
                        id,
                        app_id: written.app_id,
                        current_app_id: written.app_id,
                        identity_key_thumbprint: written.identity_key_thumbprint,
                        status: written.status,
                        manifest_id: written.manifest_id,
                        created_at: now,
                        updated_at: now,
                    });
                    await trx(MANIFESTS).insert({
                        id: manifestId,
                        installation_id: id,
                        manifest_url: written.manifest_url,
                        manifest: loaded.serialised,
                        digest: loaded.digest,
                        backend_key_thumbprint: loaded.backendKeyThumbprint,
                        icon_data_url: iconDataUrl,
                        source: 'install',
                        requires_approval: false,
                        created_at: now,
                    });
                });
                break;
            }
            catch (err) {
                // Duplicate inserts can deadlock when several confirmations compete for
                // the unique current_app_id. MySQL rolls back the victim's transaction;
                // retry the whole write so it either commits or sees the winning install.
                if (err?.code === 'ER_LOCK_DEADLOCK' && attempt < 2) {
                    continue;
                }
                if (isUniqueViolation(err)) {
                    throw alreadyInstalled(manifest.id);
                }
                throw err;
            }
        }
        return zod_1.z.decode(codec_1.InstallationRow, written);
    }
    /**
     * Locks the installation and runs `write` on it, unless it has been uninstalled or changed
     * since `installation` was read. Every write moves the revision on, so a different revision
     * means it changed.
     */
    whileUnchanged(installation, write) {
        return this.knex.transaction(async (trx) => {
            const row = await trx(INSTALLATIONS)
                .where({ id: installation.id })
                .forUpdate()
                .first('status', 'revision');
            const locked = row ? zod_1.z.decode(LockedRow, row) : undefined;
            if (!locked || locked.status === 'uninstalled') {
                return { status: 'uninstalled' };
            }
            if (locked.revision !== installation.revision) {
                return { status: 'changed' };
            }
            return {
                status: 'written',
                value: await write(new LockedInstallation(trx, installation.id)),
            };
        });
    }
    /** Returns false if it was already uninstalled. */
    async uninstall(id) {
        const ended = await this.knex(INSTALLATIONS)
            .where({ id })
            .whereNot('status', 'uninstalled')
            .update({
            // In the same update as `status`, so the two always agree.
            current_app_id: null,
            status: 'uninstalled',
            ...nextRevision(this.knex),
        });
        return ended > 0;
    }
    withApprovedManifest() {
        return this.knex(`${INSTALLATIONS} as installation`).join(`${MANIFESTS} as approved`, 'approved.id', 'installation.manifest_id');
    }
}
exports.AppInstallationsRepository = AppInstallationsRepository;
