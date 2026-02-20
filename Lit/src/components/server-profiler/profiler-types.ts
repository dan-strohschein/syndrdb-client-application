export type MetricType = 'counter' | 'gauge' | 'histogram_bucket' | 'snapshot';

export interface ServerMetric {
  name: string;
  value: string | number;
  type: MetricType;
  category: MetricCategory;
}

export type MetricCategory =
  | 'Hash Index'
  | 'B-Tree Index'
  | 'Storage Engine'
  | 'WAL'
  | 'Buffer Pool'
  | 'Query Executor'
  | 'Transaction'
  | 'Cache'
  | 'Connection'
  | 'Replication'
  | 'Compaction'
  | 'Memory'
  | 'Disk I/O'
  | 'Network'
  | 'Lock Manager'
  | 'Schema'
  | 'Snapshot'
  | 'General';

export interface MetricCategoryDefinition {
  id: MetricCategory;
  label: string;
  icon: string;
  prefixes: string[];
}

export const METRIC_CATEGORIES: MetricCategoryDefinition[] = [
  { id: 'Hash Index', label: 'Hash Index', icon: 'fa-hashtag', prefixes: ['hash_index_'] },
  { id: 'B-Tree Index', label: 'B-Tree Index', icon: 'fa-sitemap', prefixes: ['btree_', 'b_tree_'] },
  { id: 'Storage Engine', label: 'Storage Engine', icon: 'fa-hard-drive', prefixes: ['storage_', 'engine_', 'data_file_'] },
  { id: 'WAL', label: 'WAL', icon: 'fa-scroll', prefixes: ['wal_'] },
  { id: 'Buffer Pool', label: 'Buffer Pool', icon: 'fa-layer-group', prefixes: ['buffer_pool_', 'buffer_'] },
  { id: 'Query Executor', label: 'Query Executor', icon: 'fa-play', prefixes: ['query_', 'executor_', 'parse_'] },
  { id: 'Transaction', label: 'Transaction', icon: 'fa-exchange-alt', prefixes: ['tx_', 'transaction_'] },
  { id: 'Cache', label: 'Cache', icon: 'fa-bolt', prefixes: ['cache_'] },
  { id: 'Connection', label: 'Connection', icon: 'fa-plug', prefixes: ['conn_', 'connection_', 'session_'] },
  { id: 'Replication', label: 'Replication', icon: 'fa-clone', prefixes: ['repl_', 'replication_'] },
  { id: 'Compaction', label: 'Compaction', icon: 'fa-compress', prefixes: ['compaction_', 'compact_'] },
  { id: 'Memory', label: 'Memory', icon: 'fa-memory', prefixes: ['mem_', 'memory_', 'heap_', 'alloc_'] },
  { id: 'Disk I/O', label: 'Disk I/O', icon: 'fa-hdd', prefixes: ['disk_', 'io_', 'read_', 'write_'] },
  { id: 'Network', label: 'Network', icon: 'fa-network-wired', prefixes: ['net_', 'network_', 'bytes_sent_', 'bytes_recv_'] },
  { id: 'Lock Manager', label: 'Lock Manager', icon: 'fa-lock', prefixes: ['lock_', 'mutex_', 'deadlock_'] },
  { id: 'Schema', label: 'Schema', icon: 'fa-project-diagram', prefixes: ['schema_', 'bundle_', 'field_'] },
  { id: 'Snapshot', label: 'Snapshot', icon: 'fa-camera', prefixes: ['snapshot_', 'snap_'] },
  { id: 'General', label: 'General', icon: 'fa-chart-bar', prefixes: [] },
];

export function categorizeMetricName(name: string): MetricCategory {
  const lowerName = toSnakeCase(name);

  // First pass: prefix match (highest confidence)
  for (const cat of METRIC_CATEGORIES) {
    if (cat.prefixes.length === 0) continue;
    for (const prefix of cat.prefixes) {
      if (lowerName.startsWith(prefix)) {
        return cat.id;
      }
    }
  }

  // Second pass: substring match (handles wrapped/prefixed names)
  for (const cat of METRIC_CATEGORIES) {
    if (cat.prefixes.length === 0) continue;
    for (const prefix of cat.prefixes) {
      if (lowerName.includes(prefix)) {
        return cat.id;
      }
    }
  }

  return 'General';
}

/** Convert CamelCase/PascalCase to snake_case, passthrough already-snake strings */
function toSnakeCase(str: string): string {
  // If already looks like snake_case, just lowercase
  if (str.includes('_')) return str.toLowerCase();
  // Convert PascalCase/camelCase → snake_case
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toLowerCase();
}

export function inferMetricType(name: string, value: string | number): MetricType {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('_total') || lowerName.includes('_count')) return 'counter';
  if (lowerName.includes('_bucket')) return 'histogram_bucket';
  if (lowerName.includes('snapshot')) return 'snapshot';
  return 'gauge';
}

export function formatMetricValue(value: string | number): string {
  if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num)) return formatNumericValue(num);
    return value;
  }
  return formatNumericValue(value);
}

function formatNumericValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
