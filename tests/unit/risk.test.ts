import { describe, expect, it } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { RiskEngine } from '../../src/risk/RiskEngine.js';
import type { PriceOracle } from '../../src/types/Interfaces.js';
import { OracleDeviationError, RiskThresholdExceededError } from '../../src/types/Errors.js';

const mint = PublicKey.unique();

function oracle(id: string, price: number, slot: bigint): PriceOracle {
  return {
    id,
    async getPrice() {
      return { price, lastUpdatedSlot: slot };
    }
  };
}

describe('RiskEngine', () => {
  it('passes oracle validation when within deviation', async () => {
    const engine = new RiskEngine();
    const res = await engine.assess({
      mint,
      slot: 100n,
      oracle: oracle('primary', 100, 100n),
      referenceOracle: oracle('ref', 101, 100n),
      cfg: { maxOracleDeviationBps: 200, maxVolatilityBps: 10_000, circuitBreakerEnabled: true }
    });
    expect(res.price).toBe(100);
  });

  it('throws OracleDeviationError when deviation exceeds threshold', async () => {
    const engine = new RiskEngine();
    await expect(
      engine.assess({
        mint,
        slot: 100n,
        oracle: oracle('primary', 100, 100n),
        referenceOracle: oracle('ref', 120, 100n),
        cfg: { maxOracleDeviationBps: 500, maxVolatilityBps: 10_000, circuitBreakerEnabled: true }
      })
    ).rejects.toBeInstanceOf(OracleDeviationError);
  });

  it('trips circuit breaker on volatility and then halts', async () => {
    const engine = new RiskEngine();

    // First assessment sets lastPrice baseline.
    const first = await engine.assess({
      mint,
      slot: 100n,
      oracle: oracle('primary', 100, 100n),
      cfg: { maxOracleDeviationBps: 10_000, maxVolatilityBps: 500, circuitBreakerEnabled: true }
    });
    expect(first.price).toBe(100);

    await expect(
      engine.assess({
        mint,
        slot: 101n,
        oracle: oracle('primary', 120, 101n),
        cfg: { maxOracleDeviationBps: 10_000, maxVolatilityBps: 500, circuitBreakerEnabled: true },
        lastPrice: 100
      })
    ).rejects.toBeInstanceOf(RiskThresholdExceededError);

    expect(engine.breaker.isTripped).toBe(true);

    await expect(
      engine.assess({
        mint,
        slot: 102n,
        oracle: oracle('primary', 100, 102n),
        cfg: { maxOracleDeviationBps: 10_000, maxVolatilityBps: 10_000, circuitBreakerEnabled: true }
      })
    ).rejects.toBeInstanceOf(RiskThresholdExceededError);
  });
});
