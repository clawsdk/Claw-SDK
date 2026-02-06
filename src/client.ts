import { ClawConfig } from './types';
import { HttpClient } from './utils/http';
import { Logger } from './utils/logger';
import { AgentManager } from './agents';
import { TaskManager } from './tasks';
import { DataManager } from './data';
import { StreamManager } from './streaming';
import { WebhookManager } from './webhooks';
import { ValidationError } from './errors';

const DEFAULT_BASE_URL = 'https://api.openclaw.ai/v1';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

export class ClawClient {
  /** Agent management — create, configure, start, stop agents. */
  public readonly agents: AgentManager;

  /** Task automation — create, schedule, manage tasks. */
  public readonly tasks: TaskManager;

  /** Data management — stores, key-value storage, queries. */
  public readonly data: DataManager;

  /** Streaming — real-time SSE responses from agents. */
  public readonly streaming: StreamManager;

  /** Webhooks — register and manage webhook endpoints. */
  public readonly webhooks: WebhookManager;

  private readonly config: Required<ClawConfig>;
  private readonly http: HttpClient;
  private readonly logger: Logger;

  constructor(config: ClawConfig) {
    if (!config.apiKey) {
      throw new ValidationError('API key is required. Get yours at https://openclaw.ai/dashboard');
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      logLevel: config.logLevel ?? 'info',
    };

    this.logger = new Logger(this.config.logLevel);
    this.http = new HttpClient(
      this.config.baseUrl,
      this.config.apiKey,
      this.config.timeout,
      this.config.maxRetries,
      this.logger,
    );

    this.agents = new AgentManager(this.http);
    this.tasks = new TaskManager(this.http);
    this.data = new DataManager(this.http);
    this.streaming = new StreamManager(this.config.baseUrl, this.config.apiKey, this.logger);
    this.webhooks = new WebhookManager(this.http);

    this.logger.info('ClawClient initialized');
  }

  /**
   * Get the current SDK configuration.
   */
  getConfig(): Readonly<Required<ClawConfig>> {
    return { ...this.config };
  }

  /**
   * Get the SDK version.
   */
  static get version(): string {
    return '1.0.0';
  }
}
