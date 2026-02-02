import type { PublicKey } from '@solana/web3.js';

export type VaultLifecycleState = 'uninitialized' | 'active' | 'unwinding' | 'closed';

export type VaultInitParams = {
  owner: PublicKey;
  assetMint: PublicKey;
  maxOracleDeviationBps: number;
  maxVolatilityBps: number;
  maxSlippageBps: number;
};

export type VaultAddresses = {
  vault: PublicKey;
  riskConfig: PublicKey;
  executionConfig: PublicKey;
  loopState: PublicKey;
  bumps: { vault: number; riskConfig: number; executionConfig: number; loopState: number };
};

export type VaultAccountDecoded = {
  owner: PublicKey;
  assetMint: PublicKey;
  state: number;
  bump: number;
  createdAtSlot: bigint;
  updatedAtSlot: bigint;
};
