import type { PublicKey } from '@solana/web3.js';
import { OracleDeviationError, ValidationError } from '../types/Errors.js';
import { deviationBps, assertBps } from '../utils/math.js';
import type { PriceOracle } from '../types/Interfaces.js';

export type OracleValidationParams = {
  mint: PublicKey;
  oracle: PriceOracle;
  referenceOracle?: PriceOracle;
  maxDeviationBps: number;
  maxStalenessSlots?: bigint;
  currentSlot: bigint;
};

export class OracleValidator {
  async validate(params: OracleValidationParams): Promise<{ price: number; deviationBps?: number }> {
    assertBps('maxDeviationBps', params.maxDeviationBps);
    if (params.maxStalenessSlots !== undefined && params.maxStalenessSlots < 0n) {
      throw new ValidationError('maxStalenessSlots must be >= 0');
    }

    const primary = await params.oracle.getPrice({ mint: params.mint });
    if (!Number.isFinite(primary.price) || primary.price <= 0) throw new ValidationError('Oracle returned invalid price');

    if (params.maxStalenessSlots !== undefined) {
      const age = params.currentSlot - primary.lastUpdatedSlot;
      if (age < 0n) throw new ValidationError('currentSlot must be >= oracle.lastUpdatedSlot');
      if (age > params.maxStalenessSlots) {
        throw new OracleDeviationError({
          feed: params.oracle.id,
          deviationBps: 10_000,
          maxDeviationBps: params.maxDeviationBps,
          message: `Oracle stale: age=${age.toString()} slots exceeds max=${params.maxStalenessSlots.toString()}`
        });
      }
    }

    if (!params.referenceOracle) return { price: primary.price };

    const ref = await params.referenceOracle.getPrice({ mint: params.mint });
    if (!Number.isFinite(ref.price) || ref.price <= 0) throw new ValidationError('Reference oracle returned invalid price');

    const dev = deviationBps(ref.price, primary.price);
    if (dev > params.maxDeviationBps) {
      throw new OracleDeviationError({ feed: params.oracle.id, deviationBps: dev, maxDeviationBps: params.maxDeviationBps });
    }

    return { price: primary.price, deviationBps: dev };
  }
}
