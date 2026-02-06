import { StreamEvent, StreamOptions, ChatRequest } from '../types';
import { NetworkError } from '../errors';
import { Logger } from '../utils/logger';

export class StreamManager {
  private baseUrl: string;
  private apiKey: string;
  private logger: Logger;

  constructor(baseUrl: string, apiKey: string, logger: Logger) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.logger = logger;
  }

  /**
   * Stream a chat response from an agent using Server-Sent Events.
   */
  async streamChat(agentId: string, request: ChatRequest, options: StreamOptions): Promise<void> {
    const url = `${this.baseUrl}/agents/${agentId}/chat/stream`;

    this.logger.debug(`Opening stream to ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream',
          'X-SDK-Version': '1.0.0',
        },
        body: JSON.stringify(request),
        signal: options.signal,
      });

      if (!response.ok) {
        throw new NetworkError(`Stream request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new NetworkError('Response body is empty');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          options.onComplete?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              options.onComplete?.();
              return;
            }

            try {
              const event = JSON.parse(data) as StreamEvent;
              options.onMessage?.(event);
            } catch {
              this.logger.warn('Failed to parse stream event:', data);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.debug('Stream aborted by user');
        return;
      }

      const err = error instanceof Error ? error : new NetworkError('Stream failed');
      options.onError?.(err);
      throw err;
    }
  }
}
