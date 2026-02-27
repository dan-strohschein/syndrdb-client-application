import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: string; // CustomEvent name to dispatch
  detail?: Record<string, unknown>;
}

const COMMANDS: PaletteCommand[] = [
  { id: 'new-connection', label: 'New Connection', shortcut: 'Ctrl+N', category: 'Connections', action: 'open-connection-modal' },
  { id: 'open-connection', label: 'Open Saved Connection', shortcut: 'Ctrl+O', category: 'Connections', action: 'open-saved-connections' },
  { id: 'new-query', label: 'New Query Tab', category: 'Editor', action: 'add-query-editor', detail: {} },
  { id: 'execute-query', label: 'Execute Query', shortcut: 'Ctrl+Enter', category: 'Editor', action: 'execute-active-query' },
  { id: 'save-query', label: 'Save Query', shortcut: 'Ctrl+S', category: 'Editor', action: 'save-active-query' },
  { id: 'toggle-ai', label: 'Toggle AI Assistant', category: 'Panels', action: 'ai-assistant-toggle-requested' },
  { id: 'open-profiler', label: 'Open Server Profiler', category: 'Tools', action: 'open-profiler-tab' },
  { id: 'open-sessions', label: 'Open Session Manager', category: 'Tools', action: 'open-session-manager-tab' },
  { id: 'import-tool', label: 'Open Import Tool', shortcut: 'Ctrl+Shift+I', category: 'Tools', action: 'open-modal', detail: { modalType: 'import' } },
  { id: 'export-tool', label: 'Open Export Tool', shortcut: 'Ctrl+Shift+E', category: 'Tools', action: 'open-modal', detail: { modalType: 'export' } },
  { id: 'backup-db', label: 'Backup Database', category: 'Database', action: 'open-modal', detail: { modalType: 'backup' } },
  { id: 'restore-db', label: 'Restore Database', category: 'Database', action: 'open-modal', detail: { modalType: 'restore' } },
  { id: 'create-db', label: 'Create Database', category: 'Database', action: 'open-modal', detail: { modalType: 'database' } },
  { id: 'create-bundle', label: 'Create Bundle', category: 'Database', action: 'open-modal', detail: { modalType: 'bundle' } },
  { id: 'query-history', label: 'Query History', category: 'Tools', action: 'open-query-history' },
];

@customElement('command-palette')
export class CommandPalette extends LitElement {
  @state() private open = false;
  @state() private searchTerm = '';
  @state() private selectedIndex = 0;

  createRenderRoot() {
    return this;
  }

  private get filteredCommands(): PaletteCommand[] {
    if (!this.searchTerm.trim()) return COMMANDS;
    const terms = this.searchTerm.toLowerCase().split(/\s+/);
    return COMMANDS.filter(cmd => {
      const text = `${cmd.label} ${cmd.category}`.toLowerCase();
      return terms.every(t => text.includes(t));
    });
  }

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    // Ctrl+K or Cmd+K to toggle command palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.toggle();
    }
    // Escape to close
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.close();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleGlobalKeyDown);
  }

  toggle() {
    this.open = !this.open;
    if (this.open) {
      this.searchTerm = '';
      this.selectedIndex = 0;
      requestAnimationFrame(() => {
        const input = this.querySelector('#command-palette-input') as HTMLInputElement;
        input?.focus();
      });
    }
  }

  close() {
    this.open = false;
    this.searchTerm = '';
  }

  private handleInputKeyDown(e: KeyboardEvent) {
    const commands = this.filteredCommands;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, commands.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (commands[this.selectedIndex]) {
          this.executeCommand(commands[this.selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  private executeCommand(cmd: PaletteCommand) {
    this.close();
    this.dispatchEvent(new CustomEvent(cmd.action, {
      detail: cmd.detail || {},
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.open) return html``;

    const commands = this.filteredCommands;

    return html`
      <div class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
           @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) this.close(); }}>
        <div class="db-modal-backdrop" @click=${() => this.close()}></div>
        <div class="relative w-[560px] bg-surface-3 rounded-lg shadow-elevation-4 border border-db-border animate-modal-enter overflow-hidden z-10">
          <!-- Search Input -->
          <div class="p-3 border-b border-db-border">
            <input
              id="command-palette-input"
              type="text"
              class="w-full bg-surface-2 text-base-content px-3 py-2 rounded-md border border-db-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm"
              placeholder="Type a command..."
              .value=${this.searchTerm}
              @input=${(e: Event) => { this.searchTerm = (e.target as HTMLInputElement).value; this.selectedIndex = 0; }}
              @keydown=${(e: KeyboardEvent) => this.handleInputKeyDown(e)}
              autocomplete="off"
            />
          </div>
          <!-- Command List -->
          <div class="max-h-80 overflow-y-auto py-1">
            ${commands.length === 0
              ? html`<div class="px-4 py-6 text-center text-feedback-muted text-sm">No matching commands</div>`
              : commands.map((cmd, i) => html`
                <button
                  class="w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors duration-75
                    ${i === this.selectedIndex ? 'bg-accent-subtle text-accent' : 'text-base-content hover:bg-surface-4'}"
                  @click=${() => this.executeCommand(cmd)}
                  @mouseenter=${() => { this.selectedIndex = i; }}
                >
                  <div class="flex items-center gap-3">
                    <span class="text-feedback-muted text-xs w-20">${cmd.category}</span>
                    <span>${cmd.label}</span>
                  </div>
                  ${cmd.shortcut ? html`<span class="db-shortcut-hint">${cmd.shortcut}</span>` : ''}
                </button>
              `)}
          </div>
        </div>
      </div>
    `;
  }
}
