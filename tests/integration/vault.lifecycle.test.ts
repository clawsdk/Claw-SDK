import { describe, expect, it } from 'vitest';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { LoopiumClient } from '../../src/client/LoopiumClient.js';
import { KeypairWallet, env } from './helpers.js';

describe('integration: vault lifecycle (requires deployed program)', () => {
  it('initializes vault, executes loop, unwinds, and closes', async () => {
    const rpcUrl = env('LOOPIUM_RPC_URL');
    const programId = new PublicKey(env('LOOPIUM_PROGRAM_ID'));

    const connection = new Connection(rpcUrl, 'confirmed');

    const owner = Keypair.generate();
    const wallet = new KeypairWallet(owner);

    const airdropSig = await connection.requestAirdrop(owner.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSig, 'confirmed');

    const mintAuthority = Keypair.generate();
    const mint = await createMint(connection, owner, mintAuthority.publicKey, null, 6);

    // Create real token accounts for later deposit/withdraw flows.
    const ownerAta = await getOrCreateAssociatedTokenAccount(connection, owner, mint, owner.publicKey);
    await mintTo(connection, owner, mint, ownerAta.address, mintAuthority, 1_000_000_000n);

    const client = new LoopiumClient({
      connection,
      wallet,
      environment: 'localnet',
      programId
    });

    const vault = await client.vaults.create({
      owner: owner.publicKey,
      assetMint: mint,
      maxOracleDeviationBps: 200,
      maxVolatilityBps: 500,
      maxSlippageBps: 100
    });

    expect(vault.owner.toBase58()).toBe(owner.publicKey.toBase58());
    expect(vault.assetMint.toBase58()).toBe(mint.toBase58());

    const fetched = await client.vaults.fetch(vault.address);
    expect(fetched.address.toBase58()).toBe(vault.address.toBase58());

    // Ensure PDA derivation is consistent and deterministic.
    const addrs = client.vaults.deriveAddresses({ owner: owner.publicKey, assetMint: mint });
    expect(addrs.vault.toBase58()).toBe(vault.address.toBase58());

    // Execute the canonical on-chain loop entrypoint.
    await expect(client.vaults.executeLoop({ vault: vault.address, minOutAmount: 0n })).resolves.toMatch(/[1-9A-HJ-NP-Za-km-z]{43,88}/);

    // Risk-triggered unwind semantics are program-defined; this tests that unwind is callable.
    await expect(client.vaults.unwind({ vault: vault.address })).resolves.toMatch(/[1-9A-HJ-NP-Za-km-z]{43,88}/);

    // Close should succeed after unwind in the canonical lifecycle.
    await expect(vault.close()).resolves.toMatch(/[1-9A-HJ-NP-Za-km-z]{43,88}/);

    void ownerAta;
  });
});
