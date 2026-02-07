import { AnchorProvider, Idl, Program } from '@coral-xyz/anchor';
import type { Connection, PublicKey } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';
import loopiumIdlJson from '../idl/loopium.json';
import { ConfigError, ValidationError } from '../types/Errors.js';
import type { ExecutionRecord, LoopStateSnapshot, VaultHealth } from '../types/Events.js';
import type { AssetRegistry, LoopiumClientConfig, Wallet } from '../types/Interfaces.js';
import { ConnectionManager } from './ConnectionManager.js';
import { LoopBuilder } from '../loops/LoopBuilder.js';
import { VaultManager } from '../vaults/VaultManager.js';
import { ExecutionRouter } from '../routing/ExecutionRouter.js';
import { RiskEngine } from '../risk/RiskEngine.js';

export type LoopiumClientEvents = {
  'vault:health': (health: VaultHealth) => void;
  'loop:state': (snapshot: LoopStateSnapshot) => void;
  'execution:record': (record: ExecutionRecord) => void;
};

export class LoopiumClient {
  public readonly connection: Connection;
  public readonly wallet: Wallet;
  public readonly programId: PublicKey;
  public readonly environment: LoopiumClientConfig['environment'];
  public readonly assetRegistry: AssetRegistry | undefined;
  public readonly connectionManager: ConnectionManager;
  public readonly program: Program;

  public readonly router: ExecutionRouter;
  public readonly risk: RiskEngine;
  public readonly vaults: VaultManager;
  public readonly loops: LoopBuilder;

  private readonly emitter: EventEmitter = new EventEmitter();

  constructor(cfg: LoopiumClientConfig) {
    if (!cfg.connection) throw new ValidationError('connection is required');
    if (!cfg.wallet) throw new ValidationError('wallet is required');
    if (!cfg.programId) throw new ValidationError('programId is required');

    this.connection = cfg.connection;
    this.wallet = cfg.wallet;
    this.programId = cfg.programId;
    this.environment = cfg.environment;
    this.assetRegistry = cfg.assetRegistry;

    const commitment = cfg.commitment ?? 'confirmed';
    this.connectionManager = new ConnectionManager({ connection: this.connection, commitment });

    const provider = new AnchorProvider(this.connection, cfg.wallet as any, { commitment });
    const idlBase = loopiumIdlJson as unknown as Idl;
    // Anchor v0.31 Program expects programId in the IDL. We inject the configured programId
    // deterministically (no hard-coded addresses).
    const idl = {
      ...(idlBase as any),
      address: cfg.programId.toBase58(),
      metadata: { ...(idlBase as any).metadata, address: cfg.programId.toBase58() }
    } as Idl;

    try {
      this.program = new Program(idl, provider);
    } catch (err) {
      throw new ConfigError('Failed to initialize Anchor Program from IDL', err);
    }

    this.router = new ExecutionRouter();
    this.risk = new RiskEngine();
    this.vaults = new VaultManager({ client: this });
    this.loops = new LoopBuilder({ client: this });
  }

  on<E extends keyof LoopiumClientEvents>(event: E, handler: LoopiumClientEvents[E]): void {
    this.emitter.on(event as string, handler as any);
  }

  off<E extends keyof LoopiumClientEvents>(event: E, handler: LoopiumClientEvents[E]): void {
    this.emitter.off(event as string, handler as any);
  }

  emitVaultHealth(health: VaultHealth): void {
    this.emitter.emit('vault:health', health);
  }

  emitLoopState(snapshot: LoopStateSnapshot): void {
    this.emitter.emit('loop:state', snapshot);
  }

  emitExecutionRecord(record: ExecutionRecord): void {
    this.emitter.emit('execution:record', record);
  }
}
