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
exports.mobiledoc = void 0;
const path_1 = __importDefault(require("path"));
const kg_card_factory_1 = require("@tryghost/kg-card-factory");
const kg_default_cards_1 = require("@tryghost/kg-default-cards");
const imageTransform = __importStar(require("@tryghost/image-transform"));
const config_1 = __importDefault(require("../../shared/config"));
const adapter_manager_1 = __importDefault(require("../services/adapter-manager"));
let cards = null;
exports.mobiledoc = {
    get blankDocument() {
        return {
            version: '0.3.1',
            ghostVersion: '4.0',
            markups: [],
            atoms: [],
            cards: [],
            sections: [[1, 'p', [[0, [], 0, '']]]],
        };
    },
    get cards() {
        if (!cards) {
            const cardFactory = new kg_card_factory_1.CardFactory({
                siteUrl: config_1.default.get('url'),
                imageBaseUrl: config_1.default.get('urls:image') || '',
                imageOptimization: config_1.default.get('imageOptimization'),
                canTransformImage(storagePath) {
                    const { ext } = path_1.default.parse(storagePath);
                    // NOTE: the "saveRaw" check is smelly
                    return (imageTransform.canTransformFiles() &&
                        imageTransform.shouldResizeFileExtension(ext) &&
                        typeof adapter_manager_1.default.getAdapter('storage:images').saveRaw === 'function');
                },
            });
            cards = kg_default_cards_1.cards.map((card) => {
                return cardFactory.createCard(card);
            });
        }
        return cards;
    },
    // allow config changes to be picked up - useful in tests
    reload() {
        cards = null;
    },
};
