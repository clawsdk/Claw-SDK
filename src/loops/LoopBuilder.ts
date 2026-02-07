import type { PublicKey } from '@solana/web3.js';
import { ValidationError } from '../types/Errors.js';
import type { LoopiumClient } from '../client/LoopiumClient.js';
import type { PriceOracle } from '../types/Interfaces.js';
import { LoopExecutor } from './LoopExecutor.js';
import type { Vault } from '../vaults/Vault.js';

export type LoopBuildParams = {
  vault: Vault | { address: PublicKey; owner: PublicKey; assetMint: PublicKey };
  maxRisk: number;
  rebalanceInterval: number;
  oracle: PriceOracle;
  referenceOracle?: PriceOracle;
};

export class LoopBuilder {
  private readonly client: LoopiumClient;

  constructor(params: { client: LoopiumClient }) {
    this.client = params.client;
  }

  build(params: LoopBuildParams): LoopExecutor {
    if (!params.vault?.address) throw new ValidationError('vault is required');

    const vault = {
      address: params.vault.address,
      owner: (params.vault as any).owner as PublicKey,
      assetMint: (params.vault as any).assetMint as PublicKey
    };

    if (!Number.isFinite(params.maxRisk) || params.maxRisk < 0 || params.maxRisk > 1) {
      throw new ValidationError('maxRisk must be a number in [0, 1]');
    }
    if (!Number.isInteger(params.rebalanceInterval) || params.rebalanceInterval <= 0) {
      throw new ValidationError('rebalanceInterval must be a positive integer (seconds)');
    }
    if (!params.oracle) throw new ValidationError('oracle is required');

    // Convert maxRisk ratio to bps boundaries for deterministic enforcement.
    const maxVolatilityBps = Math.round(params.maxRisk * 10_000);

    const base = {
      client: this.client,
      vault,
      rebalanceIntervalSec: params.rebalanceInterval,
      riskConfig: {
        maxOracleDeviationBps: Math.min(10_000, maxVolatilityBps),
        maxVolatilityBps,
        circuitBreakerEnabled: true
      },
      oracle: params.oracle
    };

    return params.referenceOracle
      ? new LoopExecutor({ ...base, referenceOracle: params.referenceOracle })
      : new LoopExecutor(base);
  }
}
