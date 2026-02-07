import type { PublicKey, TransactionSignature } from '@solana/web3.js';
import { InvalidVaultStateError, ValidationError } from '../types/Errors.js';
import type { VaultLifecycleState } from './VaultTypes.js';
import type { LoopiumClient } from '../client/LoopiumClient.js';

export class Vault {
  public readonly client: LoopiumClient;
  public readonly address: PublicKey;
  public readonly owner: PublicKey;
  public readonly assetMint: PublicKey;

  private lifecycleState: VaultLifecycleState;

  constructor(params: {
    client: LoopiumClient;
    address: PublicKey;
    owner: PublicKey;
    assetMint: PublicKey;
    state: VaultLifecycleState;
  }) {
    this.client = params.client;
    this.address = params.address;
    this.owner = params.owner;
    this.assetMint = params.assetMint;
    this.lifecycleState = params.state;
  }

  get state(): VaultLifecycleState {
    return this.lifecycleState;
  }

  assertActive(): void {
    if (this.lifecycleState !== 'active') {
      throw new InvalidVaultStateError(this.address.toBase58(), `Vault is not active (state=${this.lifecycleState})`);
    }
  }

  async refresh(): Promise<void> {
    const fetched = await this.client.vaults.fetch(this.address);
    this.lifecycleState = fetched.state;
    this.client.emitVaultHealth({
      vault: this.address,
      assetMint: this.assetMint,
      owner: this.owner,
      state: this.lifecycleState
    });
  }

  async deposit(params: { ownerTokenAccount: PublicKey; vaultTokenAccount: PublicKey; amount: bigint }): Promise<TransactionSignature> {
    this.assertActive();
    if (params.amount <= 0n) throw new ValidationError('deposit amount must be > 0');
    return this.client.vaults.deposit({ vault: this.address, assetMint: this.assetMint, ...params });
  }

  async withdraw(params: { ownerTokenAccount: PublicKey; vaultTokenAccount: PublicKey; amount: bigint }): Promise<TransactionSignature> {
    this.assertActive();
    if (params.amount <= 0n) throw new ValidationError('withdraw amount must be > 0');
    return this.client.vaults.withdraw({ vault: this.address, assetMint: this.assetMint, ...params });
  }

  async close(): Promise<TransactionSignature> {
    if (this.lifecycleState === 'closed') {
      throw new InvalidVaultStateError(this.address.toBase58(), 'Vault is already closed');
    }
    const sig = await this.client.vaults.close({ vault: this.address });
    this.lifecycleState = 'closed';
    return sig;
  }

  async unwind(): Promise<TransactionSignature> {
    if (this.lifecycleState === 'closed') {
      throw new InvalidVaultStateError(this.address.toBase58(), 'Cannot unwind a closed vault');
    }
    const sig = await this.client.vaults.unwind({ vault: this.address });
    this.lifecycleState = 'unwinding';
    return sig;
  }

  async rebalance(params: { targetRatioBps: number }): Promise<TransactionSignature> {
    this.assertActive();
    if (!Number.isInteger(params.targetRatioBps) || params.targetRatioBps < 0 || params.targetRatioBps > 10_000) {
      throw new ValidationError('targetRatioBps must be an integer in [0, 10000]');
    }
    return this.client.vaults.rebalance({ vault: this.address, targetRatioBps: params.targetRatioBps });
  }
}
