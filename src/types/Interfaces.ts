import type { Commitment, Connection, PublicKey, Transaction, TransactionSignature } from '@solana/web3.js';

export type LoopiumEnvironment = 'mainnet' | 'devnet' | 'localnet';

export interface Wallet {
  readonly publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions?(txs: Transaction[]): Promise<Transaction[]>;
}

export interface ConnectionLike {
  readonly rpcEndpoint: string;
  getLatestBlockhash(commitment?: Commitment): ReturnType<Connection['getLatestBlockhash']>;
}

export interface TransactionSender {
  sendTransaction(tx: Transaction, signers: never[], opts?: { commitment?: Commitment }): Promise<TransactionSignature>;
}

export interface LoopiumClientConfig {
  connection: Connection;
  wallet: Wallet;
  environment: LoopiumEnvironment;
  programId: PublicKey;
  commitment?: Commitment;
  defaultComputeUnitLimit?: number;
  defaultComputeUnitPriceMicroLamports?: bigint;
  assetRegistry?: AssetRegistry;
}

export interface AssetRegistry {
  resolveMint(assetSymbol: string): PublicKey;
}

export interface QuoteRequest {
  inMint: PublicKey;
  outMint: PublicKey;
  inAmount: bigint;
  maxSlippageBps: number;
}

export interface Quote {
  inAmount: bigint;
  outAmount: bigint;
  priceImpactBps?: number;
  slippageBps: number;
  routeId: string;
  latencyMs?: number;
}

export interface SwapPlan {
  adapterId: string;
  quote: Quote;
  buildInstructions(params: {
    userAuthority: PublicKey;
  }): Promise<{ instructions: import('@solana/web3.js').TransactionInstruction[]; lookupTables?: PublicKey[] }>;
}

export interface DexAdapter {
  readonly id: string;
  getQuote(req: QuoteRequest): Promise<Quote>;
  buildSwap(req: QuoteRequest, quote: Quote): Promise<SwapPlan>;
}

export interface PriceOracle {
  readonly id: string;
  getPrice(params: { mint: PublicKey }): Promise<{ price: number; lastUpdatedSlot: bigint; confidenceBps?: number }>;
}

export interface LoopObservability {
  emit(event: string, payload: unknown): void;
}
