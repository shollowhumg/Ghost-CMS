"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stripe_checkout_config_1 = __importDefault(require("../../services/stripe-checkout-config"));
const models_1 = require("../../services/stripe-checkout-config/models");
const serializers_1 = require("../../services/stripe-checkout-config/serializers");
const labs = require('../../../shared/labs');
/**
 * The site-wide Stripe Checkout config.
 *
 * It uses the tier permissions, because checkout is where tiers are sold. A save clears the
 * site's cache only when it changes what tiers list to anyone: a requirement, whether each of its
 * ports is bound, or the field a port names. The collected parts are only read and saved while
 * their private flag is on.
 */
const controller = {
    docName: 'checkout_config',
    read: {
        headers: { cacheInvalidate: false },
        permissions: { docName: 'products', method: 'read' },
        query() {
            return stripe_checkout_config_1.default.service.config.read();
        },
    },
    edit: {
        headers: { cacheInvalidate: false },
        permissions: { docName: 'products', method: 'edit' },
        async query(frame) {
            const [input] = frame.data.checkout_config;
            (0, serializers_1.refuseCollectionWhileOff)(input, labs.isSet(models_1.COLLECTION_FLAG));
            const { config } = stripe_checkout_config_1.default.service;
            const { changedRequirements } = await config.edit(stripe_checkout_config_1.default.extras.actingContext(frame.options.context), input);
            if (changedRequirements) {
                frame.setHeader('X-Cache-Invalidate', '/*');
            }
            return config.read();
        },
    },
};
// module.exports (not export): the API framework loads controllers via require().
module.exports = controller;
