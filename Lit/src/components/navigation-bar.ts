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

    // Close menus when clicking outside
    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        
        // Listen for panel selection changes
        document.addEventListener('panel-selected', (event: Event) => {
            this.handlePanelSelected(event as CustomEvent);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this.handleDocumentClick.bind(this));
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

    private async handleNewDatabase() {
        console.log('Navigation bar: handleNewDatabase called');
        this.dispatchEvent(new CustomEvent('new-database-requested', {
            bubbles: true,
            composed: true
        }));
        console.log('Navigation bar: new-database-requested event dispatched');
        this.handleMenuClose();
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
                    min-height: 2.6rem !important; /* Default is 4rem, reduced by 35% */
                    height: 2.6rem !important;
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
            </style>
            
            <div class="navbar bg-base-100 shadow-md">
                <div class="navbar-start">
                    <div class="dropdown">
                        <div tabindex="0" role="button" class="btn btn-ghost lg:hidden">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
                            </svg>
                        </div>
                       
                    </div>
                    <div class="btn btn-ghost">
                        <img src="/assets/images/logo.png" alt="SyndrDB" class="navbar-brand-logo" />
                    </div>
                

                    


                    <ul class="menu menu-horizontal bg-base-200 [&_li>*]:rounded-none p-0 " style="padding-top: 10px !important;">
                        <li class="relative">
                            <button 
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-base-300"
                                @click=${(e: Event) => this.handleMenuToggle('file', e)}
                            >
                                <i class="fa-solid fa-file"></i>
                                <span>File</span>
                            </button>
                            ${this.openMenu === 'file' ? html`
                                <ul class="absolute top-full left-0 bg-base-100 shadow-lg rounded-b-md p-2 w-32 z-50">
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded" @click=${this.handleFileOpen}>Open</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded" @click=${this.handleFileSave}>Save</a></li>
                                </ul>
                            ` : ''}
                        </li>
                         <li class="relative">
                            <button 
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-base-300"
                                @click=${(e: Event) => this.handleMenuToggle('servers', e)}
                            >
                                <i class="fa-solid fa-server"></i>
                                <span>Servers</span>
                            </button>
                            ${this.openMenu === 'servers' ? html`
                                <ul class="absolute top-full left-0 bg-base-100 shadow-lg rounded-b-md p-2 w-32 z-50">
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">New&nbsp;Connection</a></li>
                                </ul>
                            ` : ''}
                        </li>
                        
                        <li class="relative">
                            <button 
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-base-300"
                                @click=${(e: Event) => this.handleMenuToggle('database', e)}
                            >
                                <i class="fa-solid fa-database"></i>
                                <span>Database</span>
                            </button>
                            ${this.openMenu === 'database' ? html`
                                <ul class="absolute top-full left-0 bg-base-100 shadow-lg rounded-b-md p-2 w-32 z-50">
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded" @click=${this.handleNewDatabase}>New&nbsp;Database</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Backup</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Restore</a></li>
                                </ul>
                            ` : ''}
                        </li>
                        <li class="relative">
                            <button 
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-base-300"
                                @click=${(e: Event) => this.handleMenuToggle('tools', e)}
                            >
                                <i class="fa-solid fa-screwdriver-wrench"></i>
                                <span>Tools</span>
                            </button>
                            ${this.openMenu === 'tools' ? html`
                                <ul class="absolute top-full left-0 bg-base-100 shadow-lg rounded-b-md p-2 w-40 z-50">
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Query Editor</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Profiler</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Importer</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Exporter</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Session Manager</a></li>
                                </ul>
                            ` : ''}
                        </li>
                        <li class="relative">
                            <button 
                                class="flex items-center space-x-1 px-2 py-1 hover:bg-base-300"
                                @click=${(e: Event) => this.handleMenuToggle('settings', e)}
                            >
                                <i class="fa-solid fa-gear"></i>
                                <span>Settings</span>
                            </button>
                            ${this.openMenu === 'settings' ? html`
                                <ul class="absolute top-full left-0 bg-base-100 shadow-lg rounded-b-md p-2 w-32 z-50">
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Updates</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded">Settings</a></li>
                                    <li><a href="#" class="block px-2 py-1 hover:bg-base-200 rounded" @click=${this.handleAboutOpen}>Version</a></li>
                                </ul>
                            ` : ''}
                        </li>
                    </ul>
                    
                </div>
                
               
            </div>
        `;
    }
}
