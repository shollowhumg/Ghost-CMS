// src/builder-code/types.ts
var BUILDER_CODE = "builder-code";
var ERC_8021_MARKER = "80218021802180218021802180218021";
var SCHEMA_2_ID = 2;
var BUILDER_CODE_PATTERN = /^[a-z0-9_]{1,32}$/;
var MAX_CLIENT_SERVICE_CODES = 5;
var MAX_SERVER_SERVICE_CODES = 5;
var MAX_FACILITATOR_SERVICE_CODES = 1;
var MAX_SERVICE_CODES = MAX_CLIENT_SERVICE_CODES + MAX_SERVER_SERVICE_CODES + MAX_FACILITATOR_SERVICE_CODES;

// src/builder-code/cbor.ts
var MAX_CBOR_LENGTH = 65535;
var MAX_UINT64 = (1n << 64n) - 1n;
var CBOR_ARGUMENT_WIDTHS = [
  { info: 24, bytes: 1 },
  { info: 25, bytes: 2 },
  { info: 26, bytes: 4 },
  { info: 27, bytes: 8 }
];
function normalizeServiceCodes(s) {
  if (typeof s === "string") return [s];
  if (Array.isArray(s)) return s;
  return [];
}
function encodeCborMap(data) {
  const entries = [];
  let mapSize = 0;
  if (data.a) {
    mapSize++;
    entries.push(encodeCborString("a"));
    entries.push(encodeCborString(data.a));
  }
  if (data.w) {
    mapSize++;
    entries.push(encodeCborString("w"));
    entries.push(encodeCborString(data.w));
  }
  const serviceCodes = normalizeServiceCodes(data.s);
  if (serviceCodes.length > 0) {
    mapSize++;
    entries.push(encodeCborString("s"));
    entries.push(encodeCborArray(serviceCodes));
  }
  if (data.m) {
    mapSize++;
    entries.push(encodeCborString("m"));
    entries.push(encodeCborValue(data.m));
  }
  const header = encodeCborMajorType(5, mapSize);
  const totalLength = header.length + entries.reduce((sum, e) => sum + e.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  result.set(header, offset);
  offset += header.length;
  for (const entry of entries) {
    result.set(entry, offset);
    offset += entry.length;
  }
  return result;
}
function encodeCborString(value) {
  const encoded = new TextEncoder().encode(value);
  const header = encodeCborMajorType(3, encoded.length);
  const result = new Uint8Array(header.length + encoded.length);
  result.set(header, 0);
  result.set(encoded, header.length);
  return result;
}
function encodeCborArray(values) {
  const header = encodeCborMajorType(4, values.length);
  const encodedValues = values.map(encodeCborString);
  const totalLength = header.length + encodedValues.reduce((sum, e) => sum + e.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  result.set(header, offset);
  offset += header.length;
  for (const encoded of encodedValues) {
    result.set(encoded, offset);
    offset += encoded.length;
  }
  return result;
}
function encodeCborMajorType(majorType, value) {
  const mt = majorType << 5;
  const argument = BigInt(value);
  if (argument < 0n || argument > MAX_UINT64) {
    throw new Error(`CBOR value out of range: ${value}`);
  }
  if (argument <= 23n) {
    return new Uint8Array([mt | Number(argument)]);
  }
  const width = CBOR_ARGUMENT_WIDTHS.find(({ bytes }) => argument < 1n << BigInt(bytes * 8));
  if (!width) {
    throw new Error(`CBOR value out of range: ${value}`);
  }
  const header = new Uint8Array(1 + width.bytes);
  header[0] = mt | width.info;
  for (let i = 0; i < width.bytes; i++) {
    header[width.bytes - i] = Number(argument >> BigInt(i * 8) & 0xffn);
  }
  return header;
}
function concatBytes(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function compareBytes(a, b) {
  const common = Math.min(a.length, b.length);
  for (let i = 0; i < common; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}
function encodeCborValue(value) {
  if (typeof value === "string") {
    return encodeCborString(value);
  }
  if (typeof value === "number" || typeof value === "bigint") {
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      throw new Error(`CBOR metadata number must be a safe integer, use bigint instead: ${value}`);
    }
    return encodeCborMajorType(0, value);
  }
  if (isMetadataArray(value)) {
    return concatBytes([encodeCborMajorType(4, value.length), ...value.map(encodeCborValue)]);
  }
  if (!isPlainObject(value)) {
    throw new Error(`Unsupported CBOR metadata value: ${describeValue(value)}`);
  }
  const entries = Object.entries(value).map(([key, entry]) => ({ key: encodeCborString(key), value: encodeCborValue(entry) })).sort((a, b) => compareBytes(a.key, b.key));
  return concatBytes([
    encodeCborMajorType(5, entries.length),
    ...entries.flatMap((entry) => [entry.key, entry.value])
  ]);
}
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function describeValue(value) {
  if (value === null) return "null";
  if (typeof value === "object") return value.constructor?.name ?? "object";
  return typeof value;
}
function isMetadataArray(value) {
  return Array.isArray(value);
}
function encodeBuilderCodeSuffix(data) {
  const cborBytes = encodeCborMap(data);
  const cborLength = cborBytes.length;
  if (cborLength > MAX_CBOR_LENGTH) {
    throw new Error(`Builder code CBOR data is ${cborLength} bytes, maximum is ${MAX_CBOR_LENGTH}`);
  }
  const lengthHigh = cborLength >> 8 & 255;
  const lengthLow = cborLength & 255;
  const suffixBytes = new Uint8Array(cborLength + 2 + 1 + 16);
  let offset = 0;
  suffixBytes.set(cborBytes, offset);
  offset += cborLength;
  suffixBytes[offset++] = lengthHigh;
  suffixBytes[offset++] = lengthLow;
  suffixBytes[offset++] = SCHEMA_2_ID;
  const markerBytes = hexToBytes(ERC_8021_MARKER);
  suffixBytes.set(markerBytes, offset);
  return `0x${bytesToHex(suffixBytes)}`;
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function parseBuilderCodeSuffixFromCalldata(calldata) {
  const hex = calldata.startsWith("0x") ? calldata.slice(2) : calldata;
  const markerPos = hex.lastIndexOf(ERC_8021_MARKER.toLowerCase());
  if (markerPos < 6) {
    return void 0;
  }
  if (parseInt(hex.slice(markerPos - 2, markerPos), 16) !== SCHEMA_2_ID) {
    return void 0;
  }
  const cborLength = parseInt(hex.slice(markerPos - 6, markerPos - 2), 16);
  const suffixStart = markerPos - 6 - cborLength * 2;
  if (suffixStart < 0 || suffixStart + (cborLength + 19) * 2 !== hex.length) {
    return void 0;
  }
  const bytes = hexToBytes(hex.slice(suffixStart, markerPos - 6));
  let o = 0;
  if (bytes[o] >> 5 !== 5) {
    return void 0;
  }
  const mapInfo = bytes[o++] & 31;
  const mapSize = mapInfo <= 23 ? mapInfo : mapInfo === 24 ? bytes[o++] : void 0;
  if (mapSize === void 0) {
    return void 0;
  }
  const result = {};
  for (let entry = 0; entry < mapSize; entry++) {
    if (bytes[o] >> 5 !== 3) {
      return void 0;
    }
    const keyInfo = bytes[o++] & 31;
    const keyLen = keyInfo <= 23 ? keyInfo : keyInfo === 24 ? bytes[o++] : void 0;
    if (keyLen === void 0) {
      return void 0;
    }
    const key = new TextDecoder().decode(bytes.subarray(o, o + keyLen));
    o += keyLen;
    if (key === "a" || key === "w") {
      if (bytes[o] >> 5 !== 3) {
        return void 0;
      }
      const valueInfo = bytes[o++] & 31;
      const valueLen = valueInfo <= 23 ? valueInfo : valueInfo === 24 ? bytes[o++] : void 0;
      if (valueLen === void 0) {
        return void 0;
      }
      result[key] = new TextDecoder().decode(bytes.subarray(o, o + valueLen));
      o += valueLen;
      continue;
    }
    if (key === "s") {
      if (bytes[o] >> 5 !== 4) {
        return void 0;
      }
      const arrayInfo = bytes[o++] & 31;
      const arraySize = arrayInfo <= 23 ? arrayInfo : arrayInfo === 24 ? bytes[o++] : void 0;
      if (arraySize === void 0) {
        return void 0;
      }
      const codes = [];
      for (let i = 0; i < arraySize; i++) {
        if (bytes[o] >> 5 !== 3) {
          return void 0;
        }
        const itemInfo = bytes[o++] & 31;
        const itemLen = itemInfo <= 23 ? itemInfo : itemInfo === 24 ? bytes[o++] : void 0;
        if (itemLen === void 0) {
          return void 0;
        }
        codes.push(new TextDecoder().decode(bytes.subarray(o, o + itemLen)));
        o += itemLen;
      }
      if (codes.length > 0) {
        result.s = codes;
      }
      continue;
    }
    if (key === "m") {
      const cursor = { bytes, offset: o };
      try {
        result.m = readCborMap(cursor);
      } catch {
        return void 0;
      }
      o = cursor.offset;
      continue;
    }
    return void 0;
  }
  return result;
}
function peekMajorType(cursor) {
  if (cursor.offset >= cursor.bytes.length) {
    throw new Error("Unexpected end of CBOR data");
  }
  return cursor.bytes[cursor.offset] >> 5;
}
function readCborArgument(cursor) {
  peekMajorType(cursor);
  const info = cursor.bytes[cursor.offset++] & 31;
  if (info <= 23) {
    return BigInt(info);
  }
  const width = CBOR_ARGUMENT_WIDTHS.find((w) => w.info === info);
  if (!width || cursor.offset + width.bytes > cursor.bytes.length) {
    throw new Error("Unsupported CBOR argument");
  }
  let argument = 0n;
  for (let i = 0; i < width.bytes; i++) {
    argument = argument << 8n | BigInt(cursor.bytes[cursor.offset++]);
  }
  return argument;
}
function readCborLength(cursor) {
  const length = readCborArgument(cursor);
  if (length > BigInt(cursor.bytes.length - cursor.offset)) {
    throw new Error("CBOR length exceeds available data");
  }
  return Number(length);
}
function readCborText(cursor) {
  if (peekMajorType(cursor) !== 3) {
    throw new Error("Expected CBOR text string");
  }
  const length = readCborLength(cursor);
  const text = new TextDecoder().decode(
    cursor.bytes.subarray(cursor.offset, cursor.offset + length)
  );
  cursor.offset += length;
  return text;
}
function readCborValue(cursor) {
  switch (peekMajorType(cursor)) {
    case 0:
      return readCborArgument(cursor);
    case 3:
      return readCborText(cursor);
    case 4: {
      const items = [];
      for (let remaining = readCborLength(cursor); remaining > 0; remaining--) {
        items.push(readCborValue(cursor));
      }
      return items;
    }
    case 5:
      return readCborMap(cursor);
    default:
      throw new Error("Unsupported CBOR type in metadata");
  }
}
function readCborMap(cursor) {
  if (peekMajorType(cursor) !== 5) {
    throw new Error("Expected CBOR map");
  }
  const entries = [];
  for (let remaining = readCborLength(cursor); remaining > 0; remaining--) {
    entries.push([readCborText(cursor), readCborValue(cursor)]);
  }
  return Object.fromEntries(entries);
}

// src/builder-code/server.ts
var BUILDER_CODE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    a: {
      type: "string",
      pattern: "^[a-z0-9_]{1,32}$",
      description: "App builder code"
    },
    w: {
      type: "string",
      pattern: "^[a-z0-9_]{1,32}$",
      description: "Wallet builder code"
    },
    s: {
      type: "array",
      maxItems: MAX_SERVICE_CODES,
      items: {
        type: "string",
        pattern: "^[a-z0-9_]{1,32}$"
      },
      description: "Service builder codes"
    }
  },
  additionalProperties: false
};
function declareBuilderCodeExtension(appCode, serviceCodes) {
  if (!BUILDER_CODE_PATTERN.test(appCode)) {
    throw new Error(
      `Invalid builder code: "${appCode}". Must be 1-32 characters, lowercase alphanumeric and underscores only.`
    );
  }
  const codes = serviceCodes === void 0 ? [] : [].concat(serviceCodes);
  if (codes.length > MAX_SERVER_SERVICE_CODES) {
    throw new Error(
      `Too many service codes: ${codes.length} exceeds the maximum of ${MAX_SERVER_SERVICE_CODES}.`
    );
  }
  for (const code of codes) {
    if (!BUILDER_CODE_PATTERN.test(code)) {
      throw new Error(
        `Invalid builder code: "${code}". Must be 1-32 characters, lowercase alphanumeric and underscores only.`
      );
    }
  }
  return {
    info: codes.length > 0 ? { a: appCode, s: codes } : { a: appCode },
    schema: BUILDER_CODE_SCHEMA
  };
}
var builderCodeResourceServerExtension = {
  key: BUILDER_CODE
};

// src/builder-code/client.ts
var BuilderCodeClientExtension = class {
  /**
   * Creates a client extension that attaches the given service code(s) to payments.
   *
   * Accepts a single code or an array of codes so layered clients (e.g. an MCP
   * middleware) can attribute multiple participants. Codes are normalized to an
   * array and sent as the `s` field.
   *
   * @param serviceCodes - Client service code(s) (`s`), each 1-32 lowercase alphanumeric/underscore characters
   */
  constructor(serviceCodes) {
    this.key = BUILDER_CODE;
    const codes = Array.isArray(serviceCodes) ? serviceCodes : [serviceCodes];
    if (codes.length > MAX_CLIENT_SERVICE_CODES) {
      throw new Error(
        `Too many service codes: ${codes.length} exceeds the maximum of ${MAX_CLIENT_SERVICE_CODES}.`
      );
    }
    for (const code of codes) {
      if (!BUILDER_CODE_PATTERN.test(code)) {
        throw new Error(
          `Invalid builder code: "${code}". Must be 1-32 characters, lowercase alphanumeric and underscores only.`
        );
      }
    }
    this.serviceCodes = codes;
  }
  /**
   * Attaches this client's service code(s) (`s`).
   *
   * @param payload - Payment payload to enrich
   * @param _ - Server payment requirements; core merges server extension data
   * @returns Payment payload with builder-code extension data
   */
  async enrichPaymentPayload(payload, _) {
    return {
      ...payload,
      extensions: {
        ...payload.extensions,
        [BUILDER_CODE]: { info: { s: this.serviceCodes } }
      }
    };
  }
};

// src/builder-code/facilitator.ts
function extractClientExtension(extensions) {
  const info = extensions?.[BUILDER_CODE]?.info;
  if (typeof info !== "object" || info === null || Array.isArray(info)) return void 0;
  return info;
}
var MAX_ECHOED_SERVICE_CODES = MAX_CLIENT_SERVICE_CODES + MAX_SERVER_SERVICE_CODES;
function resolveServiceCodes(raw) {
  const candidates = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
  return candidates.filter((v) => typeof v === "string" && BUILDER_CODE_PATTERN.test(v)).slice(0, MAX_ECHOED_SERVICE_CODES);
}
var BuilderCodeFacilitatorExtension = class {
  /**
   * Creates a facilitator extension that encodes builder-code attribution at settlement.
   *
   * @param config - Optional facilitator builder-code configuration (wallet code `w`, service code `s`)
   */
  constructor(config = {}) {
    this.key = BUILDER_CODE;
    if (config.builderCode && !BUILDER_CODE_PATTERN.test(config.builderCode)) {
      throw new Error(
        `Invalid builder code: "${config.builderCode}". Must be 1-32 characters, lowercase alphanumeric and underscores only.`
      );
    }
    if (config.serviceCode && !BUILDER_CODE_PATTERN.test(config.serviceCode)) {
      throw new Error(
        `Invalid builder code: "${config.serviceCode}". Must be 1-32 characters, lowercase alphanumeric and underscores only.`
      );
    }
    this.config = config;
  }
  /**
   * Builds the ERC-8021 Schema 2 calldata suffix for a settlement transaction.
   *
   * - On v2 payloads, `a` is read from the client's payment payload extensions.
   * - On v1 payloads, client `a` is omitted (no resource-server echo gate); `s` is still read.
   * - `w` is the facilitator's own code when configured.
   * - The facilitator's own `s` entry (`config.serviceCode`) is appended after the
   *   echoed client/server codes, within its own {@link MAX_FACILITATOR_SERVICE_CODES}
   *   reservation.
   *
   * - `m` is the settlement metadata supplied by the settling mechanism in `ctx.metadata`.
   *   It is never read from the client payload.
   *
   * @param ctx - Settlement context with payment-payload extensions and optional metadata
   * @returns Hex-encoded ERC-8021 builder-code calldata suffix, or undefined when no attribution or metadata is present
   */
  buildDataSuffix(ctx) {
    const clientExt = extractClientExtension(ctx.paymentPayload.extensions);
    const a = ctx.paymentPayload.x402Version === 2 && typeof clientExt?.a === "string" && BUILDER_CODE_PATTERN.test(clientExt.a) ? clientExt.a : void 0;
    const echoedServiceCodes = resolveServiceCodes(clientExt?.s);
    const s = this.config.serviceCode && !echoedServiceCodes.includes(this.config.serviceCode) ? [...echoedServiceCodes, this.config.serviceCode] : echoedServiceCodes;
    const hasMetadata = ctx.metadata !== void 0 && Object.keys(ctx.metadata).length > 0;
    const data = {
      ...this.config.builderCode && { w: this.config.builderCode },
      ...a && { a },
      ...s.length > 0 && { s },
      ...hasMetadata && { m: ctx.metadata }
    };
    if (!data.a && !data.w && !data.m && (!data.s || Array.isArray(data.s) && data.s.length === 0)) {
      return void 0;
    }
    return encodeBuilderCodeSuffix(data);
  }
};

export {
  BUILDER_CODE,
  ERC_8021_MARKER,
  SCHEMA_2_ID,
  BUILDER_CODE_PATTERN,
  MAX_CLIENT_SERVICE_CODES,
  MAX_SERVER_SERVICE_CODES,
  MAX_FACILITATOR_SERVICE_CODES,
  MAX_SERVICE_CODES,
  encodeBuilderCodeSuffix,
  parseBuilderCodeSuffixFromCalldata,
  BUILDER_CODE_SCHEMA,
  declareBuilderCodeExtension,
  builderCodeResourceServerExtension,
  BuilderCodeClientExtension,
  BuilderCodeFacilitatorExtension
};
//# sourceMappingURL=chunk-5R6UOCTE.mjs.map