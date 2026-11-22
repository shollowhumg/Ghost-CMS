import { Network, SettleResponse, PaymentRequirements, SchemeNetworkServer, SchemeServerHooks, MoneyParser, Price, AssetAmount, SupportedKind } from '@x402/core/types';
import { FacilitatorClient, SettleContext, VerifiedPaymentCanceledContext, SettleResultContext } from '@x402/core/server';
import { A as AssetTransferMethod } from '../../types-BBC1mC8d.mjs';
import { P as PaymentInfoStruct, f as AuthCapturePaymentFlow, g as AuthCaptureOperatorType, C as CaptureOptions, h as AuthorizerSigner } from '../../types-BTGRjwKb.mjs';
export { i as AuthCaptureRouteExtra } from '../../types-BTGRjwKb.mjs';
import '@x402/core/facilitator';
import 'viem';

interface AuthorizedPayment {
    paymentInfoHash: `0x${string}`;
    paymentInfo: PaymentInfoStruct;
    saltNonce?: `0x${string}`;
    receiverAuthorizer: `0x${string}`;
    policy: `0x${string}`;
    network: Network;
    capturableAmount: string;
    refundableAmount: string;
    collectTransaction: string;
    createdAt: number;
    name: string;
    version: string;
    paymentFlow: AuthCapturePaymentFlow;
    operatorType: Exclude<AuthCaptureOperatorType, "policy">;
    assetTransferMethod: AssetTransferMethod;
    authCaptureEscrow: `0x${string}`;
}
interface AuthorizedPaymentUpdateResult {
    payment: AuthorizedPayment | undefined;
    status: "updated" | "unchanged" | "deleted";
}
interface AuthorizedPaymentStorage {
    get(paymentInfoHash: string): Promise<AuthorizedPayment | undefined>;
    list(): Promise<AuthorizedPayment[]>;
    /**
     * Atomically inspects and mutates a payment record.
     *
     * Implementations must guarantee that no concurrent mutation can interleave
     * between reading `current` and writing the callback result for all
     * application instances that share the backend. The in-memory backend only
     * provides this guarantee inside one JS runtime; production multi-instance
     * deployments need storage with backend-level atomic conditional mutation.
     *
     * @param paymentInfoHash - Storage key = AuthCaptureEscrow.getHash(paymentInfo).
     * @param update - Mutation callback. Return `undefined` to delete, or `current` to leave unchanged.
     * @returns The final stored payment and whether storage updated, stayed unchanged, or deleted.
     */
    update(paymentInfoHash: string, update: (current: AuthorizedPayment | undefined) => AuthorizedPayment | undefined): Promise<AuthorizedPaymentUpdateResult>;
}
/**
 * In-memory {@link AuthorizedPaymentStorage} backed by a Map keyed by paymentInfoHash.
 *
 * Atomicity is guaranteed only inside one JS runtime. Deferred captures are lost
 * on restart; the payer's protection in that case is `reclaim` after the capture
 * deadline.
 */
declare class InMemoryAuthorizedPaymentStorage implements AuthorizedPaymentStorage {
    private readonly payments;
    private readonly withLock;
    /**
     * Returns the payment record for a hash, if present.
     *
     * @param paymentInfoHash - Escrow payment identifier.
     * @returns The payment record or undefined when not found.
     */
    get(paymentInfoHash: string): Promise<AuthorizedPayment | undefined>;
    /**
     * Lists all stored payment records.
     *
     * @returns All payment records in storage.
     */
    list(): Promise<AuthorizedPayment[]>;
    /**
     * Atomically inspects and mutates a payment record while holding a per-key lock.
     *
     * @param paymentInfoHash - Escrow payment identifier.
     * @param update - Mutation callback. Return `undefined` to delete, or `current` to leave unchanged.
     * @returns The final stored payment and whether storage updated, stayed unchanged, or deleted.
     */
    update(paymentInfoHash: string, update: (current: AuthorizedPayment | undefined) => AuthorizedPayment | undefined): Promise<AuthorizedPaymentUpdateResult>;
}

