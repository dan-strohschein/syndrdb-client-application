import { createContext } from '@lit/context';
import { Connection } from '../services/connection-manager';

export interface QueryEditorContext {
  selectedConnectionId: string | null;
  setSelectedConnectionId: (id: string | null) => void;
  connection: Connection | undefined;
  setConnection: (connection: Connection | undefined) => void;
  queryEditors: Array<string>
  setQueryEditors: (editors: Array<string>) => void;
}

export const queryEditorContext = createContext<QueryEditorContext>('query-editor-context');