import type { Commitment, Connection, SendOptions, Transaction, TransactionSignature } from '@solana/web3.js';
import { NetworkError, ValidationError } from '../types/Errors.js';
import { withRetry } from '../utils/retry.js';

export type ConnectionManagerConfig = {
  connection: Connection;
  commitment: Commitment;
  sendOptions?: SendOptions;
  retry?: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number };
};

export class ConnectionManager {
  public readonly connection: Connection;
  public readonly commitment: Commitment;
  private readonly sendOptions: SendOptions | undefined;
  private readonly retryCfg: Required<NonNullable<ConnectionManagerConfig['retry']>>;

  constructor(cfg: ConnectionManagerConfig) {
    this.connection = cfg.connection;
    this.commitment = cfg.commitment;
    this.sendOptions = cfg.sendOptions;
    this.retryCfg = cfg.retry ?? { maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 2_000 };

    if (!this.connection?.rpcEndpoint) throw new ValidationError('connection is required');
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    try {
      return await this.connection.getLatestBlockhash(this.commitment);
    } catch (err) {
      throw new NetworkError('Failed to fetch latest blockhash', err);
    }
  }

  async sendSignedTransaction(tx: Transaction): Promise<TransactionSignature> {
    const send = async () => {
      try {
        return await this.connection.sendRawTransaction(tx.serialize(), {
          preflightCommitment: this.commitment,
          ...this.sendOptions
        });
      } catch (err) {
        throw new NetworkError('Failed to send transaction', err);
      }
    };

    return withRetry(send, {
      maxAttempts: this.retryCfg.maxAttempts,
      baseDelayMs: this.retryCfg.baseDelayMs,
      maxDelayMs: this.retryCfg.maxDelayMs,
      retryOn: () => true
    });
  }

  async confirm(signature: TransactionSignature): Promise<void> {
    try {
      const latest = await this.getLatestBlockhash();
      const res = await this.connection.confirmTransaction(
        { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
        this.commitment
      );
      if (res.value.err) throw new NetworkError(`Transaction failed: ${signature}`, res.value.err);
    } catch (err) {
      throw new NetworkError(`Failed to confirm transaction: ${signature}`, err);
    }
  }
}