interface AuthCaptureLifecycleManagerConfig {
    scheme: AuthCaptureEvmScheme;
    facilitator: FacilitatorClient;
}
/**
 * Out-of-band capture / void / refund against stored authorized payments.
 * Storage and the receiver-authorizer signer are read through the scheme. Payments whose
 * authorizer is delegated to the facilitator are sent unsigned.
 */
declare class AuthCaptureLifecycleManager {
    private readonly config;
    /**
     * Create a facilitator-bound lifecycle manager.
     *
     * @param config - Scheme (storage + signer) and facilitator client.
     */
    constructor(config: AuthCaptureLifecycleManagerConfig);
    /**
     * Capture a stored authorized payment through the facilitator.
     *
     * @param paymentInfoHash - Escrow payment identifier.
     * @param opts - Capture amount, fees, and optional void-remainder.
     * @returns Facilitator settle response.
     */
    capture(paymentInfoHash: `0x${string}`, opts?: CaptureOptions): Promise<SettleResponse>;
    /**
     * Void the remaining hold on a stored authorized payment.
     *
     * @param paymentInfoHash - Escrow payment identifier.
     * @returns Facilitator settle response.
     */
    voidPayment(paymentInfoHash: `0x${string}`): Promise<SettleResponse>;
    /**
     * Refund captured funds on a stored authorized payment.
     *
     * @param paymentInfoHash - Escrow payment identifier.
     * @param opts - Refund amount.
     * @param opts.amount - Atomic refund amount in token base units.
     * @returns Facilitator settle response.
     */
    refund(paymentInfoHash: `0x${string}`, opts: {
        amount: string;
    }): Promise<SettleResponse>;
    /**
     * Read a stored authorized payment.
     *
     * @param paymentInfoHash - Escrow payment identifier.
     * @returns The record, or undefined.
     */
    getAuthorizedPayment(paymentInfoHash: `0x${string}`): Promise<AuthorizedPayment | undefined>;
    /**
     * List stored authorized payments.
     *
     * @returns All records in storage.
     */
    listAuthorizedPayments(): Promise<AuthorizedPayment[]>;
    /**
     * POST a signed lifecycle payload to the configured facilitator client.
     *
     * @param record - Stored payment.
     * @param payload - Capture, void, or refund envelope.
     * @returns Facilitator settle response.
     */
    private settleLifecycle;
    /**
     * Load a stored payment and refuse the operations the facilitator would never relay for it:
     * custom operators (lifecycle is out of band), capture / void on an authorization-flow
     * payment (already a terminal charge, only a refund applies), and records without the
     * `saltNonce` lifecycle payloads need.
     *
     * @param paymentInfoHash - Storage key.
     * @param refund - True for a refund, the only operation an authorization-flow payment allows.
     * @returns The record and its `saltNonce`.
     */
    private resolve;
    /**
     * Signer for a stored payment's lifecycle payloads: the scheme signer when it is the
     * payment's authorizer, none when the authorizer is delegated to the facilitator (which
     * signs the unsigned payload), and an error when the payment is collect-only.
     *
     * @param record - Stored payment.
     * @returns The authorizer signer, or undefined to send unsigned payloads.
     */
    private signerFor;
}

interface AuthCaptureSettlementHooksConfig {
    storage: AuthorizedPaymentStorage;
    receiverAuthorizerSigner?: AuthorizerSigner;
}
/**
 * In-request settlement hooks: payload enrichment, cancel void, persist, and
 * deferred-settle skip. Storage and the receiver-authorizer signer only —
 * out-of-band capture/void/refund live on `AuthCaptureLifecycleManager`. Without a local
 * signer for the route's `receiverAuthorizer` the enrichments carry no signatures.
 */
