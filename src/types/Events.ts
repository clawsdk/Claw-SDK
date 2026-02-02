import type { PublicKey, TransactionSignature } from '@solana/web3.js';

export type VaultHealth = {
  vault: PublicKey;
  assetMint: PublicKey;
  owner: PublicKey;
  state: 'uninitialized' | 'active' | 'unwinding' | 'closed';
  lastUpdatedSlot?: bigint;
};

export type RiskFlags = {
  oracleDeviation: boolean;
  volatilityExceeded: boolean;
  liquidityUnhealthy: boolean;
  circuitBreakerTripped: boolean;
};

export type ExecutionRecord = {
  timestampMs: number;
  stage: string;
  signature?: TransactionSignature;
  ok: boolean;
  error?: { name: string; code?: string; message: string };
};

export type LoopStateSnapshot = {
  vault: PublicKey;
  loopId: string;
  iteration: number;
  lastExecutionMs?: number;
  riskFlags: RiskFlags;
  history: ExecutionRecord[];
};
