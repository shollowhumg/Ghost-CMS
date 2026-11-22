type EvmSchemeConfig = {
    /**
     * JSON-RPC endpoint used to backfill chain reads the signer cannot do itself
     * (`readContract`, `getTransactionCount`, `estimateFeesPerGas`).
     *
     * Required for gas-sponsored Permit2 payments when the signer is a bare
     * account (`privateKeyToAccount`): signing the sponsored EIP-2612 permit
     * needs to read `allowance` and `nonces`. Without either this option or a
     * signer that can read, the permit is skipped, a warning is logged, and a
     * wallet with no Permit2 allowance gets `412 permit2_allowance_required`.
     */
    rpcUrl?: string;
};
type EvmSchemeConfigByChainId = Record<number, EvmSchemeConfig>;
type EvmSchemeOptions = EvmSchemeConfig | EvmSchemeConfigByChainId;
/** @deprecated Use EvmSchemeConfig */
type ExactEvmSchemeConfig = EvmSchemeConfig;
/** @deprecated Use EvmSchemeConfigByChainId */
type ExactEvmSchemeConfigByChainId = EvmSchemeConfigByChainId;
/** @deprecated Use EvmSchemeOptions */
type ExactEvmSchemeOptions = EvmSchemeOptions;

export type { EvmSchemeOptions as E, ExactEvmSchemeConfig as a, ExactEvmSchemeConfigByChainId as b, ExactEvmSchemeOptions as c, EvmSchemeConfig as d, EvmSchemeConfigByChainId as e };
