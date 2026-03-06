import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ElectronAPI } from '../types/electron-api';

@customElement('navigation-bar')
export class NavigationBar extends LitElement {
    @state()
    private openMenu: string | null = null;

    @state()
    private lastSelectedPanel: 'query-editor' | 'query-results' = 'query-editor';

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    private handleMenuToggle(menuName: string, event: Event) {
        event.preventDefault();
        
        // If clicking the same menu that's already open, close it
        if (this.openMenu === menuName) {
            this.openMenu = null;
        } else {
            // Close any open menu and open the new one
            this.openMenu = menuName;
        }
        
        this.requestUpdate();
    }

    private handleMenuClose() {
        this.openMenu = null;
        this.requestUpdate();
    }

    private get modKey(): string {
        return navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';
    }

    private handleGlobalKeydown(event: KeyboardEvent) {
        const isMeta = event.metaKey || event.ctrlKey;

        if (isMeta && event.key === 'n' && !event.shiftKey) {
            event.preventDefault();
            this.handleNewConnection(event);
        } else if (isMeta && event.key === 'o') {
            event.preventDefault();
            this.handleFileOpen();
        } else if (isMeta && event.key === 's') {
            event.preventDefault();
            this.handleFileSave();
        } else if (isMeta && event.shiftKey && event.key === 'P') {
            event.preventDefault();
            this.handleOpenProfiler();
        } else if (isMeta && event.shiftKey && event.key === 'I') {
            event.preventDefault();
            this.handleOpenImporter();
        } else if (isMeta && event.shiftKey && event.key === 'E') {
            event.preventDefault();
            this.handleOpenExporter();
        }
    }

    private handleNewConnection(event: Event) {
        event.preventDefault();
        this.handleMenuClose(); // Close the menu
        
        // Emit event to request connection modal
        this.dispatchEvent(new CustomEvent('new-connection-requested', {
            bubbles: true,
            composed: true
        }));
    }