declare class AuthCaptureSettlementHooks {
    private readonly config;
    private readonly authorizeResults;
    /**
     * Create settlement hooks bound to storage and an optional authorizer signer.
     *
     * @param config - Storage and optional receiver-authorizer signer.
     */
    constructor(config: AuthCaptureSettlementHooksConfig);
    /**
     * Additive payload enrichment for sync capture, bound charge, and cancel void.
     *
     * @param ctx - Settle context from core.
     * @returns Fields to merge into the client payload, or void when not applicable.
     */
    enrichSettlementPayload(ctx: SettleContext): Promise<Record<string, unknown> | void>;
    /**
     * On handler failure after a before-handler authorize, settle a void.
     *
     * @param context - Cancellation context.
     * @returns Requirements to settle, or void when there is no hold to release.
     */
    settleOnCancel(context: VerifiedPaymentCanceledContext): Promise<PaymentRequirements | void>;
    /**
     * Skip the after-handler facilitator settle for deferred escrow; echo the authorize receipt.
     *
     * @param ctx - Settle context.
     * @returns Skip directive with the prior authorize result, or void.
     */
    handleBeforeSettle(ctx: SettleContext): Promise<void | {
        skip: true;
        result: SettleResponse;
    }>;
    /**
     * Persist authorized-payment records and update balances after a successful settle.
     *
     * @param ctx - Settle result context.
     * @returns Nothing.
     */
    handleAfterSettle(ctx: SettleResultContext): Promise<void>;
    /**
     * Store a payment record after a successful collect settle.
     *
     * @param collect - Client collect payload.
     * @param ctx - Settle result context.
     * @param extra - Normalized extra used for reconstruction.
     * @param operation - `"authorize"` (hold) or `"charge"` (already captured).
     * @returns Nothing.
     */
    private persistCollect;
}

/**
 * AuthCapture Scheme - Server
 * Handles price parsing, requirement enhancement, and payment-flow selection.
 */

interface AuthCaptureServerConfig {
    storage?: AuthorizedPaymentStorage;
    receiverAuthorizerSigner?: AuthorizerSigner;
    /**
     * When true, skip startup checks that the facilitator advertises
     * `extra.receiverAuthorizer` when no local signer is configured. Use only when
     * every route is collect-only (escrow + deferred + explicit `receiverAuthorizer:
     * zeroAddress`).
     */
    collectOnlyRoutes?: boolean;
}
/**
 * Server-side implementation of the auth-capture scheme.
 */
