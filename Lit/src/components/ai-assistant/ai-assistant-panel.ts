/**
 * AI Assistant Panel — natural language to SyndrQL. Collapsible panel in query editor frame.
 */

import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { AIAssistantService, type AIGenerateResult } from '../../services/ai-assistant-service.js';

@customElement('ai-assistant-panel')
export class AIAssistantPanel extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Object })
  schemaContext: unknown = undefined;

  @property({ type: String })
  currentDatabase = '';

  @property({ type: String })
  endpoint = '';

  @property({ type: Number })
  requestTimeout = 30000;

  /** When true (e.g. right-side rail), hide the collapsible header and always show content. */
  @property({ type: Boolean })
  hideHeader = false;

  @state()
  private prompt = '';

  @state()
  private loading = false;

  @state()
  private result: AIGenerateResult | null = null;

  @state()
  private collapsed = false;

  private async handleSubmit() {
    const trimmed = this.prompt.trim();
    if (!trimmed) return;
    this.loading = true;
    this.result = null;
    try {
      const res = await AIAssistantService.getInstance().generate(
        trimmed,
        this.schemaContext ?? {},
        this.currentDatabase,
        this.endpoint || undefined,
        this.requestTimeout
      );
      this.result = res;
    } catch (err) {
      this.result = {
        syndrql: '',
        valid: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    } finally {
      this.loading = false;
    }
  }

  private handleInsert() {
    if (!this.result?.syndrql) return;
    this.dispatchEvent(
      new CustomEvent('ai-query-insert-requested', {
        detail: { syndrql: this.result.syndrql },
        bubbles: true,
        composed: true
      })
    );
  }

  private handleCopy() {
    if (!this.result?.syndrql) return;
    navigator.clipboard.writeText(this.result.syndrql);
  }

  private handleRetry() {
    this.result = null;
    this.handleSubmit();
  }

  render() {
    const showContent = this.hideHeader || !this.collapsed;
    return html`
      <div class="${this.hideHeader ? '' : 'border border-base-300 rounded-lg bg-base-200/50 overflow-hidden'}">
        ${this.hideHeader ? '' : html`
        <button
          type="button"
          class="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-base-content hover:bg-base-300/50"
          @click=${() => (this.collapsed = !this.collapsed)}
        >
          <span>AI Assistant</span>
          <span class="text-base-content/70">${this.collapsed ? '▼' : '▲'}</span>
        </button>
        `}
        ${showContent ? html`
              <div class="p-3 space-y-3 ${this.hideHeader ? '' : 'border-t border-base-300'}">
                <div>
                  <label class="block text-xs font-medium text-base-content/70 mb-1">Describe what you want in SyndrQL</label>
                  <textarea
                    class="textarea textarea-bordered textarea-sm w-full min-h-[80px] font-mono text-sm"
                    placeholder="e.g. Find all users where email ends with @example.com"
                    .value=${this.prompt}
                    @input=${(e: Event) => (this.prompt = (e.target as HTMLTextAreaElement).value)}
                    ?disabled=${this.loading}
                  ></textarea>
                </div>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  @click=${this.handleSubmit}
                  ?disabled=${this.loading || !this.prompt.trim()}
                >
                  ${this.loading ? 'Generating…' : 'Generate'}
                </button>

                ${this.result
                  ? html`
                      <div class="space-y-2">
                        ${this.result.error
                          ? html`
                              <div class="text-error text-sm">${this.result.error}</div>
                              <button type="button" class="btn btn-sm btn-ghost" @click=${this.handleRetry}>Retry</button>
                            `
                          : html`
                              <div>
                                <div class="text-xs font-medium text-base-content/70 mb-1">Generated SyndrQL</div>
                                <pre class="bg-base-300 rounded p-2 text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap"><code>${this.result.syndrql}</code></pre>
                              </div>
                              ${this.result.explanation
                                ? html`<p class="text-xs text-base-content/70">${this.result.explanation}</p>`
                                : ''}
                              <div class="flex items-center gap-2">
                                ${this.result.valid
                                  ? html`<span class="text-success text-xs">✓ Valid</span>`
                                  : html`
                                      <span class="text-error text-xs">Errors:</span>
                                      <ul class="text-xs text-error list-disc list-inside">
                                        ${(this.result.errors ?? []).map((e) => html`<li>${e.message}</li>`)}
                                      </ul>
                                    `}
                              </div>
                              <div class="flex gap-2">
                                <button type="button" class="btn btn-sm btn-primary" @click=${this.handleInsert}>
                                  Insert into Editor
                                </button>
                                <button type="button" class="btn btn-sm btn-ghost" @click=${this.handleCopy}>
                                  Copy
                                </button>
                                <button type="button" class="btn btn-sm btn-ghost" @click=${this.handleRetry}>
                                  Retry
                                </button>
                              </div>
                            `}
                      </div>
                    `
                  : ''}
              </div>
            ` : ''}
      </div>
    `;
  }
}