    // Close menus when clicking outside
    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));

        // Listen for panel selection changes
        document.addEventListener('panel-selected', (event: Event) => {
            this.handlePanelSelected(event as CustomEvent);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this.handleDocumentClick.bind(this));
        document.removeEventListener('keydown', this.handleGlobalKeydown.bind(this));
        document.removeEventListener('panel-selected', (event: Event) => {
            this.handlePanelSelected(event as CustomEvent);
        });
    }

    private handleDocumentClick(event: Event) {
        const target = event.target as Element;
        if (!this.contains(target)) {
            this.handleMenuClose();
        }
    }

    private handlePanelSelected(event: CustomEvent) {
        this.lastSelectedPanel = event.detail.panel;
    }

    private async handleFileOpen() {
        const panelType = this.lastSelectedPanel;
        const title = panelType === 'query-results' ? 'Open Results' : 'Open Query';
        
        try {
            // Check if electronAPI is available
            const electronAPI = window.electronAPI as ElectronAPI;
            if (!electronAPI?.fileDialog) {
                console.warn('File dialog API not available');
                return;
            }

            const filters = panelType === 'query-results'
                ? [
                    { name: 'CSV Files', extensions: ['csv'] },
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                  ]
                : [
                    { name: 'SQL Files', extensions: ['sql'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                  ];

            const result = await electronAPI.fileDialog.showOpenDialog({
                title: title,
                filters: filters
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                console.log('File selected for opening:', filePath);
                
                // Emit event with the selected file path
                this.dispatchEvent(new CustomEvent('file-open-requested', {
                    detail: { 
                        panelType: panelType,
                        title: title,
                        filePath: filePath
                    },
                    bubbles: true,
                    composed: true
                }));
            }
        } catch (error) {
            console.error('Error opening file dialog:', error);
        }
        
        this.handleMenuClose();
    }

    private async handleAboutOpen() {
        console.log('Navigation bar: handleAboutOpen called');
        this.dispatchEvent(new CustomEvent('about-modal-requested', {
            bubbles: true,
            composed: true
        }));
        console.log('Navigation bar: about-modal-requested event dispatched');
        this.handleMenuClose();
    }

    private handleBackupDatabase() {
        this.dispatchEvent(new CustomEvent('backup-database-requested', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleRestoreDatabase() {
        this.dispatchEvent(new CustomEvent('restore-database-requested', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private async handleNewDatabase() {
        console.log('Navigation bar: handleNewDatabase called');
        this.dispatchEvent(new CustomEvent('new-database-requested', {
            bubbles: true,
            composed: true
        }));
        console.log('Navigation bar: new-database-requested event dispatched');
        this.handleMenuClose();
    }

    private handleAIAssistantToggle() {
        this.dispatchEvent(new CustomEvent('ai-assistant-toggle-requested', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleOpenProfiler() {
        this.dispatchEvent(new CustomEvent('open-profiler-tab', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleOpenSessionManager() {
        this.dispatchEvent(new CustomEvent('open-session-manager-tab', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleOpenImporter() {
        this.dispatchEvent(new CustomEvent('import-wizard-requested', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleOpenExporter() {
        this.dispatchEvent(new CustomEvent('export-wizard-requested', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleOpenQueryHistory() {
        this.dispatchEvent(new CustomEvent('open-query-history', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleEditCommand(command: string) {
        this.dispatchEvent(new CustomEvent('edit-command', {
            detail: { command },
            bubbles: true,
            composed: true,
        }));
        this.handleMenuClose();
    }

    private handleOpenSchemaDiagram() {
        this.dispatchEvent(new CustomEvent('open-schema-diagram', {
            bubbles: true,
            composed: true
        }));
        this.handleMenuClose();
    }

    private handleExit() {
        this.handleMenuClose();
        window.close();
    }

    private async handleFileSave() {
        const panelType = this.lastSelectedPanel;
        const title = panelType === 'query-results' ? 'Save Results' : 'Save Query';
        
        try {
            // Check if electronAPI is available
            const electronAPI = window.electronAPI as ElectronAPI;
            if (!electronAPI?.fileDialog) {
                console.warn('File dialog API not available');
                return;
            }

            const filters = panelType === 'query-results'
                ? [
                    { name: 'CSV Files', extensions: ['csv'] },
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                  ]
                : [
                    { name: 'SQL Files', extensions: ['sql'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                  ];

            const result = await electronAPI.fileDialog.showSaveDialog({
                title: title,
                filters: filters
            });

            if (!result.canceled && result.filePath) {
                console.log('File selected for saving:', result.filePath);
                
                // Emit event with the selected file path
                this.dispatchEvent(new CustomEvent('file-save-requested', {
                    detail: { 
                        panelType: panelType,
                        title: title,
                        filePath: result.filePath
                    },
                    bubbles: true,
                    composed: true
                }));
            }
        } catch (error) {
            console.error('Error opening save dialog:', error);
        }
        
        this.handleMenuClose();
    }

    render() {
        return html`
            <style>
                /* Reset navbar to eliminate negative space and reduce height by 35% */
                navigation-bar .navbar {
                    min-height: 2.8rem !important;
                    height: 2.8rem !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    box-sizing: border-box;
                }
                
                /* Remove padding/margin from navbar sections */
                navigation-bar .navbar-start,
                navigation-bar .navbar-center,
                navigation-bar .navbar-end {
                    padding: 0 !important;
                    margin: 0 !important;
                    height: 100%;
                    align-items: center;
                }
                
                navigation-bar .navbar-start {
                    display: inline-flex;
                    align-items: center;
                    width: fit-content;
                    justify-content: flex-start;
                }

                /* Compact menu items to fit reduced height */
                navigation-bar .menu-horizontal {
                    padding: 0 !important;
                    margin: 0 !important;
                    height: 100%;
                }

                navigation-bar .menu-horizontal > ul {
                    width: fit-content;
                }
                
                navigation-bar .menu-horizontal > li {
                    margin: 0 !important;
                    height: 100%;
                    display: flex;
                    align-items: center;
                }
                
                navigation-bar .menu-horizontal > li > a,
                navigation-bar .menu-horizontal > li > details > summary {
                    padding: 0.3rem 0.6rem !important; /* Reduced padding to fit smaller height */
                    margin: 0 !important;
                    height: auto;
                    line-height: 1.2;
                    font-size: 0.95rem; /* Increased from 0.875rem for better readability */
                }

                /* Style for our custom menu buttons */
                navigation-bar .menu-horizontal > li > button {
                    padding: 0.4rem 0.8rem !important;
                    margin: 0 !important;
                    height: auto;
                    line-height: 1.2;
                    font-size: 0.95rem; /* Same size as other menu items */
                    font-weight: 500;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                }
                
                /* Compact buttons */
                navigation-bar .btn {
                    min-height: 2.2rem !important;
                    height: 2.2rem !important;
                    padding: 0.2rem 0.5rem !important;
                    margin: 0 !important;
                }

                navigation-bar .navbar-menu-compact {
                    padding-top: 0.5em !important;
                }

                /* Ensure dropdowns still work properly */
                navigation-bar .menu-horizontal > li > details > ul {
                    padding: 0.25rem !important;
                    margin-top: 0.1rem;
                }
                
                navigation-bar .menu-horizontal > li > details > ul > li > a {
                    padding: 0.3rem 0.6rem !important;
                    font-size: 0.95rem; /* Increased from 0.875rem */
                }

                /* Style for dropdown menu items in our custom implementation */
                navigation-bar ul.absolute a {
                    font-size: 0.95rem !important;
                    padding: 0.4rem 0.6rem !important;
                }
                
                /* Logo styling to fit compact navbar */
                navigation-bar .navbar-brand-logo {
                    height: 2rem !important;
                    width: auto;
                    max-height: 2rem;
                    object-fit: contain;
                }
                navigation-bar animated-logo {
                    display: inline-block;
                }
            </style>
            
            <div class="navbar shadow-md border-b border-db-border" style="background: linear-gradient(180deg, #1a1a1a, #121212)">
                <div class="navbar-start">
                    <div class="dropdown">
                        <div tabindex="0" role="button" class="btn btn-ghost lg:hidden">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
                            </svg>
                        </div>
                       
                    </div>
                    <div class="btn btn-ghost flex items-center">
                        <animated-logo></animated-logo>
                    </div>
                

                    


                    <ul class="menu menu-horizontal bg-surface-1 [&_li>*]:rounded-none p-0 " style="padding-top: 10px !important;">
                        <li class="relative">
                            <button
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-surface-3"
                                @click=${(e: Event) => this.handleMenuToggle('file', e)}
                            >
                                <i class="fa-solid fa-file text-blue-400"></i>
                                <span>File</span>
                            </button>
                            ${this.openMenu === 'file' ? html`
                                <ul class="absolute top-full left-0 bg-surface-4 shadow-elevation-3 rounded-lg p-1 w-52 z-50 animate-context-menu-enter border border-db-border">
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleFileOpen}><span><i class="fa-solid fa-folder-open mr-2 text-xs text-yellow-400"></i>Open</span><span class="db-shortcut-hint">${this.modKey}+O</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleFileSave}><span><i class="fa-solid fa-floppy-disk mr-2 text-xs text-blue-400"></i>Save</span><span class="db-shortcut-hint">${this.modKey}+S</span></a></li>
                                    <li class="border-t border-db-border/30 my-1" aria-hidden="true"></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleExit}><span><i class="fa-solid fa-right-from-bracket mr-2 text-xs text-red-400"></i>Exit</span></a></li>
                                </ul>
                            ` : ''}
                        </li>
                        <li class="relative">
                            <button
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-surface-3"
                                @click=${(e: Event) => this.handleMenuToggle('edit', e)}
                            >
                                <i class="fa-solid fa-pen-to-square text-amber-400"></i>
                                <span>Edit</span>
                            </button>
                            ${this.openMenu === 'edit' ? html`
                                <ul class="absolute top-full left-0 bg-surface-4 shadow-elevation-3 rounded-lg p-1 w-56 z-50 animate-context-menu-enter border border-db-border">
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${() => this.handleEditCommand('undo')}><span><i class="fa-solid fa-rotate-left mr-2 text-xs text-orange-400"></i>Undo</span><span class="db-shortcut-hint">${this.modKey}+Z</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${() => this.handleEditCommand('redo')}><span><i class="fa-solid fa-rotate-right mr-2 text-xs text-green-400"></i>Redo</span><span class="db-shortcut-hint">${this.modKey}+Shift+Z</span></a></li>
                                    <li class="border-t border-db-border/30 my-1" aria-hidden="true"></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${() => this.handleEditCommand('cut')}><span><i class="fa-solid fa-scissors mr-2 text-xs text-red-400"></i>Cut</span><span class="db-shortcut-hint">${this.modKey}+X</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${() => this.handleEditCommand('copy')}><span><i class="fa-solid fa-copy mr-2 text-xs text-blue-400"></i>Copy</span><span class="db-shortcut-hint">${this.modKey}+C</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${() => this.handleEditCommand('paste')}><span><i class="fa-solid fa-paste mr-2 text-xs text-emerald-400"></i>Paste</span><span class="db-shortcut-hint">${this.modKey}+V</span></a></li>
                                    <li class="border-t border-db-border/30 my-1" aria-hidden="true"></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${() => this.handleEditCommand('toggleComment')}><span><i class="fa-solid fa-slash mr-2 text-xs text-violet-400"></i>Toggle Comment</span><span class="db-shortcut-hint">${this.modKey}+/</span></a></li>
                                </ul>
                            ` : ''}
                        </li>
                         <li class="relative">
                            <button
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-surface-3"
                                @click=${(e: Event) => this.handleMenuToggle('servers', e)}
                            >
                                <i class="fa-solid fa-server text-emerald-400"></i>
                                <span>Servers</span>
                            </button>
                            ${this.openMenu === 'servers' ? html`
                                <ul class="absolute top-full left-0 bg-surface-4 shadow-elevation-3 rounded-lg p-1 w-52 z-50 animate-context-menu-enter border border-db-border">
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleNewConnection}><span><i class="fa-solid fa-plug mr-2 text-xs text-green-400"></i>New&nbsp;Connection</span><span class="db-shortcut-hint">${this.modKey}+N</span></a></li>
                                </ul>
                            ` : ''}
                        </li>

                        <li class="relative">
                            <button
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-surface-3"
                                @click=${(e: Event) => this.handleMenuToggle('database', e)}
                            >
                                <i class="fa-solid fa-database text-cyan-400"></i>
                                <span>Database</span>
                            </button>
                            ${this.openMenu === 'database' ? html`
                                <ul class="absolute top-full left-0 bg-surface-4 shadow-elevation-3 rounded-lg p-1 w-52 z-50 animate-context-menu-enter border border-db-border">
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleNewDatabase}><span><i class="fa-solid fa-circle-plus mr-2 text-xs text-green-400"></i>New&nbsp;Database</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleBackupDatabase}><span><i class="fa-solid fa-box-archive mr-2 text-xs text-amber-400"></i>Backup</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleRestoreDatabase}><span><i class="fa-solid fa-rotate-left mr-2 text-xs text-sky-400"></i>Restore</span></a></li>
                                </ul>
                            ` : ''}
                        </li>
                        <li class="border-r border-db-border/30 h-4 self-center mx-1" aria-hidden="true"></li>
                        <li class="relative">
                            <button
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-surface-3"
                                @click=${(e: Event) => this.handleMenuToggle('tools', e)}
                            >
                                <i class="fa-solid fa-screwdriver-wrench text-orange-400"></i>
                                <span>Tools</span>
                            </button>
                            ${this.openMenu === 'tools' ? html`
                                <ul class="absolute top-full left-0 bg-surface-4 shadow-elevation-3 rounded-lg p-1 w-56 z-50 animate-context-menu-enter border border-db-border">
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300"><span><i class="fa-solid fa-terminal mr-2 text-xs text-green-400"></i>Query Editor</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleOpenSchemaDiagram}><span><i class="fa-solid fa-share-nodes mr-2 text-xs text-indigo-400"></i>Schema Diagram</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleOpenProfiler}><span><i class="fa-solid fa-gauge-high mr-2 text-xs text-rose-400"></i>Profiler</span><span class="db-shortcut-hint">${this.modKey}+Shift+P</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleOpenImporter}><span><i class="fa-solid fa-file-import mr-2 text-xs text-cyan-400"></i>Importer</span><span class="db-shortcut-hint">${this.modKey}+Shift+I</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleOpenExporter}><span><i class="fa-solid fa-file-export mr-2 text-xs text-teal-400"></i>Exporter</span><span class="db-shortcut-hint">${this.modKey}+Shift+E</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleOpenSessionManager}><span><i class="fa-solid fa-users mr-2 text-xs text-purple-400"></i>Session Manager</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleOpenQueryHistory}><span><i class="fa-solid fa-clock-rotate-left mr-2 text-xs text-amber-400"></i>Query History</span></a></li>
                                </ul>
                            ` : ''}
                        </li>
                        <li class="border-r border-db-border/30 h-4 self-center mx-1" aria-hidden="true"></li>
                        <li class="relative">
                            <button
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-surface-3"
                                @click=${(e: Event) => this.handleMenuToggle('settings', e)}
                            >
                                <i class="fa-solid fa-gear text-gray-400"></i>
                                <span>Settings</span>
                            </button>
                            ${this.openMenu === 'settings' ? html`
                                <ul class="absolute top-full left-0 bg-surface-4 shadow-elevation-3 rounded-lg p-1 w-52 z-50 animate-context-menu-enter border border-db-border">
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300"><span><i class="fa-solid fa-arrows-rotate mr-2 text-xs text-sky-400"></i>Updates</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300"><span><i class="fa-solid fa-sliders mr-2 text-xs text-violet-400"></i>Settings</span></a></li>
                                    <li><a href="#" class="flex items-center justify-between px-2 py-1.5 hover:bg-accent-subtle hover:text-white rounded transition-colors duration-100 text-gray-300" @click=${this.handleAboutOpen}><span><i class="fa-solid fa-circle-info mr-2 text-xs text-blue-400"></i>Version</span></a></li>
                                </ul>
                            ` : ''}
                        </li>
                        <li>
                            <button
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-surface-3"
                                title="Open AI Assistant"
                                @click=${this.handleAIAssistantToggle}
                            >
                                <i class="fa-solid fa-wand-magic-sparkles text-violet-400"></i>
                                <span>AI</span>
                            </button>
                        </li>
                    </ul>
                    
                </div>
                
               
            </div>
        `;
    }
}
