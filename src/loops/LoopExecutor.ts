import { BN } from '@coral-xyz/anchor';
import { ComputeBudgetProgram, PublicKey, Transaction } from '@solana/web3.js';
import type { LoopiumClient } from '../client/LoopiumClient.js';
import { ExecutionFailureError, ValidationError } from '../types/Errors.js';
import type { PriceOracle, QuoteRequest } from '../types/Interfaces.js';
import type { RiskConfig } from '../risk/RiskEngine.js';
import { LoopState } from './LoopState.js';

export class LoopExecutor {
  private readonly client: LoopiumClient;
  private readonly vault: { address: PublicKey; owner: PublicKey; assetMint: PublicKey };
  private readonly rebalanceIntervalSec: number;
  private readonly riskConfig: RiskConfig;
  private readonly oracle: PriceOracle;
  private readonly referenceOracle: PriceOracle | undefined;

  private readonly state: LoopState;
  private lastOraclePrice?: number;

  constructor(params: {
    client: LoopiumClient;
    vault: { address: PublicKey; owner: PublicKey; assetMint: PublicKey };
    rebalanceIntervalSec: number;
    riskConfig: RiskConfig;
    oracle: PriceOracle;
    referenceOracle?: PriceOracle;
  }) {
    this.client = params.client;
    this.vault = params.vault;
    this.rebalanceIntervalSec = params.rebalanceIntervalSec;
    this.riskConfig = params.riskConfig;
    this.oracle = params.oracle;
    this.referenceOracle = params.referenceOracle;

    this.state = new LoopState({ vault: params.vault.address, loopId: params.vault.address.toBase58() });
  }

  get snapshot() {
    return this.state.snapshot();
  }

  // Executes one loop iteration deterministically.
  async execute(params?: {
    // Optional swap parameters for the Oracle-validated swap stage.
    swap?: { outMint: PublicKey; inAmount: bigint; maxSlippageBps: number };
    minOutAmount?: bigint;
    computeUnitLimit?: number;
    computeUnitPriceMicroLamports?: bigint;
  }): Promise<void> {
    const started = Date.now();
    this.client.risk.breaker.assertNotTripped();

    try {
      const slot = BigInt(await this.client.connection.getSlot(this.client.connectionManager.commitment));

      const assessBase = {
        mint: this.vault.assetMint,
        slot,
        oracle: this.oracle,
        cfg: this.riskConfig,
        ...(this.lastOraclePrice !== undefined ? { lastPrice: this.lastOraclePrice } : {})
      };

      const { assessment, price } = this.referenceOracle
        ? await this.client.risk.assess({ ...assessBase, referenceOracle: this.referenceOracle })
        : await this.client.risk.assess(assessBase);

      this.lastOraclePrice = price;
      this.state.setRiskFlags({
        oracleDeviation: !assessment.oracleDeviationOk,
        volatilityExceeded: !assessment.volatilityOk,
        liquidityUnhealthy: assessment.flags.liquidityUnhealthy,
        circuitBreakerTripped: assessment.flags.circuitBreakerTripped
      });

      // Stage 1: Oracle-validated swap (optional but first-class).
      if (params?.swap) {
        const req: QuoteRequest = {
          inMint: this.vault.assetMint,
          outMint: params.swap.outMint,
          inAmount: params.swap.inAmount,
          maxSlippageBps: params.swap.maxSlippageBps
        };
        const decision = await this.client.router.route(req);
        const built = await decision.plan.buildInstructions({ userAuthority: this.client.wallet.publicKey });

        const latest = await this.client.connectionManager.getLatestBlockhash();
        const tx = new Transaction({ feePayer: this.client.wallet.publicKey, recentBlockhash: latest.blockhash });

        if (params?.computeUnitLimit !== undefined) {
          if (!Number.isInteger(params.computeUnitLimit) || params.computeUnitLimit <= 0) {
            throw new ValidationError('computeUnitLimit must be a positive integer');
          }
          tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: params.computeUnitLimit }));
        }
        if (params?.computeUnitPriceMicroLamports !== undefined) {
          if (params.computeUnitPriceMicroLamports < 0n) {
            throw new ValidationError('computeUnitPriceMicroLamports must be >= 0');
          }
          if (params.computeUnitPriceMicroLamports > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new ValidationError('computeUnitPriceMicroLamports exceeds JS safe integer range');
          }
          tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: Number(params.computeUnitPriceMicroLamports)
            })
          );
        }

        for (const ix of built.instructions) tx.add(ix);

        const signed = await this.client.wallet.signTransaction(tx);
        const sig = await this.client.connectionManager.sendSignedTransaction(signed);
        await this.client.connectionManager.confirm(sig);

        this.client.emitExecutionRecord({ timestampMs: Date.now(), stage: 'swap', signature: sig, ok: true });
      }

      // Stage 2+: execute_loop on-chain (liquidity deploy/harvest/optional hedge/rebalance are program-defined).
      // This call is deterministic and fail-closed. It is the canonical loop entrypoint.
      const minOut = params?.minOutAmount ?? 0n;
      if (minOut < 0n) throw new ValidationError('minOutAmount must be >= 0');

      const addrs = this.client.vaults.deriveAddresses({ owner: this.vault.owner, assetMint: this.vault.assetMint });
      if (!addrs.vault.equals(this.vault.address)) {
        throw new ValidationError('Vault address does not match derived PDA for (owner, assetMint)');
      }

      const methods = (this.client.program as any).methods;
      const ix = await methods
        .executeLoop(new BN(minOut.toString()))
        .accounts({
          owner: this.client.wallet.publicKey,
          vault: addrs.vault,
          loopState: addrs.loopState,
          riskConfig: addrs.riskConfig,
          executionConfig: addrs.executionConfig
        })
        .instruction();

      const latest = await this.client.connectionManager.getLatestBlockhash();
      const tx = new Transaction({ feePayer: this.client.wallet.publicKey, recentBlockhash: latest.blockhash }).add(ix);
      const signed = await this.client.wallet.signTransaction(tx);
      const sig = await this.client.connectionManager.sendSignedTransaction(signed);
      await this.client.connectionManager.confirm(sig);

      this.client.emitExecutionRecord({ timestampMs: Date.now(), stage: 'execute_loop', signature: sig, ok: true });

      this.state.nextIteration();
      this.state.record({ timestampMs: Date.now(), stage: 'iteration', ok: true });
      this.client.emitLoopState(this.state.snapshot());

      // Rebalance interval is consumer-scheduled; SDK exposes deterministic checks only.
      void this.rebalanceIntervalSec;
      void started;
    } catch (err) {
      const e = new ExecutionFailureError('loop', 'Loop execution failed', err);
      this.client.emitExecutionRecord({
        timestampMs: Date.now(),
        stage: 'loop',
        ok: false,
        error: { name: e.name, code: e.code, message: e.message }
      });
      throw e;
    }
  }
}
