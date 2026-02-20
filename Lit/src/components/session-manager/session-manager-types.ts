/** Session data received from MONITOR SESSIONS snapshots */
export interface SessionInfo {
  session_id: string;
  username: string;
  database: string;
  state: 'IDLE' | 'ACTIVE' | 'EXECUTING' | 'TRANSACTION' | string;
  client_ip: string;
  created_at: string;
  last_activity: string;
  current_query: string;
  query_duration_ms: number;
  transaction_id: string;
}

/** A completed query entry from the session's query history */
export interface QueryHistoryEntry {
  query: string;
  status: string;
  duration_ms: number;
  affected_rows: number;
  completed_at: string;
  error?: string;
}

/** Last completed query snapshot fields */
export interface LastCompletedQuery {
  query: string;
  status: string;
  duration_ms: number;
  affected_rows: number;
  completed_at: string;
}

/** Extended session detail from MONITOR SESSION "<id>" */
export interface SessionDetail extends SessionInfo {
  connection_id: string;
  expires_at: string;
  error_count: number;
  query_history_len: number;
  current_query_status: string;
  transaction_status: string;
  last_error: string;
  last_completed_query?: LastCompletedQuery;
  query_history?: QueryHistoryEntry[];
}

/** DaisyUI badge class for session states */
export function getStateColor(state: string | undefined | null): string {
  if (!state) return 'badge-neutral';
  switch (state.toUpperCase()) {
    case 'IDLE': return 'badge-ghost';
    case 'ACTIVE': return 'badge-success';
    case 'EXECUTING': return 'badge-warning';
    case 'TRANSACTION': return 'badge-info';
    default: return 'badge-neutral';
  }
}

/** DaisyUI badge class for query statuses */
export function getQueryStatusColor(status: string | undefined | null): string {
  if (!status) return 'badge-neutral';
  switch (status.toUpperCase()) {
    case 'SUCCESS': case 'COMPLETED': case 'OK': return 'badge-success';
    case 'FAILED': case 'ERROR': return 'badge-error';
    case 'EXECUTING': return 'badge-warning';
    default: return 'badge-neutral';
  }
}

/** Format milliseconds into human-readable duration */
export function formatDuration(ms: number): string {
  if (ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = ((ms % 60_000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

/** Format ISO timestamp to locale time */
export function formatTimestamp(ts: string): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}
