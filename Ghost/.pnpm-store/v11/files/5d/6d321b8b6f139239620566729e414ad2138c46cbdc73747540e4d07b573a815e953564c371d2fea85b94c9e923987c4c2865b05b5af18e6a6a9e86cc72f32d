import { z } from 'zod';
export { z } from 'zod';

/**
 * Non-empty string schema - a string with at least one character.
 * Used for required string fields that cannot be empty.
 */
declare const NonEmptyString: z.ZodString;
type NonEmptyString = z.infer<typeof NonEmptyString>;
/**
 * Any record schema - an object with unknown keys and values.
 * Used for scheme-specific payloads and other extensible objects.
 */
declare const Any: z.ZodRecord<z.ZodString, z.ZodUnknown>;
type Any = z.infer<typeof Any>;
/**
 * Optional any record schema - an optional object with unknown keys and values.
 * Used for optional extension fields like `extra` and `extensions`.
 */
declare const OptionalAny: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
type OptionalAny = z.infer<typeof OptionalAny>;
/**
 * Network identifier schema for V1 - loose validation.
 * V1 accepts any non-empty string for backwards compatibility.
 */
declare const NetworkSchemaV1: z.ZodString;
type NetworkV1 = z.infer<typeof NetworkSchemaV1>;
/**
 * Network identifier schema for V2 - CAIP-2 format validation.
 * V2 requires a CAIP-2 namespace and reference (e.g., "eip155:84532", "solana:devnet").
 */
declare const NetworkSchemaV2: z.ZodString;
type NetworkV2 = z.infer<typeof NetworkSchemaV2>;
/**
 * Union network schema - accepts either V1 or V2 format.
 */
declare const NetworkSchema: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
type Network = z.infer<typeof NetworkSchema>;
declare const ResourceInfoSchema: z.ZodObject<{
    url: z.ZodString;
    description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    mimeType: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    serviceName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    tags: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>, z.ZodTransform<string[] | undefined, string[] | null | undefined>>;
    iconUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
}, z.core.$strip>;
type ResourceInfo = z.infer<typeof ResourceInfoSchema>;
/**
 * PaymentRequirements schema for V1.
 * V1 includes resource info directly in the requirements object.
 */
