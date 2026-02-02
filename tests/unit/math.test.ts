import { describe, expect, it } from 'vitest';
import { assertBps, bpsToRatio, clamp, deviationBps } from '../../src/utils/math.js';

describe('math utilities', () => {
  it('assertBps accepts [0..10000] integer', () => {
    expect(() => assertBps('x', 0)).not.toThrow();
    expect(() => assertBps('x', 10_000)).not.toThrow();
    expect(() => assertBps('x', -1)).toThrow();
    expect(() => assertBps('x', 10_001)).toThrow();
    expect(() => assertBps('x', 1.5)).toThrow();
  });

  it('bpsToRatio converts deterministically', () => {
    expect(bpsToRatio(0)).toBe(0);
    expect(bpsToRatio(100)).toBe(0.01);
    expect(bpsToRatio(10_000)).toBe(1);
  });

  it('clamp enforces bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(() => clamp(1, 10, 0)).toThrow();
  });

  it('deviationBps computes symmetric relative deviation', () => {
    expect(deviationBps(100, 100)).toBe(0);
    expect(deviationBps(100, 101)).toBe(100);
    expect(deviationBps(100, 99)).toBe(100);
    expect(() => deviationBps(0, 1)).toThrow();
  });
});
