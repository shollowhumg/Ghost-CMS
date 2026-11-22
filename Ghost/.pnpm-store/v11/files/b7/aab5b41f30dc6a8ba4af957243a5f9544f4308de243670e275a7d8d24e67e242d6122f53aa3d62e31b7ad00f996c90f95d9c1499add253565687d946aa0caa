import { SchemeNetworkFacilitator, PaymentPayload, PaymentRequirements, FacilitatorContext, VerifyResponse, SettleResponse } from '@x402/core/types';
import { F as FacilitatorEvmSigner } from '../../signer-okf_34IN.mjs';
import { A as AuthCaptureFacilitatorConfig } from '../../types-BTGRjwKb.mjs';
export { a as AuthCaptureCallerIdentityConflictError, b as AuthCaptureDelegatedAuthRecord, c as AuthCaptureDelegatedAuthStorage, d as AuthCaptureDelegatedAuthWrite, D as DelegatedSettleContext, e as DelegatedStep, I as InMemoryAuthCaptureDelegatedAuthStorage, O as OnDelegatedAuthStorageError } from '../../types-BTGRjwKb.mjs';
import 'viem';
import '@x402/core/facilitator';
import '../../types-BBC1mC8d.mjs';

/**
 * AuthCapture Scheme - Facilitator
 * Handles verification and settlement of auth-capture payments.
 *
 * Implements x402's SchemeNetworkFacilitator interface so the auth-capture scheme
 * is a drop-in for the x402 facilitator, just like ExactEvmScheme.
 *
 * Dispatches on `payload.type`: collect (authorize/charge) when absent, lifecycle
 * (capture/void/refund) when present. Operator type, not bytecode, selects the
 * settle target.
 */

/**
 * AuthCapture Facilitator Scheme - implements x402's SchemeNetworkFacilitator.
 *
 * Settle dispatch:
 *  - no `payload.type` + extra.paymentFlow escrow (default) → escrow.authorize()
 *  - no `payload.type` + extra.paymentFlow authorization → escrow.charge()
 *  - payload.type capture / void / refund → lifecycle
 *
 * Asset-transfer dispatch (extra.assetTransferMethod):
 *  - 'eip3009' (default) → ERC-3009 ReceiveWithAuthorization, EIP3009_TOKEN_COLLECTOR
 *  - 'permit2'           → Permit2 PermitTransferFrom, PERMIT2_TOKEN_COLLECTOR
 */
declare class AuthCaptureEvmScheme implements SchemeNetworkFacilitator {
    readonly scheme: "auth-capture";
    readonly caipFamily = "eip155:*";
    private readonly signers;
    private readonly pendingStore;
    private readonly config;
    private readonly captureAuthorizers;
    /**
     * Construct a facilitator-side auth-capture scheme bound to one or more signers.
     * Pass an array of single-address `toFacilitatorEvmSigner` results to rotate
     * submitters — do not register the scheme twice on the same network.
     *
     * @param signer - Facilitator signer, or a set of signers to rotate across.
     * @param config - Optional fee terms, operator allowlist, delegated refund funding, and
     *                 the facilitator-delegated receiver authorizer.
     * @throws If facilitator-delegated receiver authorization is only partially configured, or
     *         `captureAuthorizers` names an address no signer holds.
     */
    constructor(signer: FacilitatorEvmSigner | readonly FacilitatorEvmSigner[], config?: AuthCaptureFacilitatorConfig);
    /**
     * Return the flattened, deduped addresses this facilitator submits from.
     *
     * @param _ - Unused network argument (interface compatibility).
     * @returns The facilitator's submitter address(es) on this network.
     */
    getSigners(_: string): string[];
    /**
     * Facilitator-injected `extra` fields for `/supported`: a `captureAuthorizer` picked from
     * the pool (randomly, or by `selectCaptureAuthorizer`), the receiver authorizer when this
     * facilitator can authenticate delegated requests, grouped fee terms, and the
     * custom-operator allowlist.
     *
     * @param network - CAIP-2 network being advertised.
     * @returns Extra to merge into payment requirements, or undefined when empty.
     */
    getExtra(network: string): Record<string, unknown> | undefined;
    /**
     * Verify a payment payload against the published requirements without
     * touching state.
     *
     * @param payload - The wire payload from the payer or resource server.
     * @param requirements - The server's published payment requirements.
     * @param context - Optional facilitator context for extension hooks.
     * @returns A `VerifyResponse` with `isValid` and, on failure, a stable `invalidReason`.
     */
    verify(payload: PaymentPayload, requirements: PaymentRequirements, context?: FacilitatorContext): Promise<VerifyResponse>;
    /**
     * Verify-then-settle. Re-runs `verify()` against the payload, then submits
     * the collect or lifecycle call.
     *
     * @param payload - The wire payload from the payer or resource server.
     * @param requirements - The server's published payment requirements.
     * @param context - Optional facilitator context for extension hooks (e.g.
     *                  builder-code calldata suffixes).
     * @returns A `SettleResponse` with `success`, the transaction hash (on
     *          success), and a stable `errorReason` (on failure).
     */
    settle(payload: PaymentPayload, requirements: PaymentRequirements, context?: FacilitatorContext): Promise<SettleResponse>;
}

/**
 * Flatten and dedupe facilitator submitter addresses across a signer set.
 *
 * @param signers - Facilitator signers (each may expose one or more addresses).
 * @returns Unique addresses in first-seen order.
 */
declare function facilitatorAddresses(signers: readonly FacilitatorEvmSigner[]): readonly `0x${string}`[];
/**
 * Find the signer that can submit from `address`.
 *
 * Comparison is checksum-insensitive so a parsed `extra.captureAuthorizer`
 * still matches a lowercase `getAddresses()` entry.
 *
 * @param signers - Facilitator signers to scan.
 * @param address - Submitter to look up.
 * @returns The owning signer, or undefined when no member controls `address`.
 */
declare function selectSubmitter(signers: readonly FacilitatorEvmSigner[], address: `0x${string}`): FacilitatorEvmSigner | undefined;

export { AuthCaptureEvmScheme, AuthCaptureFacilitatorConfig, facilitatorAddresses, selectSubmitter };
