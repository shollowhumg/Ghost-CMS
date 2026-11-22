"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectIdSchema = void 0;
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const zod_1 = require("zod");
exports.ObjectIdSchema = zod_1.z.string().refine((value) => bson_objectid_1.default.isValid(value));
