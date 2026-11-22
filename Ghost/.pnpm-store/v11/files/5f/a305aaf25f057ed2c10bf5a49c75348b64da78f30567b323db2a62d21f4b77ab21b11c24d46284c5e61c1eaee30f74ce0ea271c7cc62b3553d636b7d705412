import { PendingSettlementStore } from '@x402/core/facilitator';
import { TypedData } from 'viem';
import { A as AssetTransferMethod } from './types-BBC1mC8d.js';
import { Network, PaymentPayload, PaymentRequirements, FacilitatorContext } from '@x402/core/types';

/**
 * Facilitator-delegated receiver authorizer: caller-identity binding.
 *
 * When the facilitator holds the `receiverAuthorizer` key, the `authorizerSignature` it
 * produces is no longer evidence of the server's intent, so the request is authenticated
 * out of band instead. The first authenticated caller to settle a payment is bound to its
 * `paymentInfoHash`; every later facilitator-signed step must come from the same identity.
 * The binding is written after re-verify and before broadcast, and fails closed.
 */

type DelegatedStep = "authorize" | "charge" | "capture" | "void" | "refund";
/** Context passed to {@link AuthCaptureFacilitatorConfig.resolveCallerIdentity}. */
type DelegatedSettleContext = {
    step: DelegatedStep;
    paymentInfoHash: `0x${string}`;
    network: Network;
    payer: string;
    payload: PaymentPayload;
    requirements: PaymentRequirements;
    facilitatorContext?: FacilitatorContext;
};
/** Caller binding for one payment. */
interface AuthCaptureDelegatedAuthRecord {
    network: Network;
    paymentInfoHash: `0x${string}`;
    /** Stable identity returned by `resolveCallerIdentity`. */
    callerIdentity: string;
    /** Unix seconds (`refundDeadline`). An expired row is treated as absent. */
    expiresAt: number;
}
/**
 * Result of {@link AuthCaptureDelegatedAuthStorage.bind}. `revertToken` is empty when the
 * row already existed, so a later revert leaves that row alone.
 */
interface AuthCaptureDelegatedAuthWrite {
    /** Row as stored after the write. */
    record: AuthCaptureDelegatedAuthRecord;
    /** Opaque host-defined token. Empty when this call did not create the row. */
    revertToken: string;
}
/** Pluggable storage for facilitator-delegated caller bindings. */
interface AuthCaptureDelegatedAuthStorage {
    /**
     * Insert the row when it is absent (an expired row counts as absent). The check and the
     * insert MUST be one atomic operation under concurrent callers, for example a unique key
     * on `network` and `paymentInfoHash` with insert-on-conflict.
     *
     * When a live row exists, leave its `callerIdentity` and `expiresAt` untouched and return
     * it with an empty `revertToken`. A different identity is rejected by the SDK through
     * {@link bindThenBroadcast}. A matching identity is an idempotent success; hosts SHOULD
     * rotate the stored token so a concurrent creator's revert no longer matches.
     *
     * @param record - Binding to store
     * @returns The stored row and a revert token when this call created it
     */
    bind(record: AuthCaptureDelegatedAuthRecord): Promise<AuthCaptureDelegatedAuthWrite>;
    /**
     * Delete the row only when `write.revertToken` is non-empty and still matches.
     *
     * @param write - The {@link AuthCaptureDelegatedAuthStorage.bind} result
     */
    revertBind(write: AuthCaptureDelegatedAuthWrite): Promise<void>;
    /**
     * Read one live row.
     *
     * @param network - CAIP-2 network
     * @param paymentInfoHash - Escrow payment identifier
     * @returns The stored row, or undefined when absent or expired
     */
    get(network: Network, paymentInfoHash: `0x${string}`): Promise<AuthCaptureDelegatedAuthRecord | undefined>;
    /**
     * Remove a row. Hosts SHOULD also purge expired rows (for example a TTL index on `expiresAt`).
     *
     * @param network - CAIP-2 network
     * @param paymentInfoHash - Escrow payment identifier
     */
    delete(network: Network, paymentInfoHash: `0x${string}`): Promise<void>;
}
/** Reported when a binding revert or early delete fails. Must not replace the settle result. */
type OnDelegatedAuthStorageError = (error: unknown, network: string, paymentInfoHash: string) => void;
/** First writer already bound this payment to a different caller identity. */
declare class AuthCaptureCallerIdentityConflictError extends Error {
    /** Create the first-writer-wins identity conflict. */
    constructor();
}
/**
 * In-memory {@link AuthCaptureDelegatedAuthStorage}. A per-row counter is the revert token:
 * a matching-identity bind on a live row rotates it and returns an empty token, so the
 * creator's revert no longer matches. Expired rows are purged lazily on `bind` and `get`.
 * Bindings are lost on restart, which fails closed.
 */
