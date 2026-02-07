import { ValidationError } from '../types/Errors.js';

export function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new ValidationError(`${name} must be a finite number`);
}

export function assertBps(name: string, bps: number): void {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new ValidationError(`${name} must be an integer in [0, 10000] bps`);
  }
}

export function bpsToRatio(bps: number): number {
  assertBps('bps', bps);
  return bps / 10_000;
}

export function clamp(n: number, min: number, max: number): number {
  assertFiniteNumber('n', n);
  assertFiniteNumber('min', min);
  assertFiniteNumber('max', max);
  if (min > max) throw new ValidationError('min must be <= max');
  return Math.min(max, Math.max(min, n));
}

export function absDiff(a: number, b: number): number {
  assertFiniteNumber('a', a);
  assertFiniteNumber('b', b);
  return Math.abs(a - b);
}

export function deviationBps(reference: number, value: number): number {
  assertFiniteNumber('reference', reference);
  assertFiniteNumber('value', value);
  if (reference === 0) throw new ValidationError('reference must be non-zero');
  const dev = Math.abs(value - reference) / Math.abs(reference);
  return Math.round(dev * 10_000);
}
