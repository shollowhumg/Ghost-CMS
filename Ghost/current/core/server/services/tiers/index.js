"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logging_1 = __importDefault(require("@tryghost/logging"));
const define_service_1 = require("../../../kernel/define-service");
const requirements_1 = require("./requirements");
// Publishes the API and the cached tiers behind it together, once the tiers have loaded.
// Test fixtures reload the repository after inserting products. Boot sets up the custom fields
// services first, as tier requirements read which ports are bound to a custom field, and which
// field each names.
exports.default = (0, define_service_1.defineService)('Tiers', async () => {
    const DomainEvents = require('@tryghost/domain-events');
    const { knex } = require('../../data/db');
    const models = require('../../models');
    const metafields = require('../members-metafields');
    const TierRepository = require('./tier-repository');
    const TiersAPI = require('./tiers-api');
    const { bindings } = metafields.booted();
    // Requirements are read fresh on every tier read that asks for them, while the tiers
    // themselves stay cached.
    const requirements = new requirements_1.TierRequirements({
        knex,
        boundPorts: (ports, executor) => bindings.boundPorts(ports, executor),
        logging: logging_1.default,
    });
    const repository = new TierRepository({
        ProductModel: models.Product,
        DomainEvents,
        requirements,
    });
    const slugService = {
        async generate(input) {
            return models.Product.generateSlug(models.Product, input, {});
        },
    };
    await repository.init();
    const api = new TiersAPI({
        repository,
        slugService,
    });
    return { api, repository, requirements };
});
