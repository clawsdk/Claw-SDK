import {
  Agent,
  CreateAgentParams,
  UpdateAgentParams,
  ChatRequest,
  ChatResponse,
  ListParams,
  PaginatedResponse,
  ApiResponse,
} from '../types';
import { HttpClient } from '../utils/http';

export class AgentManager {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new AI agent.
   */
  async create(params: CreateAgentParams): Promise<Agent> {
    const response = await this.http.post<Agent>('/agents', params);
    return response.data;
  }

  /**
   * Retrieve an agent by ID.
   */
  async get(agentId: string): Promise<Agent> {
    const response = await this.http.get<Agent>(`/agents/${agentId}`);
    return response.data;
  }

  /**
   * List all agents.
   */
  async list(params?: ListParams): Promise<PaginatedResponse<Agent>> {
    const response = await this.http.get<PaginatedResponse<Agent>>('/agents', params as Record<string, string | number>);
    return response.data;
  }

  /**
   * Update an existing agent.
   */
  async update(agentId: string, params: UpdateAgentParams): Promise<Agent> {
    const response = await this.http.patch<Agent>(`/agents/${agentId}`, params);
    return response.data;
  }

  /**
   * Delete an agent.
   */
  async delete(agentId: string): Promise<void> {
    await this.http.delete(`/agents/${agentId}`);
  }

  /**
   * Start an agent.
   */
  async start(agentId: string): Promise<Agent> {
    const response = await this.http.post<Agent>(`/agents/${agentId}/start`);
    return response.data;
  }

  /**
   * Stop an agent.
   */
  async stop(agentId: string): Promise<Agent> {
    const response = await this.http.post<Agent>(`/agents/${agentId}/stop`);
    return response.data;
  }

  /**
   * Pause an agent.
   */
  async pause(agentId: string): Promise<Agent> {
    const response = await this.http.post<Agent>(`/agents/${agentId}/pause`);
    return response.data;
  }

  /**
   * Send a chat message to an agent.
   */
  async chat(agentId: string, request: ChatRequest): Promise<ChatResponse> {
    const response = await this.http.post<ChatResponse>(`/agents/${agentId}/chat`, request);
    return response.data;
  }
}