declare class InMemoryAuthCaptureDelegatedAuthStorage implements AuthCaptureDelegatedAuthStorage {
    private readonly rows;
    private nextToken;
    /** @inheritdoc */
    bind(record: AuthCaptureDelegatedAuthRecord): Promise<AuthCaptureDelegatedAuthWrite>;
    /** @inheritdoc */
    revertBind(write: AuthCaptureDelegatedAuthWrite): Promise<void>;
    /** @inheritdoc */
    get(network: Network, paymentInfoHash: `0x${string}`): Promise<AuthCaptureDelegatedAuthRecord | undefined>;
    /** @inheritdoc */
    delete(network: Network, paymentInfoHash: `0x${string}`): Promise<void>;
    /** Drop every expired row. */
    private purgeExpired;
}

/**
 * auth-capture wire-format types.
 *
 * Spec-level field names (captureAuthorizer, captureDeadline, refundDeadline,
 * feeRecipient) live here at the extra/wire layer. The onchain PaymentInfo
 * struct keeps the canonical Solidity field names (operator, authorizationExpiry,
 * refundExpiry, feeReceiver) so the EIP-712 typehash stays byte-identical with
 * the AuthCaptureEscrow contract.
 *
 * Salt is NOT in extra. It is generated client-side per signing call and rides
 * on the payload alongside the signature. When salt binding is on, `saltNonce`
 * is added beside `salt`.
 */

type AuthCapturePaymentFlow = "escrow" | "authorization";
type AuthCaptureCaptureMode = "sync" | "deferred";
type AuthCaptureOperatorType = "delegated" | "custom" | "policy";
interface AuthorizerSigner {
    address: `0x${string}`;
    signTypedData(params: {
        domain: Record<string, unknown>;
        types: TypedData;
        primaryType: string;
        message: Record<string, unknown>;
    }): Promise<`0x${string}`>;
}
type AuthCaptureLifecycleExtra = {
    paymentFlow?: "escrow";
    captureMode?: AuthCaptureCaptureMode;
    receiverAuthorizer?: `0x${string}`;
} | {
    paymentFlow: "authorization";
    captureMode?: never;
    receiverAuthorizer?: `0x${string}`;
};
type AuthCaptureDeadlineExtra = {
    captureDeadline: number;
    refundDeadline: number;
    captureDeadlineSeconds?: never;
    refundDeadlineSeconds?: never;
} | {
    captureDeadlineSeconds: number;
    refundDeadlineSeconds: number;
    captureDeadline?: never;
    refundDeadline?: never;
};
type AuthCaptureMerchantFeesExtra = {
    feeRecipient: `0x${string}`;
    minFeeBps: number;
    maxFeeBps: number;
    name: string;
    version: string;
    policy?: `0x${string}`;
    assetTransferMethod?: AssetTransferMethod;
};
type AuthCaptureDelegatedRouteExtra = AuthCaptureMerchantFeesExtra & {
    operatorType?: "delegated";
    /** Omitted for delegated routes when the facilitator advertises it on `/supported` extra. */
    captureAuthorizer?: `0x${string}`;
};
type AuthCaptureCustomRouteExtra = AuthCaptureMerchantFeesExtra & {
    operatorType: "custom";
    captureAuthorizer: `0x${string}`;
    /** Collect-only: the facilitator relays no lifecycle, so sync has nothing to finalize with. */
    captureMode?: "deferred";
};
/**
 * Merchant-authored route extra. Correlated optionals are unions so forbidden
 * combinations (captureMode on an authorization route, sync capture on a custom
 * operator, mixed absolute/relative deadlines) are unrepresentable when the
 * literal is checked with `satisfies AuthCaptureRouteExtra`. Escrow sync derives
 * `receiverAuthorizer` from the scheme signer when the route omits it.
 */
