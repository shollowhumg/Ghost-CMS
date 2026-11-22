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
Object.defineProperty(exports, "__esModule", { value: true });
const define_service_1 = require("../../../kernel/define-service");
// Runs in the required services phase, after the models and storage adapters
// exist. The upload policy and the active storage adapter are read on every
// selection because the e2e lane boots Ghost repeatedly in one process with
// changed configuration. The adapter manager caches each adapter, so a repeat
// lookup returns the same instance until the configuration changes.
exports.default = (0, define_service_1.defineService)('Media inliner', () => {
    const MediaInliner = require('./external-media-inliner');
    const models = require('../../models');
    const adapterManager = require('../adapter-manager').default;
    const config = require('../../../shared/config');
    const jobsService = require('../jobs-service');
    const { isAllowedImageContent, isAllowedImageExtension, isSvgExtension, } = require('../../lib/image/image-content');
    // Resolved here so a missing or broken adapter fails init rather than the
    // first import.
    adapterManager.getAdapter('storage:media');
    adapterManager.getAdapter('storage:images');
    adapterManager.getAdapter('storage:files');
    return new MediaInliner({
        PostModel: models.Post,
        TagModel: models.Tag,
        UserModel: models.User,
        PostMetaModel: models.PostsMeta,
        logging: require('@tryghost/logging'),
        request: require('../../lib/request-external'),
        urlUtils: require('../../../shared/url-utils').default,
        // file-type is ESM-only. tsc emits this as `require('file-type')` under
        // module: commonjs, which resolves via Node's require(esm). The inliner
        // calls it on the first download, not at boot.
        loadFileType: () => Promise.resolve().then(() => __importStar(require('file-type'))),
        // Pulls in libheif-js, a WASM codec costing ~50ms to load, so the inliner
        // only calls it when a HEIC file needs converting.
        loadHeicConvert: () => require('heic-convert'),
        dispatchJob: (job) => jobsService.getInstance().dispatch(job),
        getMediaStorage: async (extension, fileBuffer) => {
            const imageExtensions = config.get('uploads').images.extensions;
            if (isAllowedImageExtension(extension, imageExtensions)) {
                // The extension falls back to the response's Content-Type or the
                // URL when the contents aren't recognised, so only store images
                // whose contents are an allowed format. SVGs are sanitized by the
                // inliner before they get here.
                if (isSvgExtension(extension) ||
                    (await isAllowedImageContent(fileBuffer, imageExtensions))) {
                    return adapterManager.getAdapter('storage:images');
                }
                return null;
            }
            else if (config.get('uploads').media.extensions.includes(extension)) {
                return adapterManager.getAdapter('storage:media');
            }
            else if (config.get('uploads').files.extensions.includes(extension)) {
                return adapterManager.getAdapter('storage:files');
            }
            else {
                return null;
            }
        },
    });
});
