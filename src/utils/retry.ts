import { NetworkError } from '../types/Errors.js';

export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn?: (err: unknown) => boolean;
  signal?: AbortSignal;
};

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new NetworkError('Aborted'));
      };
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const retryOn = opts.retryOn ?? (() => true);
  if (!Number.isInteger(opts.maxAttempts) || opts.maxAttempts < 1) {
    throw new NetworkError('retry.maxAttempts must be >= 1');
  }
  if (!Number.isFinite(opts.baseDelayMs) || opts.baseDelayMs < 0) {
    throw new NetworkError('retry.baseDelayMs must be >= 0');
  }
  if (!Number.isFinite(opts.maxDelayMs) || opts.maxDelayMs < 0) {
    throw new NetworkError('retry.maxDelayMs must be >= 0');
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw new NetworkError('Aborted', opts.signal.reason);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < opts.maxAttempts && retryOn(err);
      if (!canRetry) break;
      const delay = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay, opts.signal);
    }
  }
  throw new NetworkError('Retry attempts exhausted', lastErr);
}