type AuthCaptureRouteExtra = (AuthCaptureDelegatedRouteExtra | AuthCaptureCustomRouteExtra) & AuthCaptureLifecycleExtra & AuthCaptureDeadlineExtra;
/**
 * Wire extra after `enhancePaymentRequirements`. Deadlines are always absolute.
 * `paymentFlow` / `captureMode` / `receiverAuthorizer` are independent optionals
 * here because the facilitator validates untrusted `Record<string, unknown>`.
 */
interface AuthCaptureExtra {
    captureAuthorizer: `0x${string}`;
    captureDeadline: number;
    refundDeadline: number;
    feeRecipient: `0x${string}`;
    minFeeBps: number;
    maxFeeBps: number;
    name: string;
    version: string;
    authCaptureEscrow?: `0x${string}`;
    paymentFlow?: AuthCapturePaymentFlow;
    captureMode?: AuthCaptureCaptureMode;
    receiverAuthorizer?: `0x${string}`;
    policy?: `0x${string}`;
    operatorType?: AuthCaptureOperatorType;
    assetTransferMethod?: AssetTransferMethod;
}
type AuthCaptureFeeTerms = {
    feeRecipient: `0x${string}`;
    minFeeBps: number;
    maxFeeBps: number;
};
type OperatorAllowlistEntry = {
    address: "*" | `0x${string}`;
    operatorType: "custom";
};
type AuthCaptureFacilitatorConfig = {
    feeTerms?: AuthCaptureFeeTerms;
    operators?: OperatorAllowlistEntry[];
    /**
     * Operator addresses `/supported` advertises one at a time as `extra.captureAuthorizer`.
     * Each MUST be an address of one of the facilitator signers, and stay usable (and funded
     * when {@link refundFunding} is on) until its payments pass `refundDeadline`. Omitted or
     * empty advertises every signer address. Settlement still accepts any signer address, so
     * narrowing the pool retires an address from new payments without stranding old ones.
     */
    captureAuthorizers?: `0x${string}`[];
    /**
     * Picks the pool member for one `/supported` response. An omitted selector, or a result
     * outside `candidates`, falls back to a random pick.
     */
    selectCaptureAuthorizer?: (network: string, candidates: readonly `0x${string}`[]) => `0x${string}` | undefined;
    /**
     * Enables facilitator-delegated receiver authorization. Advertised as `/supported`
     * `extra.receiverAuthorizer`; the facilitator signs `charge` and lifecycle digests with it
     * when the server omits `authorizerSignature`. Requires {@link resolveCallerIdentity}.
     */
    authorizerSigner?: AuthorizerSigner;
    /**
     * Authenticates the caller of a delegated settle out of band and returns a stable identity.
     * Returning `undefined` or an empty string (or throwing) rejects the settle. The identity
     * must be the same across the `authorize` and the later lifecycle settles of one payment.
     * Required when {@link authorizerSigner} is set, and only valid with it.
     */
    resolveCallerIdentity?: (ctx: DelegatedSettleContext) => Promise<string | undefined> | string | undefined;
    /**
     * Caller bindings for delegated payments. Required with {@link authorizerSigner},
     * {@link resolveCallerIdentity}, and {@link onStorageError}; omitted means delegation is off.
     */
    delegatedAuthStorage?: AuthCaptureDelegatedAuthStorage;
    /**
     * Called when reverting or deleting a binding fails. Required with delegation; must not
     * replace the settle result.
     */
    onStorageError?: OnDelegatedAuthStorageError;
    /**
     * Max gas for a custom-operator collect relay (`authorize` or `charge`).
     * Used as the verify reject threshold and as a hard broadcast ceiling.
     *
     * @default DEFAULT_CUSTOM_OPERATOR_AUTHORIZE_GAS_LIMIT (1_000_000)
     */
    customOperatorAuthorizeGasLimit?: bigint;
    /**
     * Allowlist of ERC-6492 preparation targets (hex strings, case-insensitive) the
     * facilitator accepts for an undeployed payer wallet.
     *
     * A counterfactual payer has no `isValidSignature` to call, so its signature can only
     * be validated by the onchain simulation, where the canonical token collector deploys
     * the wallet before checking the inner signature. The collector makes that preparation
     * call through Multicall3, so the facilitator is never its sender; the allowlist exists
     * to bound the gas an unknown preparation target can burn. An empty or omitted list
     * rejects every counterfactual payment.
     *
     * @default []
     */
    eip6492AllowedFactories?: string[];
    /**
     * When true, the facilitator relays `type: "refund"` for `"delegated"`
     * operators. Requires an out-of-band funding agreement: refunds pull tokens
     * from `PaymentInfo.operator`. With a rotated submitter set, every address
     * in the rotation must be funded and approved — `OperatorRefundCollector`
     * pulls with `safeTransferFrom(token, PaymentInfo.operator, ...)`.
     *
     * Each submitter also gets its own CREATE2 `TokenStore` on first authorize,
     * so N keys mean N deployment costs and escrow-held balances split N ways.
     */
    refundFunding?: boolean;
    /**
     * Lets a retried settle for the same payload reconcile against an
     * already-broadcast transaction instead of re-verifying and
     * re-broadcasting (see {@link PendingSettlementStore}). Defaults to a
     * fresh in-memory store shared across all settle calls on this scheme
     * instance.
     */
    pendingSettlementStore?: PendingSettlementStore;
};
type CaptureOptions = {
    feeReceiver?: `0x${string}`;
    feeBps?: number;
    feeAmount?: string;
} & ({
    amount?: string;
    voidRemainder?: false;
} | {
    amount: string;
    voidRemainder: true;
});
/**
 * Type guard for AuthCaptureExtra. Checks the structural shape an auth-capture
 * scheme requires inside `PaymentRequirements.extra`: every spec-mandated
 * required field present with the right primitive type.
 *
 * @param value - Candidate object from `requirements.extra`.
 * @returns True if `value` has every required AuthCaptureExtra field.
 */
