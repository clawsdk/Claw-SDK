import {
  Webhook,
  CreateWebhookParams,
  WebhookPayload,
  ListParams,
  PaginatedResponse,
} from '../types';
import { HttpClient } from '../utils/http';
import { createHmac } from 'crypto';

export class WebhookManager {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Register a new webhook endpoint.
   */
  async create(params: CreateWebhookParams): Promise<Webhook> {
    const response = await this.http.post<Webhook>('/webhooks', params);
    return response.data;
  }

  /**
   * Retrieve a webhook by ID.
   */
  async get(webhookId: string): Promise<Webhook> {
    const response = await this.http.get<Webhook>(`/webhooks/${webhookId}`);
    return response.data;
  }

  /**
   * List all registered webhooks.
   */
  async list(params?: ListParams): Promise<PaginatedResponse<Webhook>> {
    const response = await this.http.get<PaginatedResponse<Webhook>>('/webhooks', params as Record<string, string | number>);
    return response.data;
  }

  /**
   * Update a webhook.
   */
  async update(webhookId: string, params: Partial<CreateWebhookParams>): Promise<Webhook> {
    const response = await this.http.patch<Webhook>(`/webhooks/${webhookId}`, params);
    return response.data;
  }

  /**
   * Delete a webhook.
   */
  async delete(webhookId: string): Promise<void> {
    await this.http.delete(`/webhooks/${webhookId}`);
  }

  /**
   * Enable a webhook.
   */
  async enable(webhookId: string): Promise<Webhook> {
    const response = await this.http.post<Webhook>(`/webhooks/${webhookId}/enable`);
    return response.data;
  }

  /**
   * Disable a webhook.
   */
  async disable(webhookId: string): Promise<Webhook> {
    const response = await this.http.post<Webhook>(`/webhooks/${webhookId}/disable`);
    return response.data;
  }

  /**
   * Verify a webhook payload signature.
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }

  /**
   * Parse a webhook payload from an incoming request body.
   */
  parsePayload(body: string): WebhookPayload {
    return JSON.parse(body) as WebhookPayload;
  }
}
