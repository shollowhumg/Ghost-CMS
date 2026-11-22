// src/auth-capture/types.ts
function isAuthCaptureExtra(value) {
  if (typeof value !== "object" || value === null) return false;
  const v = value;
  return typeof v.captureAuthorizer === "string" && typeof v.captureDeadline === "number" && typeof v.refundDeadline === "number" && typeof v.feeRecipient === "string" && typeof v.minFeeBps === "number" && typeof v.maxFeeBps === "number" && typeof v.name === "string" && typeof v.version === "string";
}
function isLifecyclePayload(value) {
  if (typeof value !== "object" || value === null) return false;
  const type = value.type;
  return type === "capture" || type === "void" || type === "refund";
}
function isCapturePayload(value) {
  if (!isLifecyclePayload(value) || value.type !== "capture") return false;
  const v = value;
  const hasFeeBps = typeof v.feeBps === "number";
  const hasFeeAmount = typeof v.feeAmount === "string";
  if (hasFeeBps === hasFeeAmount) return false;
  return isPaymentInfoStruct(v.paymentInfo) && typeof v.saltNonce === "string" && typeof v.amount === "string" && typeof v.feeReceiver === "string" && typeof v.expectedCapturableAmount === "string" && typeof v.expectedRefundableAmount === "string" && (v.authorizerSignature === void 0 || typeof v.authorizerSignature === "string") && (v.voidAuthorizerSignature === void 0 || typeof v.voidAuthorizerSignature === "string") && isDelegatedCaptureShape(v);
}
function isDelegatedCaptureShape(v) {
  if (v.voidRemainder !== void 0) {
    return v.voidRemainder === true && v.authorizerSignature === void 0 && v.voidAuthorizerSignature === void 0;
  }
  return v.authorizerSignature !== void 0 || v.voidAuthorizerSignature === void 0;
}
function isVoidPayload(value) {
  if (!isLifecyclePayload(value) || value.type !== "void") return false;
  const v = value;
  return isPaymentInfoStruct(v.paymentInfo) && typeof v.saltNonce === "string" && (v.authorizerSignature === void 0 || typeof v.authorizerSignature === "string") && v.voidAuthorizerSignature === void 0 && v.voidRemainder === void 0;
}
function isRefundPayload(value) {
  if (!isLifecyclePayload(value) || value.type !== "refund") return false;
  const v = value;
  return isPaymentInfoStruct(v.paymentInfo) && typeof v.saltNonce === "string" && typeof v.amount === "string" && typeof v.expectedCapturableAmount === "string" && typeof v.expectedRefundableAmount === "string" && (v.authorizerSignature === void 0 || typeof v.authorizerSignature === "string") && v.voidAuthorizerSignature === void 0 && v.voidRemainder === void 0;
}
function isPaymentInfoStruct(value) {
  if (typeof value !== "object" || value === null) return false;
  const v = value;
  return typeof v.operator === "string" && typeof v.payer === "string" && typeof v.receiver === "string" && typeof v.token === "string" && typeof v.maxAmount === "string" && typeof v.preApprovalExpiry === "number" && typeof v.authorizationExpiry === "number" && typeof v.refundExpiry === "number" && typeof v.minFeeBps === "number" && typeof v.maxFeeBps === "number" && typeof v.feeReceiver === "string" && typeof v.salt === "string";
}
function isHexString(value) {
  return typeof value === "string" && value.startsWith("0x");
}
function isOptionalString(value) {
  return value === void 0 || typeof value === "string";
}
function readChargeCompletion(v) {
  const hasAny = "amount" in v || "feeBps" in v || "feeAmount" in v || "feeReceiver" in v || "authorizerSignature" in v;
  if (!hasAny) return void 0;
  if (typeof v.amount === "string" && typeof v.feeBps === "number" && v.feeAmount === void 0 && typeof v.feeReceiver === "string" && isOptionalString(v.authorizerSignature)) {
    return {
      amount: v.amount,
      feeBps: v.feeBps,
      feeReceiver: v.feeReceiver,
      authorizerSignature: v.authorizerSignature
    };
  }
  if (typeof v.amount === "string" && typeof v.feeAmount === "string" && v.feeBps === void 0 && typeof v.feeReceiver === "string" && isOptionalString(v.authorizerSignature)) {
    return {
      amount: v.amount,
      feeAmount: v.feeAmount,
      feeReceiver: v.feeReceiver,
      authorizerSignature: v.authorizerSignature
    };
  }
  return void 0;
}
function collectExtras(v) {
  if (!isHexString(v.salt)) return void 0;
  if (v.saltNonce === void 0) {
    return { salt: v.salt };
  }
  if (!isHexString(v.saltNonce)) return void 0;
  return { salt: v.salt, saltNonce: v.saltNonce };
}
function isEip3009Payload(value) {
  if (typeof value !== "object" || value === null) return false;
  const v = value;
  if (v.type !== void 0) return false;
  if (typeof v.authorization !== "object" || v.authorization === null || typeof v.signature !== "string") {
    return false;
  }
  const saltFields = collectExtras(v);
  if (!saltFields) return false;
  const hasAnyCharge = "amount" in v || "feeBps" in v || "feeAmount" in v || "feeReceiver" in v || "authorizerSignature" in v;
  if (hasAnyCharge) {
    if (!saltFields.saltNonce) return false;
    return readChargeCompletion(v) !== void 0;
  }
  return true;
}
function isPermit2Payload(value) {
  if (typeof value !== "object" || value === null) return false;
  const v = value;
  if (v.type !== void 0) return false;
  if (typeof v.signature !== "string") return false;
  if (typeof v.permit2Authorization !== "object" || v.permit2Authorization === null) return false;
  const a = v.permit2Authorization;
  if (typeof a.from !== "string" || typeof a.spender !== "string" || typeof a.nonce !== "string" || typeof a.deadline !== "string" || typeof a.permitted !== "object" || a.permitted === null) {
    return false;
  }
  const saltFields = collectExtras(v);
  if (!saltFields) return false;
  const hasAnyCharge = "amount" in v || "feeBps" in v || "feeAmount" in v || "feeReceiver" in v || "authorizerSignature" in v;
  if (hasAnyCharge) {
    if (!saltFields.saltNonce) return false;
    return readChargeCompletion(v) !== void 0;
  }
  return true;
}
function isAuthCaptureCollectPayload(value) {
  return isEip3009Payload(value) || isPermit2Payload(value);
}
function isAuthCapturePayload(value) {
  if (isLifecyclePayload(value)) {
    return isCapturePayload(value) || isVoidPayload(value) || isRefundPayload(value);
  }
  return isAuthCaptureCollectPayload(value);
}

export {
  isAuthCaptureExtra,
  isLifecyclePayload,
  isCapturePayload,
  isVoidPayload,
  isRefundPayload,
  isEip3009Payload,
  isPermit2Payload,
  isAuthCaptureCollectPayload,
  isAuthCapturePayload
};
//# sourceMappingURL=chunk-XE4FB4AB.mjs.map