declare function isAuthCaptureExtra(value: unknown): value is AuthCaptureExtra;
type ChargeCompletionV1_0 = {
    amount: string;
    feeBps: number;
    feeReceiver: `0x${string}`;
    /** Omitted when the authorizer is delegated to the facilitator. */
    authorizerSignature?: `0x${string}`;
};
type ChargeCompletionV1_1 = {
    amount: string;
    feeAmount: string;
    feeReceiver: `0x${string}`;
    authorizerSignature?: `0x${string}`;
};
type ChargeCompletion = ChargeCompletionV1_0 | ChargeCompletionV1_1;
type NoChargeCompletion = {
    amount?: never;
    feeBps?: never;
    feeAmount?: never;
    feeReceiver?: never;
    authorizerSignature?: never;
};
type CollectEnvelope<TAuth> = (TAuth & {
    salt: `0x${string}`;
    saltNonce?: never;
    type?: never;
} & NoChargeCompletion) | (TAuth & {
    salt: `0x${string}`;
    saltNonce: `0x${string}`;
    type?: never;
} & NoChargeCompletion) | (TAuth & {
    salt: `0x${string}`;
    saltNonce: `0x${string}`;
    type?: never;
} & ChargeCompletion);
type Eip3009Authorization = {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
};
type Permit2Authorization = {
    from: `0x${string}`;
    permitted: {
        token: `0x${string}`;
        amount: string;
    };
    spender: `0x${string}`;
    nonce: string;
    deadline: string;
};
type Eip3009Payload = CollectEnvelope<{
    authorization: Eip3009Authorization;
    signature: `0x${string}`;
}>;
type Permit2Payload = CollectEnvelope<{
    permit2Authorization: Permit2Authorization;
    signature: `0x${string}`;
}>;
type AuthCaptureCollectPayload = Eip3009Payload | Permit2Payload;
type LifecycleBase = {
    paymentInfo: PaymentInfoStruct;
    saltNonce: `0x${string}`;
    /** Omitted when the authorizer is delegated to the facilitator, which signs after authenticating the caller. */
    authorizerSignature?: `0x${string}`;
};
type CapturePayload = LifecycleBase & {
    type: "capture";
    amount: string;
    feeReceiver: `0x${string}`;
    expectedCapturableAmount: string;
    expectedRefundableAmount: string;
    voidAuthorizerSignature?: `0x${string}`;
    /**
     * Delegated authorizer only: asks the facilitator to sign the `Void` leg for the remaining
     * hold. Requires `authorizerSignature` and `voidAuthorizerSignature` to be absent.
     */
    voidRemainder?: true;
} & ({
    feeBps: number;
    feeAmount?: never;
} | {
    feeAmount: string;
    feeBps?: never;
});
type VoidPayload = LifecycleBase & {
    type: "void";
    voidAuthorizerSignature?: never;
    voidRemainder?: never;
};
type RefundPayload = LifecycleBase & {
    type: "refund";
    amount: string;
    expectedCapturableAmount: string;
    expectedRefundableAmount: string;
    voidAuthorizerSignature?: never;
    voidRemainder?: never;
};
type AuthCaptureLifecyclePayload = CapturePayload | VoidPayload | RefundPayload;
type AuthCapturePayload = AuthCaptureCollectPayload | AuthCaptureLifecyclePayload;
/**
 * Type guard for any auth-capture payload: collect or lifecycle.
 *
 * @param value - Candidate payment payload from the wire.
 * @returns True if `value` is a valid auth-capture envelope.
 */
