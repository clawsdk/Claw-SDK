import type { Wallet } from '../../src/types/Interfaces.js';
import { Keypair, Transaction } from '@solana/web3.js';

export class KeypairWallet implements Wallet {
  public readonly payer: Keypair;

  constructor(payer: Keypair) {
    this.payer = payer;
  }

  get publicKey() {
    return this.payer.publicKey;
  }

  async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }
}

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var for integration tests: ${name}`);
  return v;
}
