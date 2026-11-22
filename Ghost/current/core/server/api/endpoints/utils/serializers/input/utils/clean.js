"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const tagRelation = (attrs) => {
    return lodash_1.default.pick(attrs, ['id', 'name', 'slug']);
};
module.exports.pagesTag = tagRelation;
module.exports.postsTag = tagRelation;
