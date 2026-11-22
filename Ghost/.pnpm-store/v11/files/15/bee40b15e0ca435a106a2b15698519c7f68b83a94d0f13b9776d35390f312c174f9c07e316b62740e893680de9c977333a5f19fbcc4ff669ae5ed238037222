// src/shared/verifySignature.ts
import {
  hashTypedData,
  recoverAddress,
  isAddressEqual,
  getAddress,
  parseErc6492Signature,
  size
} from "viem";
var URL_IN_TEXT = /https?:\/\/\S+/gi;
function payerCodeLookupFailureMessage(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const stripped = raw.replace(URL_IN_TEXT, "[redacted-url]").replace(/\s+/g, " ").trim();
  return stripped.length > 0 ? stripped.slice(0, 200) : "payer eth_getCode failed";
}
var SECP256K1_N_HALF = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;
function isCanonicalEcdsaSignature(signature) {
  if (size(signature) !== 65) return false;
  const s = BigInt(`0x${signature.slice(2 + 64, 2 + 128)}`);
  return s <= SECP256K1_N_HALF;
}
function isPlainNonCanonicalEcdsaSignature(signature, isDeployedAtPayer) {
  if (size(signature) !== 65 || isCanonicalEcdsaSignature(signature)) return false;
  return !isDeployedAtPayer;
}
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
async function classifyErc6492Payer(signer, signature, payerAddress) {
  const erc6492Data = parseErc6492Signature(signature);
  const hasDeploymentInfo = !!(erc6492Data.address && erc6492Data.data && erc6492Data.data !== "0x" && !isAddressEqual(erc6492Data.address, ZERO_ADDRESS));
  const innerSignature = hasDeploymentInfo ? erc6492Data.signature : signature;
  const eip6492Deployment = hasDeploymentInfo ? { factoryAddress: erc6492Data.address, factoryCalldata: erc6492Data.data } : void 0;
  let code;
  let codeLookupError;
  try {
    code = await signer.getCode({ address: payerAddress });
  } catch (error) {
    codeLookupError = error;
    code = void 0;
  }
  const isDeployedAtPayer = !!(code && code !== "0x");
  const isCounterfactual = hasDeploymentInfo && !isDeployedAtPayer && codeLookupError === void 0;
  return {
    isCounterfactual,
    isDeployedAtPayer,
    hasDeploymentInfo,
    innerSignature,
    eip6492Deployment,
    payerCode: code,
    codeLookupError
  };
}
var ERC1271_MAGIC_VALUE = "0x1626ba7e";
var ERC1271_ABI = [
  {
    name: "isValidSignature",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" }
    ],
    outputs: [{ name: "", type: "bytes4" }]
  }
];
async function verifyTypedDataSignature(signer, params) {
  let digest;
  try {
    digest = hashTypedData({
      domain: params.domain,
      types: params.types,
      primaryType: params.primaryType,
      message: params.message
    });
  } catch {
    return false;
  }
  return verifyHashSignature(signer, params.address, digest, params.signature);
}
async function verifyHashSignature(signer, address, digest, signature) {
  let code;
  try {
    code = await signer.getCode({ address });
  } catch {
    return false;
  }
  return verifyHashSignatureWithCode(signer, address, code, digest, signature);
}
function verifyHashSignatureWithCode(signer, address, code, digest, signature) {
  if (!code || code === "0x") {
    return verifyECDSA(address, digest, signature);
  }
  return verifyERC1271(signer, address, digest, signature);
}
async function verifyECDSA(address, digest, signature) {
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (sigHex.length !== 130) return false;
  try {
    const recovered = await recoverAddress({ hash: digest, signature });
    return isAddressEqual(getAddress(recovered), getAddress(address));
  } catch {
    return false;
  }
}
async function verifyERC1271(signer, address, digest, signature) {
  try {
    const result = await signer.readContract({
      address,
      abi: ERC1271_ABI,
      functionName: "isValidSignature",
      args: [digest, signature]
    });
    if (typeof result !== "string") return false;
    return result.toLowerCase().startsWith(ERC1271_MAGIC_VALUE);
  } catch {
    return false;
  }
}

export {
  payerCodeLookupFailureMessage,
  isCanonicalEcdsaSignature,
  isPlainNonCanonicalEcdsaSignature,
  classifyErc6492Payer,
  verifyTypedDataSignature,
  verifyHashSignature,
  verifyHashSignatureWithCode
};
//# sourceMappingURL=chunk-5JE2UIZP.mjs.map