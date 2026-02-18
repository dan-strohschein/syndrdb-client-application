import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '../code-editor/code-editor.js';
import '../code-editor/suggestion-complete/suggestion-dropdown';
import '../dragndrop/droppable';

import { GraphQLLanguageService } from '../code-editor/graphql-language-service/index.js';
import type { ILanguageService } from '../code-editor/language-service-interface.js';

@customElement('query-editor-tab-container')
export class QueryEditorTabContainer extends LitElement {

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: String })
  public activeTab: 'syndrql' | 'graphql' = 'syndrql';

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

    // Initialize SyndrQL query text with database name if provided
    if (this.databaseName && !this.syndrqlQueryText) {
      this.syndrqlQueryText = `USE "${this.databaseName}";`;
    } else if (!this.syndrqlQueryText) {
      this.syndrqlQueryText = 'USE "<Database_Name>";';
    }

    // Initialize queryText with the active tab's content
    this.queryText = this.activeTab === 'syndrql' ? this.syndrqlQueryText : this.graphqlQueryText;

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

  private handleTabClick(tab: 'syndrql' | 'graphql') {
    if (this.activeTab !== tab) {
      // Save current tab's content before switching
      this.saveCurrentTabContent();

      this.activeTab = tab;

      // Load the content for the new tab
      this.queryText = tab === 'syndrql' ? this.syndrqlQueryText : this.graphqlQueryText;

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
            <code-editor data-placeholder="SyndrQL Editor"></code-editor>
          </div>

          <!-- GraphQL Editor (uses pluggable GraphQL LS) -->
          <div id="graphql-editor" class="h-full absolute inset-0 p-4 ${this.activeTab === 'graphql' ? 'visible z-10' : 'invisible z-0'}">
            <code-editor
              .externalLanguageService=${this.graphqlLanguageService}
              data-placeholder="GraphQL Editor"
            ></code-editor>
          </div>
        </div>

        <!-- Tab Headers (Bottom) -->
        <div class="flex border-t border-base-300 bg-base-50">
          <button
            class="px-3 py-2 border-t-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'syndrql'
                ? 'border-primary text-base-content bg-base-100'
                : 'border-transparent text-base-content opacity-30 hover:text-base-content hover:opacity-100 hover:bg-base-100'
            }"
            @click=${() => this.handleTabClick('syndrql')}
          >
            <i class="fa-solid fa-database mr-1"></i>SyndrQL
          </button>

          <button
            class="px-3 py-2 border-t-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'graphql'
                ? 'border-primary text-base-content bg-base-100'
                : 'border-transparent text-base-content opacity-30 hover:text-base-content hover:opacity-100 hover:bg-base-100'
            }"
            @click=${() => this.handleTabClick('graphql')}
          >
            <i class="fa-solid fa-diagram-project mr-1"></i>GraphQL
          </button>
        </div>
      </div>
    `;
  }
}