declare class AuthCaptureEvmScheme implements SchemeNetworkServer {
    readonly scheme: "auth-capture";
    readonly dynamicExtraFields: string[];
    readonly defaultAssetTransferMethod: AssetTransferMethod;
    readonly paymentFlows: {
        readonly eip3009: {
            readonly supported: readonly ["escrow", "authorization"];
            readonly default: "escrow";
        };
        readonly permit2: {
            readonly supported: readonly ["escrow", "authorization"];
            readonly default: "escrow";
        };
    };
    readonly schemeHooks: SchemeServerHooks;
    readonly enrichSettlementPayload: (ctx: Parameters<AuthCaptureSettlementHooks["enrichSettlementPayload"]>[0]) => Promise<Record<string, unknown> | void>;
    private moneyParsers;
    private readonly storage;
    private readonly receiverAuthorizerSigner;
    private readonly collectOnlyRoutes;
    private readonly settlementHooks;
    /**
     * Construct a server-side auth-capture scheme.
     *
     * @param config - Optional storage and receiver-authorizer signer.
     */
    constructor(config?: AuthCaptureServerConfig);
    /**
     * Add a custom money parser to the chain. Parsers run in registration order;
     * the first one to return a non-null `AssetAmount` wins.
     *
     * @param parser - Function that maps a decimal amount to an `AssetAmount`, or `null` to defer.
     * @returns This server scheme instance, for fluent chaining.
     */
    registerMoneyParser(parser: MoneyParser): AuthCaptureEvmScheme;
    /**
     * Decimals for a known default asset, or undefined.
     *
     * @param asset - Asset address or symbol
     * @param network - Target network
     * @returns Decimals when the asset is a known default; otherwise undefined
     */
    getAssetDecimals(asset: string, network: Network): number | undefined;
    /**
     * Translate a merchant-supplied `Price` into a fully-resolved `AssetAmount`.
     *
     * @param price - `"$0.01"` / `0.01` / `{ asset, amount }`.
     * @param network - CAIP-2 network identifier used for default-asset lookup.
     * @returns The resolved `AssetAmount` containing token address and base units.
     */
    parsePrice(price: Price, network: Network): Promise<AssetAmount>;
    /**
     * Merge facilitator-advertised `extra` into the merchant's payment
     * requirements, resolve relative deadline offsets into absolute deadlines,
     * write the resolved `paymentFlow` / `captureMode`, and fail-fast on
     * misconfiguration.
     *
     * @param requirements - The merchant-authored payment requirements.
     * @param supportedKind - The facilitator's advertised support entry.
     * @param supportedKind.x402Version - Protocol version the facilitator advertises.
     * @param supportedKind.scheme - Scheme identifier (`"auth-capture"`).
     * @param supportedKind.network - CAIP-2 network identifier.
     * @param supportedKind.extra - Facilitator-injected `extra` fields (lowest priority on collision).
     * @param _ - Unused list of facilitator extensions (interface compatibility).
     * @returns Enhanced `PaymentRequirements` with merged `extra` and resolved deadlines.
     */
    enhancePaymentRequirements(requirements: PaymentRequirements, supportedKind: {
        x402Version: number;
        scheme: string;
        network: Network;
        extra?: Record<string, unknown>;
    }, _: string[]): Promise<PaymentRequirements>;
    /**
     * On handler failure after a before-handler authorize, settle a void.
     *
     * @param context - Cancellation context.
     * @returns Requirements to settle, or void when there is no hold to release.
     */
    settleOnCancel(context: VerifiedPaymentCanceledContext): Promise<PaymentRequirements | void>;
    /**
     * Returns the authorized-payment storage backend.
     *
     * @returns The configured {@link AuthorizedPaymentStorage}.
     */
    getStorage(): AuthorizedPaymentStorage;
    /**
     * Returns the receiver-authorizer signer, if configured.
     *
     * @returns Receiver-authorizer signer, or `undefined` when not set.
     */
    getReceiverAuthorizerSigner(): AuthorizerSigner | undefined;
    /**
     * Create a facilitator-bound manager for out-of-band capture / void / refund.
     *
     * @param facilitator - Facilitator client used to POST lifecycle settles.
     * @returns A lifecycle manager reading storage and the signer from this scheme.
     */
    createLifecycleManager(facilitator: FacilitatorClient): AuthCaptureLifecycleManager;
    /**
     * Fail server startup when the facilitator does not advertise a usable
     * `captureAuthorizer`, or when this server delegates receiver signing but the
     * facilitator does not advertise a non-zero `receiverAuthorizer`.
     *
     * @param network - The network identifier being validated.
     * @param supportedKind - The facilitator's advertised kind for this scheme/network.
     * @param _ - Extensions advertised by the facilitator (unused).
     * @returns A problem message when misconfigured, or void when valid.
     */
    validateFacilitatorSupport(network: Network, supportedKind: SupportedKind, _: string[]): string | void;
    /**
     * Resolve who authorizes facilitator-relayed `charge` and lifecycle, strictly and in order:
     * the scheme signer (self-managed); else the route's own `receiverAuthorizer` (`zeroAddress`
     * is explicit collect-only, the facilitator-advertised address is delegated, anything else
     * has no way to be signed); else the facilitator-advertised address. Throws instead of
     * silently falling back to collect-only.
     *
     * @param routeReceiverAuthorizer - `receiverAuthorizer` from the route's `extra`.
     * @param advertisedReceiverAuthorizer - `receiverAuthorizer` from the facilitator's `/supported` extra.
     * @returns The checksummed address to publish in `extra.receiverAuthorizer`.
     * @throws If no signer, route value, or facilitator advertisement can produce signatures.
     */
    private resolveReceiverAuthorizer;
    /**
     * Fall-through converter: resolves a decimal amount against the default
     * asset registered for the network in `getDefaultAsset`.
     *
     * @param amount - Decimal amount in the token's display units.
     * @param network - CAIP-2 network identifier.
     * @param symbol - Optional ticker from a suffixed price.
     * @returns Resolved `AssetAmount` with the network's default asset.
     */
    private defaultMoneyConversion;
}

export { AuthCaptureEvmScheme, AuthCaptureLifecycleManager, type AuthCaptureLifecycleManagerConfig, type AuthCaptureServerConfig, type AuthorizedPayment, type AuthorizedPaymentStorage, type AuthorizedPaymentUpdateResult, AuthorizerSigner, CaptureOptions, InMemoryAuthorizedPaymentStorage };
