import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('app-toolbar')
export class AppToolbar extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property()
  activeTool: string = '';

  private get modKey(): string {
    return navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl';
  }

  private dispatch(eventName: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail: detail || {},
      bubbles: true,
      composed: true,
    }));
  }

  private btnClass(key: string, baseHoverColor = 'hover:text-white'): string {
    if (this.activeTool === key) {
      return `w-9 h-9 flex items-center justify-center rounded bg-accent-subtle text-accent border-l-2 border-l-accent transition-colors tooltip tooltip-right`;
    }
    return `w-9 h-9 flex items-center justify-center rounded hover:bg-surface-3 text-feedback-muted ${baseHoverColor} transition-colors tooltip tooltip-right`;
  }

  render() {
    return html`
      <div class="w-12 h-full flex flex-col items-center py-2 gap-1 bg-surface-0 border-r border-db-border flex-shrink-0">
        <!-- Top group: primary actions -->
        <button
          class="${this.btnClass('connections')}"
          data-tip="Connections (${this.modKey}+N)"
          @click=${() => this.dispatch('open-connection-modal')}
        >
          <i class="fa-solid fa-plug text-sm"></i>
        </button>
        <button
          class="${this.btnClass('new-query')}"
          data-tip="New Query Tab"
          @click=${() => this.dispatch('add-query-editor')}
        >
          <i class="fa-solid fa-file-code text-sm"></i>
        </button>
        <button
          class="${this.btnClass('execute', 'hover:text-feedback-success')}"
          data-tip="Execute Query (${this.modKey}+Enter)"
          @click=${() => this.dispatch('execute-active-query')}
        >
          <i class="fa-solid fa-play text-sm"></i>
        </button>

        <!-- Separator -->
        <div class="w-6 h-px bg-db-border/40 my-1"></div>

        <button
          class="${this.btnClass('history')}"
          data-tip="Query History"
          @click=${() => this.dispatch('open-query-history')}
        >
          <i class="fa-solid fa-clock-rotate-left text-sm"></i>
        </button>
        <button
          class="${this.btnClass('ai-assistant')}"
          data-tip="Toggle AI Assistant"
          @click=${() => this.dispatch('ai-assistant-toggle-requested')}
        >
          <i class="fa-solid fa-robot text-sm"></i>
        </button>

        <!-- Spacer pushes bottom items down -->
        <div class="flex-1"></div>

        <!-- Bottom group: utilities -->
        <button
          class="${this.btnClass('command-palette')}"
          data-tip="Command Palette (${this.modKey}+K)"
          @click=${() => {
            const palette = document.querySelector('command-palette') as any;
            palette?.toggle();
          }}
        >
          <i class="fa-solid fa-terminal text-sm"></i>
        </button>
        <button
          class="${this.btnClass('settings')}"
          data-tip="Settings"
          @click=${() => this.dispatch('open-settings')}
        >
          <i class="fa-solid fa-gear text-sm"></i>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-toolbar': AppToolbar;
  }
}
