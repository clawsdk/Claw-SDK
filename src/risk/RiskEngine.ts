import type { PublicKey } from '@solana/web3.js';
import { RiskThresholdExceededError, ValidationError } from '../types/Errors.js';
import { assertBps, deviationBps } from '../utils/math.js';
import type { PriceOracle } from '../types/Interfaces.js';
import { CircuitBreaker } from './CircuitBreaker.js';
import { OracleValidator } from './OracleValidator.js';

export type RiskConfig = {
  maxOracleDeviationBps: number;
  maxVolatilityBps: number;
  maxStalenessSlots?: bigint;
  circuitBreakerEnabled: boolean;
};

export type RiskAssessment = {
  oracleDeviationOk: boolean;
  volatilityOk: boolean;
  flags: {
    oracleDeviation: boolean;
    volatilityExceeded: boolean;
    liquidityUnhealthy: boolean;
    circuitBreakerTripped: boolean;
  };
};

export class RiskEngine {
  private readonly circuitBreaker = new CircuitBreaker();
  private readonly oracleValidator = new OracleValidator();

  get breaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  async assess(params: {
    mint: PublicKey;
    slot: bigint;
    oracle: PriceOracle;
    referenceOracle?: PriceOracle;
    cfg: RiskConfig;
    lastPrice?: number;
    liquidityHealth?: { healthy: boolean; metric?: string; value?: number; threshold?: number };
  }): Promise<{ assessment: RiskAssessment; price: number }> {
    assertBps('cfg.maxOracleDeviationBps', params.cfg.maxOracleDeviationBps);
    assertBps('cfg.maxVolatilityBps', params.cfg.maxVolatilityBps);

    if (params.cfg.circuitBreakerEnabled) this.circuitBreaker.assertNotTripped();

    const flags = {
      oracleDeviation: false,
      volatilityExceeded: false,
      liquidityUnhealthy: false,
      circuitBreakerTripped: this.circuitBreaker.isTripped
    };

    const validateBase = {
      mint: params.mint,
      oracle: params.oracle,
      maxDeviationBps: params.cfg.maxOracleDeviationBps,
      currentSlot: params.slot,
      ...(params.cfg.maxStalenessSlots !== undefined ? { maxStalenessSlots: params.cfg.maxStalenessSlots } : {})
    };

    const { price } = params.referenceOracle
      ? await this.oracleValidator.validate({ ...validateBase, referenceOracle: params.referenceOracle })
      : await this.oracleValidator.validate(validateBase);

    let oracleDeviationOk = true;

    // OracleValidator throws on deviation; if we got here it’s OK.
    oracleDeviationOk = true;

    let volatilityOk = true;
    if (params.lastPrice !== undefined) {
      if (!Number.isFinite(params.lastPrice) || params.lastPrice <= 0) throw new ValidationError('lastPrice must be > 0');
      const volBps = deviationBps(params.lastPrice, price);
      if (volBps > params.cfg.maxVolatilityBps) {
        flags.volatilityExceeded = true;
        volatilityOk = false;
        if (params.cfg.circuitBreakerEnabled) {
          this.circuitBreaker.trip({ metric: 'volatilityBps', value: volBps, threshold: params.cfg.maxVolatilityBps });
          flags.circuitBreakerTripped = true;
        }
      }
    }

    if (params.liquidityHealth && !params.liquidityHealth.healthy) {
      flags.liquidityUnhealthy = true;
      if (params.cfg.circuitBreakerEnabled) {
        this.circuitBreaker.trip({
          metric: params.liquidityHealth.metric ?? 'liquidityHealth',
          value: params.liquidityHealth.value ?? 1,
          threshold: params.liquidityHealth.threshold ?? 0,
          message: 'Liquidity health check failed'
        });
        flags.circuitBreakerTripped = true;
      }
    }

    if (!oracleDeviationOk) flags.oracleDeviation = true;

    const assessment: RiskAssessment = {
      oracleDeviationOk,
      volatilityOk,
      flags
    };

    if (!assessment.oracleDeviationOk) {
      throw new RiskThresholdExceededError({ riskMetric: 'oracleDeviation', value: 1, threshold: 0 });
    }
    if (!assessment.volatilityOk) {
      throw new RiskThresholdExceededError({ riskMetric: 'volatility', value: 1, threshold: 0 });
    }
    if (flags.liquidityUnhealthy) {
      throw new RiskThresholdExceededError({ riskMetric: 'liquidityHealth', value: 1, threshold: 0 });
    }

    return { assessment, price };
  }
}
