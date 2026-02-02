import type { LoopiumClient } from '../client/LoopiumClient.js';
import { ExecutionFailureError, ValidationError, mapAnchorError } from '../types/Errors.js';
import type { VaultAddresses, VaultInitParams, VaultLifecycleState } from './VaultTypes.js';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { Vault } from './Vault.js';

const VAULT_SEED = Buffer.from('vault');
const RISK_SEED = Buffer.from('risk');
const EXEC_SEED = Buffer.from('exec');
const LOOP_SEED = Buffer.from('loop');

function toLifecycleState(stateByte: number): VaultLifecycleState {
  switch (stateByte) {
    case 0:
      return 'uninitialized';
    case 1:
      return 'active';
    case 2:
      return 'unwinding';
    case 3:
      return 'closed';
    default:
      return 'uninitialized';
  }
}

export class VaultManager {
  private readonly client: LoopiumClient;

  constructor(params: { client: LoopiumClient }) {
    this.client = params.client;
  }

  deriveAddresses(params: { owner: PublicKey; assetMint: PublicKey }): VaultAddresses {
    const [vault, vaultBump] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, params.owner.toBuffer(), params.assetMint.toBuffer()],
      this.client.programId
    );
    const [riskConfig, riskBump] = PublicKey.findProgramAddressSync([RISK_SEED, vault.toBuffer()], this.client.programId);
    const [executionConfig, execBump] = PublicKey.findProgramAddressSync([EXEC_SEED, vault.toBuffer()], this.client.programId);
    const [loopState, loopBump] = PublicKey.findProgramAddressSync([LOOP_SEED, vault.toBuffer()], this.client.programId);

    return {
      vault,
      riskConfig,
      executionConfig,
      loopState,
      bumps: { vault: vaultBump, riskConfig: riskBump, executionConfig: execBump, loopState: loopBump }
    };
  }

  async create(
    params:
      | VaultInitParams
      | (Omit<VaultInitParams, 'assetMint'> & { asset: string })
  ): Promise<Vault> {
    const assetMint =
      'assetMint' in params
        ? params.assetMint
        : (() => {
            const registry = this.client.assetRegistry;
            if (!registry) throw new ValidationError('assetRegistry is required to resolve asset symbols');
            return registry.resolveMint(params.asset);
          })();

    if (params.maxOracleDeviationBps < 0 || params.maxOracleDeviationBps > 10_000) {
      throw new ValidationError('maxOracleDeviationBps must be in [0, 10000]');
    }
    if (params.maxVolatilityBps < 0 || params.maxVolatilityBps > 10_000) {
      throw new ValidationError('maxVolatilityBps must be in [0, 10000]');
    }
    if (params.maxSlippageBps < 0 || params.maxSlippageBps > 10_000) {
      throw new ValidationError('maxSlippageBps must be in [0, 10000]');
    }

    const addrs = this.deriveAddresses({ owner: params.owner, assetMint });

    try {
      const methods = (this.client.program as any).methods;
      const ix = await methods
        .initializeVault(params.maxOracleDeviationBps, params.maxVolatilityBps, params.maxSlippageBps)
        .accounts({
          owner: params.owner,
          assetMint,
          vault: addrs.vault,
          riskConfig: addrs.riskConfig,
          executionConfig: addrs.executionConfig,
          systemProgram: SystemProgram.programId
        })
        .instruction();

      const latest = await this.client.connectionManager.getLatestBlockhash();
      const tx = new Transaction({ feePayer: this.client.wallet.publicKey, recentBlockhash: latest.blockhash }).add(ix);
      const signed = await this.client.wallet.signTransaction(tx);
      const sig = await this.client.connectionManager.sendSignedTransaction(signed);
      await this.client.connectionManager.confirm(sig);

      const vault = await this.fetch(addrs.vault);
      return vault;
    } catch (err) {
      throw mapAnchorError('initialize_vault', err);
    }
  }

  async fetch(vault: PublicKey): Promise<Vault> {
    try {
      const accountNs = (this.client.program as any).account;
      const decoded: any = await accountNs.vaultAccount.fetch(vault);
      const owner = decoded.owner as PublicKey;
      const assetMint = decoded.assetMint as PublicKey;
      const state = toLifecycleState(Number(decoded.state));
      const v = new Vault({ client: this.client, address: vault, owner, assetMint, state });
      this.client.emitVaultHealth({ vault, assetMint, owner, state });
      return v;
    } catch (err) {
      throw mapAnchorError('fetch_vault', err);
    }
  }

  async deposit(params: {
    vault: PublicKey;
    assetMint: PublicKey;
    ownerTokenAccount: PublicKey;
    vaultTokenAccount: PublicKey;
    amount: bigint;
  }): Promise<string> {
    if (params.amount <= 0n) throw new ValidationError('amount must be > 0');

    try {
      const methods = (this.client.program as any).methods;
      const ix = await methods
        .deposit(new BN(params.amount.toString()))
        .accounts({
          owner: this.client.wallet.publicKey,
          assetMint: params.assetMint,
          vault: params.vault,
          ownerTokenAccount: params.ownerTokenAccount,
          vaultTokenAccount: params.vaultTokenAccount,
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        })
        .instruction();

      const latest = await this.client.connectionManager.getLatestBlockhash();
      const tx = new Transaction({ feePayer: this.client.wallet.publicKey, recentBlockhash: latest.blockhash }).add(ix);
      const signed = await this.client.wallet.signTransaction(tx);
      const sig = await this.client.connectionManager.sendSignedTransaction(signed);
      await this.client.connectionManager.confirm(sig);
      return sig;
    } catch (err) {
      throw mapAnchorError('deposit', err);
    }
  }

  async withdraw(params: {
    vault: PublicKey;
    assetMint: PublicKey;
    ownerTokenAccount: PublicKey;
    vaultTokenAccount: PublicKey;
    amount: bigint;
  }): Promise<string> {
    if (params.amount <= 0n) throw new ValidationError('amount must be > 0');

    try {
      const methods = (this.client.program as any).methods;
      const ix = await methods
        .withdraw(new BN(params.amount.toString()))
        .accounts({
          owner: this.client.wallet.publicKey,
          assetMint: params.assetMint,
          vault: params.vault,
          ownerTokenAccount: params.ownerTokenAccount,
          vaultTokenAccount: params.vaultTokenAccount,
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        })
        .instruction();

      const latest = await this.client.connectionManager.getLatestBlockhash();
      const tx = new Transaction({ feePayer: this.client.wallet.publicKey, recentBlockhash: latest.blockhash }).add(ix);
      const signed = await this.client.wallet.signTransaction(tx);
      const sig = await this.client.connectionManager.sendSignedTransaction(signed);
      await this.client.connectionManager.confirm(sig);
      return sig;
    } catch (err) {
      throw mapAnchorError('withdraw', err);
    }
  }

  async executeLoop(params: { vault: PublicKey; minOutAmount: bigint }): Promise<string> {
    if (params.minOutAmount < 0n) throw new ValidationError('minOutAmount must be >= 0');
    try {
      const accountNs = (this.client.program as any).account;
      const decoded: any = await accountNs.vaultAccount.fetch(params.vault);
      const owner = decoded.owner as PublicKey;
      const assetMint = decoded.assetMint as PublicKey;
      const addrs = this.deriveAddresses({ owner, assetMint });
      if (!addrs.vault.equals(params.vault)) {
        throw new ValidationError('Vault PDA derivation mismatch (owner/assetMint do not match vault)');
      }

      const methods = (this.client.program as any).methods;
      const ix = await methods
        .executeLoop(new BN(params.minOutAmount.toString()))
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
      return sig;
    } catch (err) {
      throw mapAnchorError('execute_loop', err);
    }
  }

  async rebalance(params: { vault: PublicKey; targetRatioBps: number }): Promise<string> {
    if (!Number.isInteger(params.targetRatioBps) || params.targetRatioBps < 0 || params.targetRatioBps > 10_000) {
      throw new ValidationError('targetRatioBps must be an integer in [0, 10000]');
    }

    try {
      const accountNs = (this.client.program as any).account;
      const decoded: any = await accountNs.vaultAccount.fetch(params.vault);
      const owner = decoded.owner as PublicKey;
      const assetMint = decoded.assetMint as PublicKey;
      const addrs = this.deriveAddresses({ owner, assetMint });
      if (!addrs.vault.equals(params.vault)) {
        throw new ValidationError('Vault PDA derivation mismatch (owner/assetMint do not match vault)');
      }

      const methods = (this.client.program as any).methods;
      const ix = await methods
        .rebalance(params.targetRatioBps)
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
      return sig;
    } catch (err) {
      throw mapAnchorError('rebalance', err);
    }
  }

  async unwind(params: { vault: PublicKey }): Promise<string> {
    try {
      const accountNs = (this.client.program as any).account;
      const decoded: any = await accountNs.vaultAccount.fetch(params.vault);
      const owner = decoded.owner as PublicKey;
      const assetMint = decoded.assetMint as PublicKey;
      const addrs = this.deriveAddresses({ owner, assetMint });
      if (!addrs.vault.equals(params.vault)) {
        throw new ValidationError('Vault PDA derivation mismatch (owner/assetMint do not match vault)');
      }

      const methods = (this.client.program as any).methods;
      const ix = await methods
        .unwind()
        .accounts({
          owner: this.client.wallet.publicKey,
          vault: addrs.vault,
          loopState: addrs.loopState
        })
        .instruction();

      const latest = await this.client.connectionManager.getLatestBlockhash();
      const tx = new Transaction({ feePayer: this.client.wallet.publicKey, recentBlockhash: latest.blockhash }).add(ix);
      const signed = await this.client.wallet.signTransaction(tx);
      const sig = await this.client.connectionManager.sendSignedTransaction(signed);
      await this.client.connectionManager.confirm(sig);
      return sig;
    } catch (err) {
      throw mapAnchorError('unwind', err);
    }
  }

  async close(params: { vault: PublicKey }): Promise<string> {
    try {
      // Derive related PDAs to prevent account substitution.
      const accountNs = (this.client.program as any).account;
      const decoded: any = await accountNs.vaultAccount.fetch(params.vault);
      const owner = decoded.owner as PublicKey;
      const assetMint = decoded.assetMint as PublicKey;
      const addrs = this.deriveAddresses({ owner, assetMint });
      if (!addrs.vault.equals(params.vault)) {
        throw new ValidationError('Vault PDA derivation mismatch (owner/assetMint do not match vault)');
      }

      const methods = (this.client.program as any).methods;
      const ix = await methods
        .closeVault()
        .accounts({
          owner: this.client.wallet.publicKey,
          vault: addrs.vault,
          riskConfig: addrs.riskConfig,
          executionConfig: addrs.executionConfig,
          loopState: addrs.loopState,
          systemProgram: SystemProgram.programId
        })
        .instruction();

      const latest = await this.client.connectionManager.getLatestBlockhash();
      const tx = new Transaction({ feePayer: this.client.wallet.publicKey, recentBlockhash: latest.blockhash }).add(ix);
      const signed = await this.client.wallet.signTransaction(tx);
      const sig = await this.client.connectionManager.sendSignedTransaction(signed);
      await this.client.connectionManager.confirm(sig);
      return sig;
    } catch (err) {
      throw mapAnchorError('close_vault', err);
    }
  }
}
