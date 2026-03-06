import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '../code-editor/code-editor.js';
import '../code-editor/suggestion-complete/suggestion-dropdown';
import '../dragndrop/droppable';
import '../schema-diagram/schema-diagram';

import { GraphQLLanguageService } from '../code-editor/graphql-language-service/index.js';
import type { ILanguageService } from '../code-editor/language-service-interface.js';

@customElement('query-editor-tab-container')
export class QueryEditorTabContainer extends LitElement {

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: String })
  public activeTab: 'syndrql' | 'graphql' | 'diagram' = 'syndrql';

  @property({ type: String })
  public connectionId: string = '';

  @property({ type: String })
  public databaseName: string = '';

  @state()
  public queryText: string = '';

  @state()
  private syndrqlQueryText: string = '';

  @state()
  private graphqlQueryText: string = '';

  /** GraphQL language service instance — passed to the GraphQL code-editor. */
  private graphqlLanguageService: ILanguageService | null = null;

  private resizeHandler = () => {
    this.requestUpdate();
  };

  connectedCallback() {
    super.connectedCallback();

    // Create the GraphQL language service
    this.graphqlLanguageService = new GraphQLLanguageService();
    this.graphqlLanguageService.initialize();

    // Set default syndrqlQueryText only if not already set
    if (!this.syndrqlQueryText) {
      if (this.databaseName) {
        this.syndrqlQueryText = `USE "${this.databaseName}";`;
      } else {
        this.syndrqlQueryText = 'USE "<Database_Name>";';
      }
    }

    // Don't overwrite queryText here — let the parent binding set it.
    // The updated() handler will sync queryText → syndrqlQueryText when it arrives.

    window.addEventListener('resize', this.resizeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.resizeHandler);

    if (this.graphqlLanguageService) {
      this.graphqlLanguageService.dispose();
      this.graphqlLanguageService = null;
    }
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    // Handle queryText changes from parent (e.g. "Open in Editor Tab" from export wizard)
    if (changedProperties.has('queryText') && this.queryText) {
      const prev = changedProperties.get('queryText') as string | undefined;
      // Only sync if queryText actually changed and differs from current syndrqlQueryText
      if (this.queryText !== prev && this.queryText !== this.syndrqlQueryText) {
        this.syndrqlQueryText = this.queryText;
        // Push to the code editor if it already exists
        const editor = this.querySelector('#syndrql-editor code-editor') as
          (HTMLElement & { setText?: (text: string) => void }) | null;
        if (editor?.setText) {
          editor.setText(this.queryText);
        }
      }
    }

    // Handle database name changes
    if (changedProperties.has('databaseName') && this.databaseName) {
      if (
        !this.syndrqlQueryText ||
        this.syndrqlQueryText === 'USE "<Database_Name>";' ||
        this.syndrqlQueryText.match(/^USE\s+"[^"]+";?\s*$/)
      ) {
        this.syndrqlQueryText = `USE "${this.databaseName}";`;
        if (this.activeTab === 'syndrql') {
          this.queryText = this.syndrqlQueryText;
        }
      }

      // Forward database context to GraphQL LS
      if (this.graphqlLanguageService) {
        this.graphqlLanguageService.setDatabaseContext(this.databaseName);
      }
    }

    if (changedProperties.has('activeTab')) {
      // Focus the correct editor after tab switch
      setTimeout(() => {
        this.focusActiveEditor();
      }, 0);
    }
  }

  private handleTabClick(tab: 'syndrql' | 'graphql' | 'diagram') {
    if (this.activeTab !== tab) {
      // Save current tab's content before switching
      this.saveCurrentTabContent();

      this.activeTab = tab;

      // Load the content for the new tab (diagram has no text)
      if (tab !== 'diagram') {
        this.queryText = tab === 'syndrql' ? this.syndrqlQueryText : this.graphqlQueryText;
      }

      // Emit tab change event
      this.dispatchEvent(new CustomEvent('tab-changed', {
        detail: {
          activeTab: tab,
          query: this.queryText,
        },
        bubbles: true,
        composed: true,
      }));
    }
  }

  /**
   * Save the current tab's content by reading from the active code-editor.
   */
  private saveCurrentTabContent(): void {
    if (this.activeTab === 'diagram') return; // diagram has no text to save
    if (this.activeTab === 'syndrql') {
      const editor = this.querySelector('#syndrql-editor code-editor') as any;
      if (editor?.getText) {
        this.syndrqlQueryText = editor.getText();
      }
    } else {
      const editor = this.querySelector('#graphql-editor code-editor') as any;
      if (editor?.getText) {
        this.graphqlQueryText = editor.getText();
      }
    }
  }

  /**
   * Focus the active tab's code-editor.
   */
  private focusActiveEditor(): void {
    if (this.activeTab === 'diagram') return; // diagram uses canvas, no text editor focus
    const selector = this.activeTab === 'syndrql' ? '#syndrql-editor code-editor' : '#graphql-editor code-editor';
    const codeEditor = this.querySelector(selector) as any;
    if (codeEditor?.inputCapture) {
      codeEditor.inputCapture.focus();
    }
  }

  /**
   * Forward schema context data to the GraphQL language service.
   * Called externally by query-editor-frame when bundles are loaded.
   */
  public updateGraphQLContext(databases: any[]): void {
    if (this.graphqlLanguageService) {
      this.graphqlLanguageService.updateContextData(databases);
    }
  }

  render() {
    return html`
      <div class="h-full flex flex-col relative">
        <!-- Tab Content -->
        <div class="flex-1 relative">
          <!-- SyndrQL Editor (uses default SyndrQL LS via fallback) -->
          <div id="syndrql-editor" class="h-full absolute inset-0 p-4 ${this.activeTab === 'syndrql' ? 'visible z-10' : 'invisible z-0'}">
            <code-editor .initialText=${this.syndrqlQueryText} data-placeholder="SyndrQL Editor"></code-editor>
          </div>

          <!-- GraphQL Editor (uses pluggable GraphQL LS) -->
          <div id="graphql-editor" class="h-full absolute inset-0 p-4 ${this.activeTab === 'graphql' ? 'visible z-10' : 'invisible z-0'}">
            <code-editor
              .externalLanguageService=${this.graphqlLanguageService}
              data-placeholder="GraphQL Editor"
            ></code-editor>
          </div>

          <!-- Schema Diagram -->
          <div id="diagram-view" class="h-full absolute inset-0 ${this.activeTab === 'diagram' ? 'visible z-10' : 'invisible z-0'}">
            <schema-diagram
              .connectionId=${this.connectionId}
              .databaseName=${this.databaseName}
              .isActive=${this.activeTab === 'diagram'}
            ></schema-diagram>
          </div>
        </div>

        <!-- Tab Headers (Bottom) — same purple gradient underline as main editor tabs -->
        <div class="flex border-t border-base-300 bg-base-50">
          <button
            class="px-3 py-2 border-b-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'syndrql'
                ? 'text-gold-light bg-base-100 db-tab-active-gradient'
                : 'border-transparent text-label-muted hover:text-label hover:bg-base-100'
            }"
            @click=${() => this.handleTabClick('syndrql')}
          >
            <i class="fa-solid fa-database mr-1"></i>SyndrQL
          </button>

          <button
            class="px-3 py-2 border-b-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'graphql'
                ? 'text-gold-light bg-base-100 db-tab-active-gradient'
                : 'border-transparent text-label-muted hover:text-label hover:bg-base-100'
            }"
            @click=${() => this.handleTabClick('graphql')}
          >
            <i class="fa-solid fa-diagram-project mr-1"></i>GraphQL
          </button>

          <button
            class="px-3 py-2 border-b-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'diagram'
                ? 'text-gold-light bg-base-100 db-tab-active-gradient'
                : 'border-transparent text-label-muted hover:text-label hover:bg-base-100'
            }"
            @click=${() => this.handleTabClick('diagram')}
          >
            <i class="fa-solid fa-share-nodes mr-1"></i>Schema
          </button>
        </div>
      </div>
    `;
  }
}
