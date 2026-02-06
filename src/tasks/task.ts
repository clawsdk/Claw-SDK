import {
  Task,
  CreateTaskParams,
  ListParams,
  PaginatedResponse,
} from '../types';
import { HttpClient } from '../utils/http';

export class TaskManager {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new task for an agent.
   */
  async create(params: CreateTaskParams): Promise<Task> {
    const response = await this.http.post<Task>('/tasks', params);
    return response.data;
  }

  /**
   * Retrieve a task by ID.
   */
  async get(taskId: string): Promise<Task> {
    const response = await this.http.get<Task>(`/tasks/${taskId}`);
    return response.data;
  }

  /**
   * List all tasks.
   */
  async list(params?: ListParams & { agentId?: string; status?: string }): Promise<PaginatedResponse<Task>> {
    const response = await this.http.get<PaginatedResponse<Task>>('/tasks', params as Record<string, string | number>);
    return response.data;
  }

  /**
   * Cancel a running or pending task.
   */
  async cancel(taskId: string): Promise<Task> {
    const response = await this.http.post<Task>(`/tasks/${taskId}/cancel`);
    return response.data;
  }

  /**
   * Retry a failed task.
   */
  async retry(taskId: string): Promise<Task> {
    const response = await this.http.post<Task>(`/tasks/${taskId}/retry`);
    return response.data;
  }

  /**
   * Get the output/result of a completed task.
   */
  async getResult(taskId: string): Promise<Record<string, unknown>> {
    const response = await this.http.get<Record<string, unknown>>(`/tasks/${taskId}/result`);
    return response.data;
  }
}
