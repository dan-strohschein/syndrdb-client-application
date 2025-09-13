import { createContext } from '@lit/context';

export interface ConnectionContext {
  selectedConnectionId: string | null;
  setSelectedConnectionId: (id: string | null) => void;
  
}

export const connectionContext = createContext<ConnectionContext>('connection-context');