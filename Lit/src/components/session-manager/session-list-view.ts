import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SessionInfo } from './session-manager-types';
import { getStateColor, formatDuration, formatTimestamp } from './session-manager-types';

type SortField = 'session_id' | 'username' | 'database' | 'state' | 'client_ip' | 'query_duration_ms' | 'last_activity';
type SortDir = 'asc' | 'desc';

@customElement('session-list-view')
export class SessionListView extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Array })
  sessions: SessionInfo[] = [];

  @property({ type: Boolean })
  loading = false;

  @property({ type: Boolean })
  connected = false;

  @property({ type: Boolean })
  stale = false;

  @property({ type: String })
  error = '';

  @state()
  private searchFilter = '';

  @state()
  private sortField: SortField = 'session_id';

  @state()
  private sortDir: SortDir = 'asc';

  private handleSearchInput(e: Event) {
    this.searchFilter = (e.target as HTMLInputElement).value;
  }

  private handleSort(field: SortField) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
  }

  private handleRowClick(session: SessionInfo) {
    this.dispatchEvent(new CustomEvent('session-selected', {
      bubbles: true, composed: true,
      detail: { sessionId: session.session_id }
    }));
  }

  private get filteredSessions(): SessionInfo[] {
    let result = this.sessions;

    if (this.searchFilter) {
      const filter = this.searchFilter.toLowerCase();
      result = result.filter(s =>
        (s.session_id || '').toLowerCase().includes(filter) ||
        (s.username || '').toLowerCase().includes(filter) ||
        (s.database || '').toLowerCase().includes(filter) ||
        (s.state || '').toLowerCase().includes(filter) ||
        (s.client_ip || '').toLowerCase().includes(filter) ||
        (s.current_query || '').toLowerCase().includes(filter)
      );
    }

    result = [...result].sort((a, b) => {
      const field = this.sortField;
      let cmp = 0;
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return this.sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }

  private sortIcon(field: SortField) {
    if (this.sortField !== field) return html`<i class="fa-solid fa-sort text-base-content/30 ml-1"></i>`;
    return this.sortDir === 'asc'
      ? html`<i class="fa-solid fa-sort-up ml-1"></i>`
      : html`<i class="fa-solid fa-sort-down ml-1"></i>`;
  }

  render() {
    if (!this.connected && !this.stale) {
      return html`
        <div class="flex items-center justify-center h-full text-base-content/50">
          <div class="text-center">
            <i class="fa-solid fa-users text-4xl mb-3"></i>
            <p class="text-sm">Connect to a server to view active sessions</p>
          </div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="flex items-center justify-center h-full">
          <div class="alert alert-error max-w-md">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${this.error}</span>
          </div>
        </div>
      `;
    }

    return html`
      <div class="h-full flex flex-col overflow-hidden">
        <!-- Search bar -->
        <div class="px-3 py-2 border-b border-base-300 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="relative flex-1 max-w-sm">
              <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-xs"></i>
              <input type="text" placeholder="Filter sessions..."
                     class="input input-sm input-bordered w-full pl-8"
                     .value=${this.searchFilter}
                     @input=${this.handleSearchInput} />
            </div>
            <span class="text-xs text-base-content/60">
              ${this.filteredSessions.length} of ${this.sessions.length} sessions
            </span>
            ${this.loading ? html`<span class="loading loading-spinner loading-xs"></span>` : ''}
          </div>
        </div>

        <!-- Table -->
        <div class="flex-1 overflow-auto">
          <table class="table table-xs table-zebra w-full">
            <thead class="sticky top-0 bg-base-200 z-10">
              <tr>
                <th class="cursor-pointer select-none" @click=${() => this.handleSort('session_id')}>
                  Session ID ${this.sortIcon('session_id')}
                </th>
                <th class="cursor-pointer select-none" @click=${() => this.handleSort('username')}>
                  Username ${this.sortIcon('username')}
                </th>
                <th class="cursor-pointer select-none" @click=${() => this.handleSort('database')}>
                  Database ${this.sortIcon('database')}
                </th>
                <th class="cursor-pointer select-none" @click=${() => this.handleSort('state')}>
                  State ${this.sortIcon('state')}
                </th>
                <th class="cursor-pointer select-none" @click=${() => this.handleSort('client_ip')}>
                  Client IP ${this.sortIcon('client_ip')}
                </th>
                <th>Current Query</th>
                <th class="cursor-pointer select-none" @click=${() => this.handleSort('query_duration_ms')}>
                  Duration ${this.sortIcon('query_duration_ms')}
                </th>
                <th class="cursor-pointer select-none" @click=${() => this.handleSort('last_activity')}>
                  Last Activity ${this.sortIcon('last_activity')}
                </th>
              </tr>
            </thead>
            <tbody>
              ${this.filteredSessions.length === 0 ? html`
                <tr>
                  <td colspan="8" class="text-center text-base-content/50 py-8">
                    ${this.sessions.length === 0
                      ? 'No active sessions'
                      : 'No sessions match the filter'}
                  </td>
                </tr>
              ` : this.filteredSessions.map(session => html`
                <tr class="hover cursor-pointer" @click=${() => this.handleRowClick(session)}>
                  <td class="font-mono text-xs">${session.session_id.substring(0, 12)}...</td>
                  <td>${session.username}</td>
                  <td>${session.database || '-'}</td>
                  <td>
                    <span class="badge badge-sm ${getStateColor(session.state)}">${session.state}</span>
                  </td>
                  <td class="font-mono text-xs">${session.client_ip}</td>
                  <td class="max-w-[200px] truncate" title=${session.current_query}>
                    ${session.current_query || '-'}
                  </td>
                  <td>${session.query_duration_ms > 0 ? formatDuration(session.query_duration_ms) : '-'}</td>
                  <td class="text-xs">${formatTimestamp(session.last_activity)}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list-view': SessionListView;
  }
}
