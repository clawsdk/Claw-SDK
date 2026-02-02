import { describe, expect, it } from 'vitest';
import { asLoopiumError, ExecutionFailureError, InvalidVaultStateError } from '../../src/types/Errors.js';

describe('Errors', () => {
  it('preserves LoopiumError instances', () => {
    const e = new InvalidVaultStateError('vault', 'bad');
    expect(asLoopiumError(e)).toBe(e);
  });

  it('wraps native Error deterministically', () => {
    const native = new Error('boom');
    const wrapped = asLoopiumError(native);
    expect(wrapped).toBeInstanceOf(ExecutionFailureError);
    expect(wrapped.message).toContain('boom');
  });

  it('wraps unknown values deterministically', () => {
    const wrapped = asLoopiumError('x');
    expect(wrapped).toBeInstanceOf(ExecutionFailureError);
    expect(wrapped.message).toBe('Unknown error');
  });
});
