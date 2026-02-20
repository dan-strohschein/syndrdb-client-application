import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ServerMetric, MetricCategory } from './profiler-types';
import { METRIC_CATEGORIES, formatMetricValue } from './profiler-types';

@customElement('profiler-metrics-display')
export class ProfilerMetricsDisplay extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Array })
  metrics: ServerMetric[] = [];

  @property({ type: Boolean })
  loading = false;

  @property({ type: Boolean })
  connected = false;

  @property({ type: String })
  error = '';

  @state()
  private searchQuery = '';

  @state()
  private activeFilters: Set<MetricCategory> = new Set();

  @state()
  private collapsedCategories: Set<MetricCategory> = new Set();

  @state()
  private sortColumn: 'name' | 'value' = 'value';

  @state()
  private sortDirection: 'asc' | 'desc' = 'desc';

  private handleSearchInput(e: Event) {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  private toggleCategoryFilter(category: MetricCategory) {
    const newFilters = new Set(this.activeFilters);
    if (newFilters.has(category)) {
      newFilters.delete(category);
    } else {
      newFilters.add(category);
    }
    this.activeFilters = newFilters;
  }

  private clearFilters() {
    this.activeFilters = new Set();
    this.searchQuery = '';
  }

  private handleSortClick(column: 'name' | 'value') {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc';
    }
  }

  private sortMetrics(metrics: ServerMetric[]): ServerMetric[] {
    const sorted = [...metrics];
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    if (this.sortColumn === 'name') {
      sorted.sort((a, b) => dir * a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => dir * (this.numericValue(a.value) - this.numericValue(b.value)));
    }
    return sorted;
  }

  private numericValue(value: string | number): number {
    if (typeof value === 'number') return value;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private toggleCategoryCollapse(category: MetricCategory) {
    const newCollapsed = new Set(this.collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    this.collapsedCategories = newCollapsed;
  }

  private get filteredMetrics(): ServerMetric[] {
    let filtered = this.metrics;

    if (this.activeFilters.size > 0) {
      filtered = filtered.filter(m => this.activeFilters.has(m.category));
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(m => m.name.toLowerCase().includes(query));
    }

    return filtered;
  }

  private get groupedMetrics(): Map<MetricCategory, ServerMetric[]> {
    const groups = new Map<MetricCategory, ServerMetric[]>();
    for (const metric of this.filteredMetrics) {
      const existing = groups.get(metric.category) || [];
      existing.push(metric);
      groups.set(metric.category, existing);
    }
    return groups;
  }

  private get categoriesWithCounts(): Array<{ def: typeof METRIC_CATEGORIES[0]; count: number }> {
    const countMap = new Map<MetricCategory, number>();
    for (const metric of this.metrics) {
      countMap.set(metric.category, (countMap.get(metric.category) || 0) + 1);
    }
    return METRIC_CATEGORIES
      .map(def => ({ def, count: countMap.get(def.id) || 0 }))
      .filter(item => item.count > 0);
  }

  private renderTypeBadge(type: string) {
    const badgeClass = {
      'counter': 'badge-info',
      'gauge': 'badge-success',
      'histogram_bucket': 'badge-warning',
      'snapshot': 'badge-secondary'
    }[type] || 'badge-ghost';

    return html`<span class="badge badge-xs ${badgeClass}">${type}</span>`;
  }

  render() {
    // Error state
    if (this.error) {
      return html`
        <div class="p-6">
          <div class="alert alert-error">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>${this.error}</span>
          </div>
        </div>
      `;
    }

    // Empty / not connected state
    if (!this.connected) {
      return html`
        <div class="flex flex-col items-center justify-center h-full text-base-content/50 p-8">
          <i class="fa-solid fa-gauge-high text-5xl mb-4"></i>
          <div class="text-lg font-medium mb-1">Server Profiler</div>
          <div class="text-sm">Connect to a server to view profiling metrics</div>
        </div>
      `;
    }

    // Loading state (initial load)
    if (this.loading && this.metrics.length === 0) {
      return html`
        <div class="flex flex-col items-center justify-center h-full p-8">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <div class="text-sm mt-3 text-base-content/60">Loading metrics...</div>
        </div>
      `;
    }

    const grouped = this.groupedMetrics;

    return html`
      <div class="flex flex-col h-full">
        <!-- Search + filter bar -->
        <div class="p-3 bg-base-100 border-b border-base-300 flex-shrink-0">
          <div class="flex items-center gap-2 mb-2">
            <div class="relative flex-1">
              <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-xs"></i>
              <input type="text" placeholder="Search metrics..."
                     class="input input-sm input-bordered w-full pl-8"
                     .value=${this.searchQuery}
                     @input=${this.handleSearchInput} />
            </div>
            <span class="text-xs text-base-content/60">
              ${this.filteredMetrics.length} / ${this.metrics.length} metrics
            </span>
            ${this.activeFilters.size > 0 || this.searchQuery ? html`
              <button class="btn btn-xs btn-ghost" @click=${this.clearFilters}>Clear</button>
            ` : nothing}
          </div>
          <!-- Category filter pills -->
          <div class="flex flex-wrap gap-1">
            ${this.categoriesWithCounts.map(({ def, count }) => html`
              <button class="badge badge-sm cursor-pointer select-none
                ${this.activeFilters.has(def.id) ? 'badge-primary' : 'badge-outline'}"
                @click=${() => this.toggleCategoryFilter(def.id)}>
                <i class="fa-solid ${def.icon} mr-1 text-[10px]"></i>
                ${def.label}
                <span class="ml-1 opacity-70">(${count})</span>
              </button>
            `)}
          </div>
        </div>

        <!-- Metrics body -->
        <div class="flex-1 overflow-auto p-3 space-y-2">
          ${this.loading && this.metrics.length > 0 ? html`
            <div class="text-center py-1">
              <span class="loading loading-dots loading-sm text-primary"></span>
            </div>
          ` : nothing}

          ${grouped.size === 0 ? html`
            <div class="text-center text-base-content/50 py-8">
              <i class="fa-solid fa-filter-circle-xmark text-3xl mb-2"></i>
              <div>No metrics match your filters</div>
            </div>
          ` : nothing}

          ${[...grouped.entries()].map(([category, metrics]) => {
            const catDef = METRIC_CATEGORIES.find(c => c.id === category);
            const isCollapsed = this.collapsedCategories.has(category);
            const sortedMetrics = this.sortMetrics(metrics);
            return html`
              <div class="card card-compact bg-base-100 border border-base-300">
                <div class="card-body p-0">
                  <!-- Category header -->
                  <button class="flex items-center gap-2 p-2 px-3 hover:bg-base-200 w-full text-left"
                          @click=${() => this.toggleCategoryCollapse(category)}>
                    <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-xs text-base-content/50 w-3"></i>
                    <i class="fa-solid ${catDef?.icon || 'fa-chart-bar'} text-xs text-primary"></i>
                    <span class="font-medium text-sm">${category}</span>
                    <span class="badge badge-xs badge-ghost ml-auto">${metrics.length}</span>
                  </button>

                  ${!isCollapsed ? html`
                    <div class="overflow-x-auto">
                      <table class="table table-xs table-zebra w-full">
                        <thead>
                          <tr>
                            <th class="w-1/2 cursor-pointer select-none hover:bg-base-200"
                                @click=${() => this.handleSortClick('name')}>
                              Metric
                              ${this.sortColumn === 'name' ? html`
                                <i class="fa-solid ${this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} ml-1 text-primary text-[10px]"></i>
                              ` : html`
                                <i class="fa-solid fa-sort ml-1 text-base-content/30 text-[10px]"></i>
                              `}
                            </th>
                            <th class="w-1/3 cursor-pointer select-none hover:bg-base-200"
                                @click=${() => this.handleSortClick('value')}>
                              Value
                              ${this.sortColumn === 'value' ? html`
                                <i class="fa-solid ${this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} ml-1 text-primary text-[10px]"></i>
                              ` : html`
                                <i class="fa-solid fa-sort ml-1 text-base-content/30 text-[10px]"></i>
                              `}
                            </th>
                            <th class="w-1/6">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${sortedMetrics.map(m => html`
                            <tr>
                              <td class="font-mono text-xs">${m.name}</td>
                              <td class="font-bold text-xs">${formatMetricValue(m.value)}</td>
                              <td>${this.renderTypeBadge(m.type)}</td>
                            </tr>
                          `)}
                        </tbody>
                      </table>
                    </div>
                  ` : nothing}
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'profiler-metrics-display': ProfilerMetricsDisplay;
  }
}
