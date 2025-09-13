import { createContext } from '@lit/context';

export interface QueryContextValue {
  selectedConnectionId: string | null;
  setSelectedConnectionId: (id: string | null) => void;
  query: string;
  setQuery: (query: string) => void;
}

export const queryContext = createContext<QueryContextValue>('query-context');