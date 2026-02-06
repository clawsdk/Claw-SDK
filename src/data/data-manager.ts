import {
  DataStore,
  DataItem,
  CreateDataStoreParams,
  DataQuery,
  ListParams,
  PaginatedResponse,
} from '../types';
import { HttpClient } from '../utils/http';

export class DataManager {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  // ── Data Stores ──

  /**
   * Create a new data store.
   */
  async createStore(params: CreateDataStoreParams): Promise<DataStore> {
    const response = await this.http.post<DataStore>('/data/stores', params);
    return response.data;
  }

  /**
   * Retrieve a data store by ID.
   */
  async getStore(storeId: string): Promise<DataStore> {
    const response = await this.http.get<DataStore>(`/data/stores/${storeId}`);
    return response.data;
  }

  /**
   * List all data stores.
   */
  async listStores(params?: ListParams): Promise<PaginatedResponse<DataStore>> {
    const response = await this.http.get<PaginatedResponse<DataStore>>('/data/stores', params as Record<string, string | number>);
    return response.data;
  }

  /**
   * Delete a data store.
   */
  async deleteStore(storeId: string): Promise<void> {
    await this.http.delete(`/data/stores/${storeId}`);
  }

  // ── Data Items ──

  /**
   * Set a value in a data store.
   */
  async set(storeId: string, key: string, value: unknown, metadata?: Record<string, unknown>): Promise<DataItem> {
    const response = await this.http.post<DataItem>(`/data/stores/${storeId}/items`, {
      key,
      value,
      metadata,
    });
    return response.data;
  }

  /**
   * Get a value from a data store.
   */
  async get(storeId: string, key: string): Promise<DataItem> {
    const response = await this.http.get<DataItem>(`/data/stores/${storeId}/items/${key}`);
    return response.data;
  }

  /**
   * Delete a value from a data store.
   */
  async delete(storeId: string, key: string): Promise<void> {
    await this.http.delete(`/data/stores/${storeId}/items/${key}`);
  }

  /**
   * Query items in a data store.
   */
  async query(storeId: string, query: DataQuery): Promise<PaginatedResponse<DataItem>> {
    const response = await this.http.post<PaginatedResponse<DataItem>>(`/data/stores/${storeId}/query`, query);
    return response.data;
  }
}
