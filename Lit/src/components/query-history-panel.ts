import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { queryHistoryService, QueryHistoryEntry } from '../services/query-history-service';

@customElement('query-history-panel')
export class QueryHistoryPanel extends LitElement {
  @state() private open = false;
  @state() private searchTerm = '';
  @state() private entries: QueryHistoryEntry[] = [];

  createRenderRoot() {
    return this;
  }

  private get filteredEntries(): QueryHistoryEntry[] {
    if (!this.searchTerm.trim()) return this.entries;
    return queryHistoryService.search(this.searchTerm);
  }

  show() {
    this.entries = queryHistoryService.getHistory();
    this.searchTerm = '';
    this.open = true;
  }

  close() {
    this.open = false;
  }

  private handleGlobalEvent = (e: Event) => {
    if ((e as CustomEvent).type === 'open-query-history') {
      this.show();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('open-query-history', this.handleGlobalEvent);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('open-query-history', this.handleGlobalEvent);
  }

  private copyToClipboard(query: string) {
    navigator.clipboard.writeText(query).then(() => {
      import('./toast-notification').then(({ ToastNotification }) => {
        ToastNotification.success('Query copied to clipboard');
      });
    });
  }

  private openInNewTab(query: string, entry: QueryHistoryEntry) {
    this.dispatchEvent(new CustomEvent('add-query-editor', {
      detail: {
        query,
        connectionId: entry.connectionId || '',
        databaseName: entry.database || '',
      },
      bubbles: true,
      composed: true,
    }));
    this.close();
  }

  private clearHistory() {
    queryHistoryService.clear();
    this.entries = [];
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  render() {
    if (!this.open) return html``;

    const entries = this.filteredEntries;

    return html`
      <div class="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
           @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) this.close(); }}>
        <div class="db-modal-backdrop" @click=${() => this.close()}></div>
        <div class="relative w-[640px] max-h-[70vh] bg-surface-3 rounded-lg shadow-elevation-4 border border-db-border animate-modal-enter overflow-hidden z-10 flex flex-col"
             role="dialog" aria-modal="true" aria-label="Query History">
          <!-- Header -->
          <div class="p-3 border-b border-db-border flex items-center justify-between flex-shrink-0">
            <h2 class="text-sm font-semibold text-base-content flex items-center gap-2">
              <i class="fa-solid fa-clock-rotate-left"></i> Query History
            </h2>
            <div class="flex items-center gap-2">
              <button class="btn btn-ghost btn-xs text-feedback-muted hover:text-feedback-error" @click=${this.clearHistory} title="Clear history">
                <i class="fa-solid fa-trash-can"></i>
              </button>
              <button class="btn btn-ghost btn-xs" @click=${() => this.close()}>
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <!-- Search -->
          <div class="p-3 border-b border-db-border flex-shrink-0">
            <input
              type="text"
              class="w-full bg-surface-2 text-base-content px-3 py-2 rounded-md border border-db-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm"
              placeholder="Search query history..."
              .value=${this.searchTerm}
              @input=${(e: Event) => { this.searchTerm = (e.target as HTMLInputElement).value; }}
              autocomplete="off"
            />
          </div>
          <!-- Entries -->
          <div class="flex-1 overflow-y-auto">
            ${entries.length === 0 ? html`
              <div class="db-empty-state py-8">
                <i class="fa-solid fa-clock-rotate-left db-empty-state-icon"></i>
                <p class="db-empty-state-title">No History</p>
                <p class="db-empty-state-description">Executed queries will appear here</p>
              </div>
            ` : entries.map(entry => html`
              <div class="group px-4 py-3 border-b border-db-border/50 hover:bg-surface-4 transition-colors cursor-pointer"
                   @dblclick=${() => this.openInNewTab(entry.query, entry)}>
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2 text-xs text-feedback-muted">
                    <span class="inline-flex items-center gap-1">
                      <i class="fa-solid ${entry.success ? 'fa-check text-feedback-success' : 'fa-xmark text-feedback-error'}"></i>
                      ${entry.success ? `${entry.resultCount} docs` : 'Error'}
                    </span>
                    <span>${entry.executionTime}ms</span>
                    ${entry.database ? html`<span><i class="fa-solid fa-database text-[10px]"></i> ${entry.database}</span>` : ''}
                  </div>
                  <span class="text-xs text-feedback-muted">${this.formatTime(entry.timestamp)}</span>
                </div>
                <div class="flex items-center justify-between">
                  <pre class="text-xs font-mono text-base-content truncate flex-1 mr-2">${entry.query}</pre>
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button class="btn btn-ghost btn-xs" title="Copy" @click=${(e: Event) => { e.stopPropagation(); this.copyToClipboard(entry.query); }}>
                      <i class="fa-solid fa-copy text-xs"></i>
                    </button>
                    <button class="btn btn-ghost btn-xs" title="Open in new tab" @click=${(e: Event) => { e.stopPropagation(); this.openInNewTab(entry.query, entry); }}>
                      <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'query-history-panel': QueryHistoryPanel;
  }
}
