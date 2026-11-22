"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var zod_exports = {};
__export(zod_exports, {
  formatZodIssues: () => formatZodIssues,
  fromZodError: () => fromZodError,
  getZodErrorDetails: () => getZodErrorDetails,
  isZodError: () => isZodError
});
module.exports = __toCommonJS(zod_exports);
var import_errors = require("./errors");
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
function formatPath(path) {
  return path.reduce((result, key) => {
    if (typeof key === "number") {
      return `${result}[${key}]`;
    }
    if (typeof key === "symbol") {
      return `${result}[${String(key)}]`;
    }
    if (!IDENTIFIER.test(key)) {
      return `${result}[${JSON.stringify(key)}]`;
    }
    return result ? `${result}.${key}` : key;
  }, "");
}
function isZodIssueLike(issue) {
  if (!issue || typeof issue !== "object") {
    return false;
  }
  const { code, path, message } = issue;
  return typeof code === "string" && typeof message === "string" && Array.isArray(path);
}
function isZodError(err) {
  if (!err || typeof err !== "object") {
    return false;
  }
  const { issues } = err;
  return Array.isArray(issues) && issues.every(isZodIssueLike);
}
function getZodErrorDetails(issues) {
  return issues.map(({ path, message, code }) => ({ path: formatPath(path), message, code }));
}
function formatZodIssues(issues) {
  return getZodErrorDetails(issues).map(({ path, message }) => path ? `${path}: ${message}` : message).join("; ");
}
function fromZodError(err, classOrOptions, maybeOptions) {
  const ErrorClass = typeof classOrOptions === "function" ? classOrOptions : import_errors.ValidationError;
  const overrides = (typeof classOrOptions === "function" ? maybeOptions : classOrOptions) ?? {};
  const details = getZodErrorDetails(err.issues);
  const wrapped = new Error(formatZodIssues(err.issues));
  if (err.stack) {
    const frames = err.stack.split("\n").filter((line) => /^\s+at /.test(line));
    wrapped.stack = [`ZodError: ${wrapped.message}`, ...frames].join("\n");
  }
  const derived = {
    message: wrapped.message || void 0,
    property: details[0]?.path || void 0,
    errorDetails: details,
    err: wrapped
  };
  Object.keys(overrides).forEach((key) => {
    if (overrides[key] !== void 0) {
      derived[key] = overrides[key];
    }
  });
  return new ErrorClass(derived);
}
