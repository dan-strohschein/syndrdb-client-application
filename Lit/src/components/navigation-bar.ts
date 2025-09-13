import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('navigation-bar')
export class NavigationBar extends LitElement {
    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
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
                
                /* Compact menu items to fit reduced height */
                navigation-bar .menu-horizontal {
                    padding: 0 !important;
                    margin: 0 !important;
                    height: 100%;
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
                    font-size: 0.875rem; /* Slightly smaller text */
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
                    font-size: 0.875rem;
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
                

                    


                    <ul class="menu menu-horizontal menu-xs bg-base-200 [&_li>*]:rounded-none p-0 " style="padding-top: 10px !important;">
                        <li>
                            
                             <details>
                               <summary><i class="fa-solid fa-file"></i> File</summary>
                                <ul class="bg-base-100 rounded-t-none p-2 w-full">
                                    <li><a>Open</a></li>
                                    <li><a>Save</a></li>
                                </ul>
                            </details>
                        </li>
                        <li>
                         
                           <details>
                               <summary><i class="fa-solid fa-database"></i> Database</summary>
                                <ul class="bg-base-100 rounded-t-none p-2 w-full">
                                    <li><a>Backup</a></li>
                                    <li><a>Restore</a></li>
                                </ul>
                            </details>
                        </li>
                        <li>
                            <details>
                               <summary><i class="fa-solid fa-screwdriver-wrench"></i> Tools</summary>
                                <ul class="bg-base-100 rounded-t-none p-2" style="width: 145px;">
                                    <li><a>Query Editor</a></li>
                                    <li><a>Profiler</a></li>
                                    <li><a>Importer</a></li>
                                    <li><a>Exporter</a></li>
                                    <li><a>Session Manager</a></li>
                                    
                                </ul>
                            </details>
                           
                        </li>
                        <li>
                         <details>
                               <summary><i class="fa-solid fa-gear"></i> Settings</summary>
                                <ul class="bg-base-100 rounded-t-none p-2 w-fit">
                                    <li><a>Updates</a></li>
                                    <li><a>Settings</a></li>
                                    <li><a>Version</a></li>
                                </ul>
                            </details>
                           <a></a>
                        </li>
                    </ul>
                    
                </div>
                
                <div class="navbar-end">
                    <div class="btn btn-ghost btn-circle">
                       
                    </div>
                </div>
            </div>
        `;
    }
}
