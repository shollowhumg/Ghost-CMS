"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
module.exports = {
    uploadThumbnail(apiConfig, frame) {
        const parentFileName = path_1.default.basename(frame.data.url, path_1.default.extname(frame.data.url));
        frame.file.name = `${parentFileName}_thumb${frame.file.ext}`;
    },
};