declare const PaymentRequirementsV1Schema: z.ZodObject<{
    scheme: z.ZodString;
    network: z.ZodString;
    maxAmountRequired: z.ZodString;
    resource: z.ZodString;
    description: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    outputSchema: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    payTo: z.ZodString;
    maxTimeoutSeconds: z.ZodNumber;
    asset: z.ZodString;
    extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
type PaymentRequirementsV1 = z.infer<typeof PaymentRequirementsV1Schema>;
/**
 * PaymentRequired (402 response) schema for V1.
 * Contains payment requirements when a resource requires payment.
 */
declare const PaymentRequiredV1Schema: z.ZodObject<{
    x402Version: z.ZodLiteral<1>;
    error: z.ZodOptional<z.ZodString>;
    accepts: z.ZodArray<z.ZodObject<{
        scheme: z.ZodString;
        network: z.ZodString;
        maxAmountRequired: z.ZodString;
        resource: z.ZodString;
        description: z.ZodString;
        mimeType: z.ZodOptional<z.ZodString>;
        outputSchema: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        payTo: z.ZodString;
        maxTimeoutSeconds: z.ZodNumber;
        asset: z.ZodString;
        extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
type PaymentRequiredV1 = z.infer<typeof PaymentRequiredV1Schema>;
/**
 * PaymentPayload schema for V1.
 * Contains the payment data sent by the client.
 */
declare const PaymentPayloadV1Schema: z.ZodObject<{
    x402Version: z.ZodLiteral<1>;
    scheme: z.ZodString;
    network: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
type PaymentPayloadV1 = z.infer<typeof PaymentPayloadV1Schema>;
/**
 * PaymentRequirements schema for V2.
 * V2 uses "amount" instead of "maxAmountRequired" and doesn't include resource info.
 */
declare const PaymentRequirementsV2Schema: z.ZodObject<{
    scheme: z.ZodString;
    network: z.ZodString;
    amount: z.ZodString;
    asset: z.ZodString;
    payTo: z.ZodString;
    maxTimeoutSeconds: z.ZodNumber;
    extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
type PaymentRequirementsV2 = z.infer<typeof PaymentRequirementsV2Schema>;
/**
 * PaymentRequired (402 response) schema for V2.
 * Contains payment requirements when a resource requires payment.
 */
declare const PaymentRequiredV2Schema: z.ZodObject<{
    x402Version: z.ZodLiteral<2>;
    error: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    resource: z.ZodObject<{
        url: z.ZodString;
        description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        mimeType: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        serviceName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        tags: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>, z.ZodTransform<string[] | undefined, string[] | null | undefined>>;
        iconUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    }, z.core.$strip>;
    accepts: z.ZodArray<z.ZodObject<{
        scheme: z.ZodString;
        network: z.ZodString;
        amount: z.ZodString;
        asset: z.ZodString;
        payTo: z.ZodString;
        maxTimeoutSeconds: z.ZodNumber;
        extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>>;
    extensions: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
type PaymentRequiredV2 = z.infer<typeof PaymentRequiredV2Schema>;
/**
 * PaymentPayload schema for V2.
 * Contains the payment data sent by the client.
 */
declare const PaymentPayloadV2Schema: z.ZodObject<{
    x402Version: z.ZodLiteral<2>;
    resource: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        url: z.ZodString;
        description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        mimeType: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        serviceName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        tags: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>, z.ZodTransform<string[] | undefined, string[] | null | undefined>>;
        iconUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    }, z.core.$strip>>>, z.ZodTransform<{
        url: string;
        description: string | undefined;
        mimeType: string | undefined;
        serviceName: string | undefined;
        tags: string[] | undefined;
        iconUrl: string | undefined;
    } | undefined, {
        url: string;
        description: string | undefined;
        mimeType: string | undefined;
        serviceName: string | undefined;
        tags: string[] | undefined;
        iconUrl: string | undefined;
    } | null | undefined>>;
    accepted: z.ZodObject<{
        scheme: z.ZodString;
        network: z.ZodString;
        amount: z.ZodString;
        asset: z.ZodString;
        payTo: z.ZodString;
        maxTimeoutSeconds: z.ZodNumber;
        extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    extensions: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
type PaymentPayloadV2 = z.infer<typeof PaymentPayloadV2Schema>;
/**
 * PaymentRequirements union schema - accepts either V1 or V2 format.
 * Use this when you need to handle both versions.
 */
declare const PaymentRequirementsSchema: z.ZodUnion<readonly [z.ZodObject<{
    scheme: z.ZodString;
    network: z.ZodString;
    maxAmountRequired: z.ZodString;
    resource: z.ZodString;
    description: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    outputSchema: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    payTo: z.ZodString;
    maxTimeoutSeconds: z.ZodNumber;
    asset: z.ZodString;
    extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>, z.ZodObject<{
    scheme: z.ZodString;
    network: z.ZodString;
    amount: z.ZodString;
    asset: z.ZodString;
    payTo: z.ZodString;
    maxTimeoutSeconds: z.ZodNumber;
    extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>]>;
type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;
/**
 * PaymentRequired union schema - accepts either V1 or V2 format.
 * Uses discriminated union on x402Version for efficient parsing.
 */
declare const PaymentRequiredSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    x402Version: z.ZodLiteral<1>;
    error: z.ZodOptional<z.ZodString>;
    accepts: z.ZodArray<z.ZodObject<{
        scheme: z.ZodString;
        network: z.ZodString;
        maxAmountRequired: z.ZodString;
        resource: z.ZodString;
        description: z.ZodString;
        mimeType: z.ZodOptional<z.ZodString>;
        outputSchema: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        payTo: z.ZodString;
        maxTimeoutSeconds: z.ZodNumber;
        asset: z.ZodString;
        extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    x402Version: z.ZodLiteral<2>;
    error: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    resource: z.ZodObject<{
        url: z.ZodString;
        description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        mimeType: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        serviceName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        tags: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>, z.ZodTransform<string[] | undefined, string[] | null | undefined>>;
        iconUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    }, z.core.$strip>;
    accepts: z.ZodArray<z.ZodObject<{
        scheme: z.ZodString;
        network: z.ZodString;
        amount: z.ZodString;
        asset: z.ZodString;
        payTo: z.ZodString;
        maxTimeoutSeconds: z.ZodNumber;
        extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>>;
    extensions: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>], "x402Version">;
type PaymentRequired = z.infer<typeof PaymentRequiredSchema>;
/**
 * PaymentPayload union schema - accepts either V1 or V2 format.
 * Uses discriminated union on x402Version for efficient parsing.
 */
declare const PaymentPayloadSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    x402Version: z.ZodLiteral<1>;
    scheme: z.ZodString;
    network: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    x402Version: z.ZodLiteral<2>;
    resource: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        url: z.ZodString;
        description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        mimeType: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        serviceName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
        tags: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>, z.ZodTransform<string[] | undefined, string[] | null | undefined>>;
        iconUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | undefined, string | null | undefined>>;
    }, z.core.$strip>>>, z.ZodTransform<{
        url: string;
        description: string | undefined;
        mimeType: string | undefined;
        serviceName: string | undefined;
        tags: string[] | undefined;
        iconUrl: string | undefined;
    } | undefined, {
        url: string;
        description: string | undefined;
        mimeType: string | undefined;
        serviceName: string | undefined;
        tags: string[] | undefined;
        iconUrl: string | undefined;
    } | null | undefined>>;
    accepted: z.ZodObject<{
        scheme: z.ZodString;
        network: z.ZodString;
        amount: z.ZodString;
        asset: z.ZodString;
        payTo: z.ZodString;
        maxTimeoutSeconds: z.ZodNumber;
        extra: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    extensions: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>], "x402Version">;
type PaymentPayload = z.infer<typeof PaymentPayloadSchema>;
/**
 * Validates a PaymentRequired object (V1 or V2).
 *
 * @param value - The value to validate
 * @returns A result object with success status and data or error
 */
declare function parsePaymentRequired(value: unknown): ReturnType<typeof PaymentRequiredSchema.safeParse>;
/**
 * Validates a PaymentRequired object and throws on error.
 *
 * @param value - The value to validate
 * @returns The validated PaymentRequired
 * @throws ZodError if validation fails
 */
declare function validatePaymentRequired(value: unknown): PaymentRequired;
/**
 * Type guard for PaymentRequired (V1 or V2).
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentRequired
 */
declare function isPaymentRequired(value: unknown): value is PaymentRequired;
/**
 * Validates a PaymentRequirements object (V1 or V2).
 *
 * @param value - The value to validate
 * @returns A result object with success status and data or error
 */
declare function parsePaymentRequirements(value: unknown): ReturnType<typeof PaymentRequirementsSchema.safeParse>;
/**
 * Validates a PaymentRequirements object and throws on error.
 *
 * @param value - The value to validate
 * @returns The validated PaymentRequirements
 * @throws ZodError if validation fails
 */
declare function validatePaymentRequirements(value: unknown): PaymentRequirements;
/**
 * Type guard for PaymentRequirements (V1 or V2).
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentRequirements
 */
declare function isPaymentRequirements(value: unknown): value is PaymentRequirements;
/**
 * Validates a PaymentPayload object (V1 or V2).
 *
 * @param value - The value to validate
 * @returns A result object with success status and data or error
 */
declare function parsePaymentPayload(value: unknown): ReturnType<typeof PaymentPayloadSchema.safeParse>;
/**
 * Validates a PaymentPayload object and throws on error.
 *
 * @param value - The value to validate
 * @returns The validated PaymentPayload
 * @throws ZodError if validation fails
 */
declare function validatePaymentPayload(value: unknown): PaymentPayload;
/**
 * Type guard for PaymentPayload (V1 or V2).
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentPayload
 */
declare function isPaymentPayload(value: unknown): value is PaymentPayload;
/**
 * Type guard for PaymentRequiredV1.
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentRequiredV1
 */
declare function isPaymentRequiredV1(value: unknown): value is PaymentRequiredV1;
/**
 * Type guard for PaymentRequiredV2.
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentRequiredV2
 */
declare function isPaymentRequiredV2(value: unknown): value is PaymentRequiredV2;
/**
 * Type guard for PaymentRequirementsV1.
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentRequirementsV1
 */
declare function isPaymentRequirementsV1(value: unknown): value is PaymentRequirementsV1;
/**
 * Type guard for PaymentRequirementsV2.
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentRequirementsV2
 */
declare function isPaymentRequirementsV2(value: unknown): value is PaymentRequirementsV2;
/**
 * Type guard for PaymentPayloadV1.
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentPayloadV1
 */
declare function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1;
/**
 * Type guard for PaymentPayloadV2.
 *
 * @param value - The value to check
 * @returns True if the value is a valid PaymentPayloadV2
 */
declare function isPaymentPayloadV2(value: unknown): value is PaymentPayloadV2;

export { Any, type Network, NetworkSchema, NetworkSchemaV1, NetworkSchemaV2, type NetworkV1, type NetworkV2, NonEmptyString, OptionalAny, type PaymentPayload, PaymentPayloadSchema, type PaymentPayloadV1, PaymentPayloadV1Schema, type PaymentPayloadV2, PaymentPayloadV2Schema, type PaymentRequired, PaymentRequiredSchema, type PaymentRequiredV1, PaymentRequiredV1Schema, type PaymentRequiredV2, PaymentRequiredV2Schema, type PaymentRequirements, PaymentRequirementsSchema, type PaymentRequirementsV1, PaymentRequirementsV1Schema, type PaymentRequirementsV2, PaymentRequirementsV2Schema, type ResourceInfo, ResourceInfoSchema, isPaymentPayload, isPaymentPayloadV1, isPaymentPayloadV2, isPaymentRequired, isPaymentRequiredV1, isPaymentRequiredV2, isPaymentRequirements, isPaymentRequirementsV1, isPaymentRequirementsV2, parsePaymentPayload, parsePaymentRequired, parsePaymentRequirements, validatePaymentPayload, validatePaymentRequired, validatePaymentRequirements };
