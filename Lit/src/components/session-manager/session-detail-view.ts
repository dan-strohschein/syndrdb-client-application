import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SessionDetail, QueryHistoryEntry } from './session-manager-types';
import { getStateColor, getQueryStatusColor, formatDuration, formatTimestamp } from './session-manager-types';

@customElement('session-detail-view')
export class SessionDetailView extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Object })
  session: SessionDetail | null = null;

  @property({ type: Boolean })
  loading = false;

  @property({ type: Boolean })
  stale = false;

  private handleBack() {
    this.dispatchEvent(new CustomEvent('session-detail-back', {
      bubbles: true, composed: true
    }));
  }

  private renderField(label: string, value: string | number | null | undefined) {
    const display = value === null || value === undefined || value === '' ? '-' : String(value);
    return html`
      <div class="flex justify-between py-1 border-b border-base-200 last:border-0">
        <span class="text-xs text-base-content/60 font-medium">${label}</span>
        <span class="text-xs font-mono">${display}</span>
      </div>
    `;
  }

  render() {
    const s = this.session;

    return html`
      <div class="h-full flex flex-col overflow-auto p-4">
        <!-- Header with back button — always visible -->
        <div class="flex items-center gap-3 mb-4 flex-shrink-0">
          <button class="btn btn-sm btn-ghost" @click=${this.handleBack}>
            <i class="fa-solid fa-arrow-left mr-1"></i> Back to All Sessions
          </button>
          <div class="flex-1"></div>
          ${s ? html`<span class="badge badge-lg ${getStateColor(s.state)}">${s.state}</span>` : ''}
          ${this.stale ? html`<span class="badge badge-lg badge-warning badge-outline">Stopped</span>` : ''}
          ${this.loading ? html`<span class="loading loading-spinner loading-sm"></span>` : ''}
        </div>

        ${!s ? html`
          <div class="flex items-center justify-center flex-1 text-base-content/50">
            ${this.loading
              ? html`<span class="loading loading-spinner loading-lg"></span>`
              : html`<p>No session data</p>`}
          </div>
        ` : html`
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Connection Info -->
          <div class="card bg-base-200 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">
                <i class="fa-solid fa-plug text-primary"></i> Connection Info
              </h3>
              ${this.renderField('Session ID', s.session_id)}
              ${this.renderField('Connection ID', s.connection_id)}
              ${this.renderField('Username', s.username)}
              ${this.renderField('Database', s.database)}
              ${this.renderField('Client IP', s.client_ip)}
              ${this.renderField('Created', formatTimestamp(s.created_at))}
              ${this.renderField('Expires', formatTimestamp(s.expires_at))}
            </div>
          </div>

          <!-- Activity -->
          <div class="card bg-base-200 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">
                <i class="fa-solid fa-bolt text-warning"></i> Activity
              </h3>
              ${this.renderField('State', s.state)}
              ${this.renderField('Last Activity', formatTimestamp(s.last_activity))}
              ${this.renderField('Query Duration', formatDuration(s.query_duration_ms))}
              ${this.renderField('Query Status', s.current_query_status)}
              ${this.renderField('Query History Length', s.query_history_len)}
            </div>
          </div>

          <!-- Transaction -->
          <div class="card bg-base-200 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">
                <i class="fa-solid fa-exchange-alt text-info"></i> Transaction
              </h3>
              ${this.renderField('Transaction ID', s.transaction_id)}
              ${this.renderField('Transaction Status', s.transaction_status)}
            </div>
          </div>

          <!-- Statistics -->
          <div class="card bg-base-200 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">
                <i class="fa-solid fa-chart-bar text-success"></i> Statistics
              </h3>
              ${this.renderField('Error Count', s.error_count)}
              ${this.renderField('Last Error', s.last_error)}
            </div>
          </div>
        </div>

        <!-- Current Query -->
        ${s.current_query ? html`
          <div class="card bg-base-200 shadow-sm mt-4">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">
                <i class="fa-solid fa-play text-warning"></i> Currently Executing
              </h3>
              <div class="flex items-center gap-2 mb-2">
                <span class="badge badge-sm badge-warning">EXECUTING</span>
                <span class="text-xs text-base-content/60">${formatDuration(s.query_duration_ms)} elapsed</span>
              </div>
              <pre class="bg-base-300 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">${s.current_query}</pre>
            </div>
          </div>
        ` : ''}

        <!-- Last Completed Query -->
        ${s.last_completed_query ? html`
          <div class="card bg-base-200 shadow-sm mt-4">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">
                <i class="fa-solid fa-check-circle text-success"></i> Last Completed Query
              </h3>
              <div class="flex items-center gap-3 mb-2 flex-wrap">
                <span class="badge badge-sm ${getQueryStatusColor(s.last_completed_query.status)}">${s.last_completed_query.status}</span>
                <span class="text-xs text-base-content/60">${formatDuration(s.last_completed_query.duration_ms)}</span>
                <span class="text-xs text-base-content/60">${s.last_completed_query.affected_rows ?? 0} rows affected</span>
                <span class="text-xs text-base-content/40">${formatTimestamp(s.last_completed_query.completed_at)}</span>
              </div>
              <pre class="bg-base-300 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">${s.last_completed_query.query}</pre>
            </div>
          </div>
        ` : ''}

        <!-- Query History -->
        ${s.query_history && s.query_history.length > 0 ? html`
          <div class="card bg-base-200 shadow-sm mt-4">
            <div class="card-body p-4">
              <h3 class="card-title text-sm mb-2">
                <i class="fa-solid fa-clock-rotate-left text-secondary"></i> Recent Query History
                <span class="badge badge-sm badge-neutral ml-1">${s.query_history.length}</span>
              </h3>
              <div class="overflow-x-auto">
                <table class="table table-xs table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Rows</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${s.query_history.map((entry: QueryHistoryEntry) => html`
                      <tr>
                        <td class="max-w-[300px]">
                          <pre class="text-xs font-mono whitespace-pre-wrap break-all">${entry.query || '-'}</pre>
                        </td>
                        <td>
                          <span class="badge badge-sm ${getQueryStatusColor(entry.status)}">${entry.status || '-'}</span>
                          ${entry.error ? html`<div class="text-xs text-error mt-1">${entry.error}</div>` : ''}
                        </td>
                        <td class="text-xs">${formatDuration(entry.duration_ms)}</td>
                        <td class="text-xs">${entry.affected_rows ?? '-'}</td>
                        <td class="text-xs">${formatTimestamp(entry.completed_at)}</td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : ''}
        `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-detail-view': SessionDetailView;
  }
}
