import { assertBps } from '../utils/math.js';
import { ExecutionFailureError, ValidationError } from '../types/Errors.js';
import type { DexAdapter, Quote, QuoteRequest, SwapPlan } from '../types/Interfaces.js';

export type RouterDecision = {
  adapterId: string;
  quote: Quote;
  plan: SwapPlan;
};

export class ExecutionRouter {
  private readonly adapters = new Map<string, DexAdapter>();

  register(adapter: DexAdapter): void {
    if (!adapter?.id) throw new ValidationError('adapter.id is required');
    if (this.adapters.has(adapter.id)) throw new ValidationError(`adapter.id already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
  }

  listAdapters(): string[] {
    return [...this.adapters.keys()].sort();
  }

  async route(req: QuoteRequest): Promise<RouterDecision> {
    assertBps('maxSlippageBps', req.maxSlippageBps);
    if (req.inAmount <= 0n) throw new ValidationError('inAmount must be > 0');

    const adapters = [...this.adapters.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (adapters.length === 0) throw new ValidationError('No DEX adapters registered');

    const quotes: Array<{ adapter: DexAdapter; quote: Quote }> = [];
    const failures: Array<{ adapterId: string; reason: string }> = [];
    for (const adapter of adapters) {
      try {
        const q = await adapter.getQuote(req);
        // Deterministic sanity checks.
        if (q.inAmount !== req.inAmount) throw new ValidationError(`Adapter ${adapter.id} returned quote.inAmount mismatch`);
        if (q.outAmount <= 0n) throw new ValidationError(`Adapter ${adapter.id} returned non-positive outAmount`);
        assertBps(`Adapter ${adapter.id} slippageBps`, q.slippageBps);
        if (q.slippageBps > req.maxSlippageBps) continue;
        quotes.push({ adapter, quote: q });
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        failures.push({ adapterId: adapter.id, reason });
      }
    }

    if (quotes.length === 0) {
      const detail = failures.length
        ? ` Adapter failures: ${failures.map((f) => `${f.adapterId}=${f.reason}`).join(' | ')}`
        : '';
      throw new ExecutionFailureError('routing', `No viable quotes within slippage bounds.${detail}`);
    }

    // Deterministic selection: maximize outAmount, then minimize slippage, then minimize latency, then adapterId.
    quotes.sort((a, b) => {
      if (a.quote.outAmount !== b.quote.outAmount) return a.quote.outAmount > b.quote.outAmount ? -1 : 1;
      if (a.quote.slippageBps !== b.quote.slippageBps) return a.quote.slippageBps - b.quote.slippageBps;
      const la = a.quote.latencyMs ?? Number.POSITIVE_INFINITY;
      const lb = b.quote.latencyMs ?? Number.POSITIVE_INFINITY;
      if (la !== lb) return la - lb;
      return a.adapter.id.localeCompare(b.adapter.id);
    });

    const best = quotes[0]!;
    const plan = await best.adapter.buildSwap(req, best.quote);
    if (plan.adapterId !== best.adapter.id) {
      throw new ValidationError(`SwapPlan.adapterId mismatch for adapter ${best.adapter.id}`);
    }
    return { adapterId: best.adapter.id, quote: best.quote, plan };
  }
}
