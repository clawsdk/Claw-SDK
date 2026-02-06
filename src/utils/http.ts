import { AuthenticationError, NetworkError, RateLimitError, ClawError, TimeoutError } from '../errors';
import { ApiResponse } from '../types';
import { Logger } from './logger';

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export class HttpClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private maxRetries: number;
  private logger: Logger;

  constructor(baseUrl: string, apiKey: string, timeout: number, maxRetries: number, logger: Logger) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.logger = logger;
  }

  async request<T>(options: HttpRequestOptions): Promise<ApiResponse<T>> {
    const url = this.buildUrl(options.path, options.query);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-SDK-Version': '1.0.0',
      ...options.headers,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`HTTP ${options.method} ${url} (attempt ${attempt + 1})`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? this.timeout);

        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: options.signal ?? controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw await this.handleErrorResponse(response);
        }

        const data = await response.json() as T;
        return { data, status: response.status };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof AuthenticationError || error instanceof AbortError) {
          throw error;
        }

        if (error instanceof RateLimitError && attempt < this.maxRetries) {
          const delay = error.retryAfter ? error.retryAfter * 1000 : Math.pow(2, attempt) * 1000;
          this.logger.warn(`Rate limited, retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(`Request failed, retrying in ${delay}ms...`, error);
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw lastError ?? new NetworkError('Request failed after retries');
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', path, query });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', path, body });
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', path, body });
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PATCH', path, body });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', path });
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async handleErrorResponse(response: Response): Promise<ClawError> {
    let body: Record<string, unknown> = {};
    try {
      body = await response.json() as Record<string, unknown>;
    } catch {
      // ignore JSON parse errors
    }

    const message = (body.message as string) ?? `HTTP ${response.status}`;

    switch (response.status) {
      case 401:
        return new AuthenticationError(message);
      case 429: {
        const retryAfter = response.headers.get('Retry-After');
        return new RateLimitError(message, retryAfter ? parseInt(retryAfter, 10) : undefined);
      }
      default:
        return new ClawError(message, 'API_ERROR', response.status, body);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class AbortError extends Error {
  constructor() {
    super('Request was aborted');
    this.name = 'AbortError';
  }
}
