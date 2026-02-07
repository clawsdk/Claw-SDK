import { describe, expect, it } from 'vitest';
import { ExecutionRouter } from '../../src/routing/ExecutionRouter.js';
import type { DexAdapter, QuoteRequest } from '../../src/types/Interfaces.js';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

const pk = PublicKey.unique();

function adapter(id: string, quote: { out: bigint; slippageBps: number; latencyMs?: number }): DexAdapter {
  return {
    id,
    async getQuote(req) {
      const base = {
        inAmount: req.inAmount,
        outAmount: quote.out,
        slippageBps: quote.slippageBps,
        routeId: `${id}:route`
      };
      return quote.latencyMs !== undefined ? { ...base, latencyMs: quote.latencyMs } : base;
    },
    async buildSwap(_req, q) {
      return {
        adapterId: id,
        quote: q,
        async buildInstructions() {
          return { instructions: [new TransactionInstruction({ keys: [], programId: pk, data: Buffer.alloc(0) })] };
        }
      };
    }
  };
}

describe('ExecutionRouter', () => {
  it('selects best outAmount, deterministic tie-breakers', async () => {
    const r = new ExecutionRouter();
    r.register(adapter('a', { out: 100n, slippageBps: 50, latencyMs: 20 }));
    r.register(adapter('b', { out: 100n, slippageBps: 50, latencyMs: 10 }));
    r.register(adapter('c', { out: 101n, slippageBps: 100, latencyMs: 5 }));

    const req: QuoteRequest = {
      inMint: pk,
      outMint: pk,
      inAmount: 1_000n,
      maxSlippageBps: 200
    };

    const decision = await r.route(req);
    expect(decision.adapterId).toBe('c');
    expect(decision.quote.outAmount).toBe(101n);
  });

  it('filters out quotes exceeding slippage', async () => {
    const r = new ExecutionRouter();
    r.register(adapter('a', { out: 100n, slippageBps: 500 }));
    r.register(adapter('b', { out: 90n, slippageBps: 10 }));

    const req: QuoteRequest = {
      inMint: pk,
      outMint: pk,
      inAmount: 1_000n,
      maxSlippageBps: 50
    };

    const decision = await r.route(req);
    expect(decision.adapterId).toBe('b');
  });
});
