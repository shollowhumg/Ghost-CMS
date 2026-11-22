"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.meter = exports.tracer = void 0;
const logging_1 = __importDefault(require("@tryghost/logging"));
const metrics_1 = __importDefault(require("@tryghost/metrics"));
const create_meter_1 = require("./create-meter");
const create_tracer_1 = require("./create-tracer");
/**
 * The one tracer every Ghost service records its spans with, so that every span ships the same
 * way. Spans ship through `@tryghost/metrics`, which Ghost(Pro) configures to send them to
 * Elasticsearch. Self-hosted sites leave `@tryghost/metrics` without a transport, so their spans
 * are never sent anywhere.
 */
exports.tracer = (0, create_tracer_1.createTracer)({ transport: metrics_1.default, logging: logging_1.default });
/** The meter Ghost's services count with, shipped the same way as the tracer's spans. */
exports.meter = (0, create_meter_1.createMeter)({ transport: metrics_1.default, logging: logging_1.default });
