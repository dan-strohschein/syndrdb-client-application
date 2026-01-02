import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '../code-editor/suggestion-complete/suggestion-dropdown';
import '../dragndrop/droppable';

import { text } from 'stream/consumers';

@customElement('query-editor-tab-container')
export class QueryEditorTabContainer extends LitElement {

  static styles = css`
    .custom-textarea {
      border: 1px solid #6b7280 !important; /* Dark grey border */
      border-radius: 0.375rem;
      padding: 0.75rem;
      background-color: transparent;
      color: inherit;
      outline: none !important;
      box-shadow: none !important;
      transition: border-color 0.2s ease-in-out;
    }
    
    .custom-textarea:focus {
      border-color: white !important;
      box-shadow: none !important;
      outline: none !important;
    }
    
    .custom-textarea:focus-visible {
      outline: none !important;
      box-shadow: none !important;
    }
  `;

  // Disable Shadow DOM to allow global Tailwind CSS but inject our custom styles
  createRenderRoot() {
    // Add custom styles to document head
    if (!document.querySelector('#query-editor-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'query-editor-custom-styles';
      style.textContent = `
        .custom-editor {
          border: 1px solid #6b7280 !important;
          border-radius: 0.375rem;
          padding: 0.75rem;
          background-color: transparent;
          color: inherit;
          outline: none !important;
          box-shadow: none !important;
          transition: border-color 0.2s ease-in-out;
          min-height: 100%;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-y: auto;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
        }
        
        .custom-editor:focus {
          border-color: white !important;
          box-shadow: none !important;
          outline: none !important;
        }
        
        .custom-editor:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }

        .custom-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }

        /* Syntax Highlighting Styles */
        .syndrql-keyword { color: #569cd6; font-weight: bold; }
        .syndrql-identifier { color: #9cdcfe; }
        .syndrql-literal { color: #ce9178; }
        .syndrql-operator { color: #d4d4d4; }
        .syndrql-punctuation { color: #d4d4d4; }
        .syndrql-comment { color: #6a9955; font-style: italic; }
        .syndrql-ddl { color: #c586c0; } /* DDL keywords - purple */
        .syndrql-dql { color: #4ec9b0; } /* DQL keywords - teal */
        .syndrql-dml { color: #ffcb6b; } /* DML keywords - yellow */
        .syndrql-objects { color: #82aaff; } /* Database objects - light blue */
        .syndrql-fields { color: #f78c6c; } /* Field keywords - orange */
        .syndrql-control { color: #c792ea; } /* Control flow - light purple */
        .syndrql-security { color: #ff5370; } /* Security keywords - red */
        .syndrql-system { color: #89ddff; } /* System commands - cyan */
        .syndrql-operators { color: #89ddff; } /* Operators - cyan */
        .syndrql-reserved { text-decoration: underline; }
        .syndrql-literal_string { color: #ce9178; }
        .syndrql-literal_number { color: #b5cea8; }
        .syndrql-literal_boolean { color: #569cd6; }
        .syndrql-comment_single { color: #6a9955; }
        .syndrql-comment_multi { color: #6a9955; opacity: 0.8; }
        .syndrql-identifier_quoted { color: #9cdcfe; font-style: italic; }
        .syndrql-identifier_unquoted { color: #9cdcfe; }
      `;
      document.head.appendChild(style);
    }
    return this;
  }
    
  @property({ type: String })
  public activeTab: 'syndrql' | 'graphql' | 'new-editor' = 'syndrql';
  
  @property({ type: String })
  public databaseName: string = '';
  
  @state()
  public queryText: string = '';

  @state()
  private syndrqlQueryText: string = '';

  @state()
  private graphqlQueryText: string = '';

  //private tokenizer: SyndrQLTokenizer = new SyndrQLTokenizer();
  private editorRef: HTMLElement | null = null;
  private currentCursorPosition: number = 0;
  
  // Syntax highlighting state
  //private currentTokens: ClassifiedToken[] = [];
  private lastHighlightedText: string = '';
  private isHighlighting: boolean = false;
  private highlightingTimeout: number | null = null;
  private lastInputTime: number = 0;

  private resizeHandler = () => {
    // Force re-render when resize occurs
    this.requestUpdate();
  };

  connectedCallback() {
    super.connectedCallback();
    // Initialize SyndrQL query text with database name if provided
    if (this.databaseName && !this.syndrqlQueryText) {
      this.syndrqlQueryText = `USE "${this.databaseName}";`;
    } else if (!this.syndrqlQueryText) {
      this.syndrqlQueryText = 'USE "<Database_Name>";';
    }
    // Initialize queryText with the active tab's content
    this.queryText = this.activeTab === 'syndrql' ? this.syndrqlQueryText : this.graphqlQueryText;
    // Listen for window resize events
    window.addEventListener('resize', this.resizeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up resize listener
    window.removeEventListener('resize', this.resizeHandler);
    
    // Clean up highlighting timeout
    if (this.highlightingTimeout) {
      clearTimeout(this.highlightingTimeout);
      this.highlightingTimeout = null;
    }
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    
    // Handle database name changes
    if (changedProperties.has('databaseName') && this.databaseName) {
      // Update SyndrQL query text only if it's still the default/empty
      if (!this.syndrqlQueryText || this.syndrqlQueryText === 'USE "<Database_Name>";' || this.syndrqlQueryText.match(/^USE\s+"[^"]+";?\s*$/)) {
        this.syndrqlQueryText = `USE "${this.databaseName}";`;
        // Update main query text if SyndrQL tab is active
        if (this.activeTab === 'syndrql') {
          this.queryText = this.syndrqlQueryText;
        }
      }
    }
    
    // If any properties changed, ensure proper layout recalculation
    if (changedProperties.has('activeTab') || changedProperties.has('queryText')) {
      // Small timeout to ensure DOM is updated
      setTimeout(() => {
        this.requestUpdate();
        
        // Reconfigure after tab switch
        if (changedProperties.has('activeTab')) {
         // console.log('TAB SWITCHED - reconfiguring contenteditable behavior');
          this.configureContentEditableBehavior();
        }
      }, 0);
    }
  }

  // DEPRECATED: This function is for the old contenteditable-based editor
  firstUpdated() {
   
  }

  // DEPRECATED: This function is for the old contenteditable-based editor
  private configureContentEditableBehavior() {
   
  }

  

  

  // DEPRECATED: This function is for the old contenteditable-based editor
  private handleQueryChange(event: Event) {
   
  }

  private handleTabClick(tab: 'syndrql' | 'graphql' | 'new-editor') {
    if (this.activeTab !== tab) {
      // Save current tab's content before switching
      if (this.activeTab === 'syndrql') {
        this.syndrqlQueryText = this.queryText;
      } else {
        this.graphqlQueryText = this.queryText;
      }
      
      this.activeTab = tab;
      
      // Load the content for the new tab
      const newTabQueryText = tab === 'syndrql' || tab === 'new-editor' ? this.syndrqlQueryText : this.graphqlQueryText;
      this.queryText = newTabQueryText;
      
      // Update editor reference when tab changes
      setTimeout(() => {
        // let editorSelector = '';
        
       
        const editorSelector = tab === 'syndrql' 
          ? '.custom-editor[data-placeholder*="SyndrQL"]'
          : '.custom-editor[data-placeholder*="GraphQL"]';
        
        const editor = this.querySelector(editorSelector) as HTMLElement;
        if (editor) {
          this.editorRef = editor;
          // Ensure editor has the correct content for this tab
          if (editor.textContent !== newTabQueryText) {
            editor.textContent = newTabQueryText;
          }
          
         
          // Focus the new editor
          editor.focus();
        }
        
        // Special handling for the new code-editor component
        if (tab === 'syndrql') {
          
          const codeEditor = this.querySelector('code-editor') as any;
          
          if (codeEditor && codeEditor.inputCapture) {
            // Focus the canvas-based editor using its InputCapture system
            codeEditor.inputCapture.focus();
          }
        }
      }, 0);
      
      // Emit tab change event
      this.dispatchEvent(new CustomEvent('tab-changed', {
        detail: {
          activeTab: tab,
          query: this.queryText
        },
        bubbles: true,
        composed: true
      }));
    }
  }

  // DEPRECATED: This function is for the old contenteditable-based editor
  private handleTextDrop = (event: CustomEvent) => {
    
  }

  render() {
    return html`
      <div class="h-full flex flex-col relative">
        <!-- Tab Content -->
        <div class="flex-1 relative">
         
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'syndrql' ? 'visible z-10' : 'invisible z-0'}">
           <code-editor data-placeholder="New Editor"></code-editor>
          </div>

          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'graphql' ? 'visible z-10' : 'invisible z-0'}">
            <div 
              class="custom-editor w-full h-full font-mono resize-none"
              contenteditable="true"
              data-placeholder="Enter your GraphQL query..."
              @input=${this.handleQueryChange}
            ></div>
          </div>

         
        </div>
        
        <!-- Tab Headers (Bottom) -->
        <div class="flex border-t border-base-300 bg-base-50">
         <button
          class="px-3 py-2 border-t-2 font-medium text-xs transition-colors duration-200 
          ${
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