// ── Main Client ──
export { ClawClient } from './client';

// ── Managers ──
export { AgentManager } from './agents';
export { TaskManager } from './tasks';
export { DataManager } from './data';
export { StreamManager } from './streaming';
export { WebhookManager } from './webhooks';

// ── Errors ──
export {
  ClawError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  NetworkError,
  TimeoutError,
} from './errors';

// ── Types ──
export type {
  ClawConfig,
  LogLevel,
  Agent,
  AgentStatus,
  AgentTool,
  ToolType,
  MemoryConfig,
  CreateAgentParams,
  UpdateAgentParams,
  Message,
  MessageRole,
  ToolCall,
  ChatRequest,
  ChatResponse,
  FinishReason,
  TokenUsage,
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskParams,
  DataStore,
  DataItem,
  CreateDataStoreParams,
  DataQuery,
  StreamEvent,
  StreamEventType,
  StreamOptions,
  Webhook,
  WebhookEvent,
  CreateWebhookParams,
  WebhookPayload,
  ApiResponse,
  PaginatedResponse,
  ListParams,
} from './types';
