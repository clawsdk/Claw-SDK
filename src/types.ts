// ── SDK Configuration ──

export interface ClawConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  logLevel?: LogLevel;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

// ── Agent Types ──

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  status: AgentStatus;
  instructions: string;
  tools: AgentTool[];
  memory: MemoryConfig;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type AgentStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface AgentTool {
  name: string;
  type: ToolType;
  description: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
}

export type ToolType = 'function' | 'api' | 'browser' | 'code_interpreter' | 'file_search';

export interface MemoryConfig {
  enabled: boolean;
  maxTokens: number;
  strategy: 'sliding_window' | 'summary' | 'full';
}

export interface CreateAgentParams {
  name: string;
  description?: string;
  model?: string;
  instructions?: string;
  tools?: Omit<AgentTool, 'enabled'>[];
  memory?: Partial<MemoryConfig>;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentParams {
  name?: string;
  description?: string;
  model?: string;
  instructions?: string;
  tools?: Omit<AgentTool, 'enabled'>[];
  memory?: Partial<MemoryConfig>;
  metadata?: Record<string, unknown>;
}

// ── Chat / Message Types ──

export interface Message {
  id: string;
  agentId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

export interface ChatRequest {
  message: string;
  stream?: boolean;
  context?: Record<string, unknown>;
  tools?: string[];
}

export interface ChatResponse {
  message: Message;
  usage: TokenUsage;
  finishReason: FinishReason;
}

export type FinishReason = 'stop' | 'tool_call' | 'max_tokens' | 'error';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ── Task Types ──

export interface Task {
  id: string;
  agentId: string;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface CreateTaskParams {
  agentId: string;
  name: string;
  description?: string;
  priority?: TaskPriority;
  input?: Record<string, unknown>;
  scheduledAt?: string;
}

// ── Data Types ──

export interface DataStore {
  id: string;
  name: string;
  description: string;
  agentId: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataItem {
  id: string;
  storeId: string;
  key: string;
  value: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataStoreParams {
  name: string;
  description?: string;
  agentId: string;
}

export interface DataQuery {
  filter?: Record<string, unknown>;
  sort?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

// ── Streaming Types ──

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: string;
}

export type StreamEventType =
  | 'message.start'
  | 'message.delta'
  | 'message.complete'
  | 'tool_call.start'
  | 'tool_call.delta'
  | 'tool_call.complete'
  | 'error'
  | 'done';

export interface StreamOptions {
  onMessage?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

// ── Webhook Types ──

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WebhookEvent =
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.error'
  | 'task.created'
  | 'task.completed'
  | 'task.failed'
  | 'message.received'
  | 'data.updated';

export interface CreateWebhookParams {
  url: string;
  events: WebhookEvent[];
  secret?: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;
}

// ── API Response Types ──

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
