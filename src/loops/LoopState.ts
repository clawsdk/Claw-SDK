import type { PublicKey } from '@solana/web3.js';
import type { ExecutionRecord, LoopStateSnapshot, RiskFlags } from '../types/Events.js';

export class LoopState {
  private readonly vault: PublicKey;
  private readonly loopId: string;
  private iteration = 0;
  private lastExecutionMs?: number;
  private history: ExecutionRecord[] = [];
  private riskFlags: RiskFlags = {
    oracleDeviation: false,
    volatilityExceeded: false,
    liquidityUnhealthy: false,
    circuitBreakerTripped: false
  };

  constructor(params: { vault: PublicKey; loopId: string }) {
    this.vault = params.vault;
    this.loopId = params.loopId;
  }

  nextIteration(): void {
    this.iteration += 1;
  }

  setRiskFlags(flags: RiskFlags): void {
    this.riskFlags = { ...flags };
  }

  record(rec: ExecutionRecord): void {
    this.history = [...this.history, rec];
    this.lastExecutionMs = rec.timestampMs;
  }

  snapshot(): LoopStateSnapshot {
    const base = {
      vault: this.vault,
      loopId: this.loopId,
      iteration: this.iteration,
      riskFlags: this.riskFlags,
      history: this.history
    };

    return this.lastExecutionMs !== undefined ? { ...base, lastExecutionMs: this.lastExecutionMs } : base;
  }
}
