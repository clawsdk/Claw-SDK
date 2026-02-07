import { RiskThresholdExceededError } from '../types/Errors.js';

export class CircuitBreaker {
  private tripped = false;
  private reason: { metric: string; value: number; threshold: number; message?: string } | null = null;

  trip(params: { metric: string; value: number; threshold: number; message?: string }): void {
    this.tripped = true;
    this.reason = params;
  }

  reset(): void {
    this.tripped = false;
    this.reason = null;
  }

  assertNotTripped(): void {
    if (!this.tripped) return;
    const r = this.reason;
    throw new RiskThresholdExceededError({
      riskMetric: r?.metric ?? 'circuitBreaker',
      value: r?.value ?? 1,
      threshold: r?.threshold ?? 0,
      message: r?.message ?? 'Circuit breaker tripped'
    });
  }

  get isTripped(): boolean {
    return this.tripped;
  }
}