declare function isAuthCapturePayload(value: unknown): value is AuthCapturePayload;
/**
 * Onchain PaymentInfo struct (canonical Solidity names — DO NOT RENAME).
 * Reconstructed by the facilitator from extra + payload.salt + payer + receiver/asset/amount.
 */
interface PaymentInfoStruct {
    operator: `0x${string}`;
    payer: `0x${string}`;
    receiver: `0x${string}`;
    token: `0x${string}`;
    maxAmount: string;
    preApprovalExpiry: number;
    authorizationExpiry: number;
    refundExpiry: number;
    minFeeBps: number;
    maxFeeBps: number;
    feeReceiver: `0x${string}`;
    salt: `0x${string}`;
}

export { type AuthCaptureFacilitatorConfig as A, type CaptureOptions as C, type DelegatedSettleContext as D, type Eip3009Payload as E, InMemoryAuthCaptureDelegatedAuthStorage as I, type OnDelegatedAuthStorageError as O, type PaymentInfoStruct as P, AuthCaptureCallerIdentityConflictError as a, type AuthCaptureDelegatedAuthRecord as b, type AuthCaptureDelegatedAuthStorage as c, type AuthCaptureDelegatedAuthWrite as d, type DelegatedStep as e, type AuthCapturePaymentFlow as f, type AuthCaptureOperatorType as g, type AuthorizerSigner as h, type AuthCaptureRouteExtra as i, type AuthCaptureExtra as j, type AuthCapturePayload as k, type Permit2Payload as l, isAuthCaptureExtra as m, isAuthCapturePayload as n };
