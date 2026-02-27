/**
 * Query History Service — persists executed queries in localStorage.
 * Singleton. Max 100 entries, FIFO eviction.
 */

const STORAGE_KEY = 'syndrdb-query-history';
const MAX_ENTRIES = 100;

export interface QueryHistoryEntry {
  id: string;
  query: string;
  connectionId: string | null;
  database: string | null;
  success: boolean;
  resultCount: number;
  executionTime: number;
  timestamp: number;
}

class QueryHistoryService {
  private static _instance: QueryHistoryService;
  private entries: QueryHistoryEntry[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): QueryHistoryService {
    if (!QueryHistoryService._instance) {
      QueryHistoryService._instance = new QueryHistoryService();
    }
    return QueryHistoryService._instance;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // localStorage may be full — evict oldest half and retry
      this.entries = this.entries.slice(0, Math.floor(this.entries.length / 2));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
      } catch {
        // give up silently
      }
    }
  }

  addEntry(
    query: string,
    connectionId: string | null,
    database: string | null,
    success: boolean,
    resultCount: number,
    executionTime: number,
  ): void {
    const entry: QueryHistoryEntry = {
      id: `qh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      query: query.trim(),
      connectionId,
      database,
      success,
      resultCount,
      executionTime,
      timestamp: Date.now(),
    };

    this.entries.unshift(entry);

    // FIFO eviction
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }

    this.saveToStorage();
  }

  getHistory(limit?: number): QueryHistoryEntry[] {
    return limit ? this.entries.slice(0, limit) : [...this.entries];
  }

  search(term: string): QueryHistoryEntry[] {
    const lower = term.toLowerCase();
    return this.entries.filter(e => e.query.toLowerCase().includes(lower));
  }

  clear(): void {
    this.entries = [];
    this.saveToStorage();
  }
}

export const queryHistoryService = QueryHistoryService.getInstance();
