"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdown = exports.before = void 0;
var before_1 = require("./before");
Object.defineProperty(exports, "before", { enumerable: true, get: function () { return __importDefault(before_1).default; } });
var shutdown_1 = require("./shutdown");
Object.defineProperty(exports, "shutdown", { enumerable: true, get: function () { return __importDefault(shutdown_1).default; } });
