export type LoopiumErrorCode =
  | 'INVALID_VAULT_STATE'
  | 'RISK_THRESHOLD_EXCEEDED'
  | 'ORACLE_DEVIATION'
  | 'EXECUTION_FAILURE'
  | 'CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR';

export abstract class LoopiumError extends Error {
  public readonly code: LoopiumErrorCode;
  public readonly cause?: unknown;

  protected constructor(code: LoopiumErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = cause;
  }
}

export class ConfigError extends LoopiumError {
  constructor(message: string, cause?: unknown) {
    super('CONFIG_ERROR', message, cause);
  }
}

export class NetworkError extends LoopiumError {
  constructor(message: string, cause?: unknown) {
    super('NETWORK_ERROR', message, cause);
  }
}

export class ValidationError extends LoopiumError {
  constructor(message: string, cause?: unknown) {
    super('VALIDATION_ERROR', message, cause);
  }
}

export class InvalidVaultStateError extends LoopiumError {
  public readonly vault: string;
  constructor(vault: string, message: string, cause?: unknown) {
    super('INVALID_VAULT_STATE', message, cause);
    this.vault = vault;
  }
}

export class RiskThresholdExceededError extends LoopiumError {
  public readonly riskMetric: string;
  public readonly value: number;
  public readonly threshold: number;

  constructor(args: { riskMetric: string; value: number; threshold: number; message?: string }, cause?: unknown) {
    super(
      'RISK_THRESHOLD_EXCEEDED',
      args.message ?? `Risk threshold exceeded for ${args.riskMetric}: ${args.value} > ${args.threshold}`,
      cause
    );
    this.riskMetric = args.riskMetric;
    this.value = args.value;
    this.threshold = args.threshold;
  }
}

export class OracleDeviationError extends LoopiumError {
  public readonly feed: string;
  public readonly deviationBps: number;
  public readonly maxDeviationBps: number;

  constructor(args: { feed: string; deviationBps: number; maxDeviationBps: number; message?: string }, cause?: unknown) {
    super(
      'ORACLE_DEVIATION',
      args.message ?? `Oracle deviation exceeded for ${args.feed}: ${args.deviationBps}bps > ${args.maxDeviationBps}bps`,
      cause
    );
    this.feed = args.feed;
    this.deviationBps = args.deviationBps;
    this.maxDeviationBps = args.maxDeviationBps;
  }
}

export class ExecutionFailureError extends LoopiumError {
  public readonly stage: string;

  constructor(stage: string, message: string, cause?: unknown) {
    super('EXECUTION_FAILURE', message, cause);
    this.stage = stage;
  }
}

export function mapAnchorError(stage: string, err: unknown): LoopiumError {
  // Avoid hard dependency on AnchorError type guards; check shape instead.
  const anyErr = err as any;
  const codeNum: number | undefined =
    typeof anyErr?.error?.errorCode?.number === 'number'
      ? anyErr.error.errorCode.number
      : typeof anyErr?.errorCode?.number === 'number'
        ? anyErr.errorCode.number
        : undefined;

  if (codeNum === 6000) return new InvalidVaultStateError('unknown', 'Invalid vault state', err);
  if (codeNum === 6001)
    return new RiskThresholdExceededError({ riskMetric: 'onchain', value: 1, threshold: 0, message: 'Risk threshold exceeded' }, err);
  if (codeNum === 6002)
    return new OracleDeviationError({ feed: 'onchain', deviationBps: 10_000, maxDeviationBps: 0, message: 'Oracle deviation exceeded' }, err);
  if (codeNum === 6003) return new ExecutionFailureError(stage, 'Execution failure', err);

  if (err instanceof LoopiumError) return err;
  if (err instanceof Error) return new ExecutionFailureError(stage, err.message, err);
  return new ExecutionFailureError(stage, 'Unknown error', err);
}

export function asLoopiumError(err: unknown): LoopiumError {
  if (err instanceof LoopiumError) return err;
  if (err instanceof Error) return new ExecutionFailureError('unknown', err.message, err);
  return new ExecutionFailureError('unknown', 'Unknown error', err);
}
