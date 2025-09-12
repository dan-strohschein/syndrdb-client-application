import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Connection, BundleDetails } from '../services/connection-manager';

@customElement('connection-tree')
export class ConnectionTree extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: Array })
  connections: Connection[] = [];

  @state()
  private expandedNodes: Set<string> = new Set();

  private toggleNode(nodeId: string) {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }
    this.requestUpdate();
  }

  private isExpanded(nodeId: string): boolean {
    return this.expandedNodes.has(nodeId);
  }

  private async handleDatabaseClick(connection: Connection, database: string, bundlesNodeId: string) {
    // Toggle the bundles node for this specific database
    this.toggleNode(bundlesNodeId);
    
    // If expanding and bundles data is not loaded, fetch it
    if (this.isExpanded(bundlesNodeId) && (!connection.bundles || connection.bundles.length === 0)) {
      try {
        console.log(`🔍 Fetching bundles for database: ${database}`);
        
        // Import the connection manager
        const { connectionManager } = await import('../services/connection-manager');
        
        // Execute SHOW BUNDLES; query
        const result = await connectionManager.executeQuery('SHOW BUNDLES;');
        console.log('📦 Bundles query result:', result);
        
        // The result should contain bundle data, update the connection
        if (result.success && result.data) {
          // Check if data has Result property or is already an array
          const bundlesData = (result.data as any)?.Result || result.data;
          if (Array.isArray(bundlesData)) {
            // Extract bundle names from the bundle objects
            connection.bundles = bundlesData.map((bundle: any) => {
              // If it's an object with Name property, extract the name
              if (typeof bundle === 'object' && bundle.Name) {
                return bundle.Name;
              }
              // Otherwise treat it as a string
              return typeof bundle === 'string' ? bundle : String(bundle);
            });
            this.requestUpdate();
          }
        }
      } catch (error) {
        console.error('❌ Error fetching bundles:', error);
      }
    }
  }

  private async handleConnectionClick(connection: Connection) {
    // Connection click just toggles visibility - databases are loaded automatically after connection
    // No need to execute SHOW DATABASES here since it's done automatically in connection manager
    console.log(`� Connection clicked: ${connection.name}, databases already loaded: ${connection.databases?.length || 0} databases`);
  }

  private renderConnection(connection: Connection) {
    const statusColors = {
      'connected': 'badge-success',
      'disconnected': 'badge-error',
      'connecting': 'badge-warning',
      'error': 'badge-error'
    };
    
    const statusColor = statusColors[connection.status] || 'badge-error';
    const databasesNodeId = `${connection.id}-databases`;
    
    return html`
      <div class="mb-2">
        <!-- Connection Header -->
        <div class="flex items-center justify-between p-2 rounded hover:bg-base-300 cursor-pointer"
             @click=${() => this.handleConnectionClick(connection)}>
          <div class="flex items-center">
            <div class="badge ${statusColor} badge-xs mr-3"></div>
            <span class="font-medium text-base-content">${connection.name}</span>
          </div>
          
          <!-- Connection Actions -->
          <div class="flex gap-1" @click=${(e: Event) => e.stopPropagation()}>
            ${connection.status === 'disconnected' ? html`
              <button 
                class="btn btn-xs btn-success"
                @click=${(e: Event) => this.handleConnect(e, connection.id)}
                title="Connect"
              >
                ▶
              </button>
            ` : ''}
            
            ${connection.status === 'connected' ? html`
              <button 
                class="btn btn-xs btn-error"
                @click=${(e: Event) => this.handleDisconnect(e, connection.id)}
                title="Disconnect"
              >
                ⏸
              </button>
            ` : ''}
            
            ${connection.status === 'connecting' ? html`
              <span class="loading loading-spinner loading-xs"></span>
            ` : ''}
          </div>
        </div>
        
        <!-- Connection Tree Content (when connected) -->
        ${connection.status === 'connected' ? html`
          <div class="ml-4 space-y-1">
            
            <!-- Databases Node -->
            <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                 @click=${() => this.toggleNode(databasesNodeId)}>
              <span class="mr-2 w-4 text-center">
                ${this.isExpanded(databasesNodeId) ? '▼' : '▶'}
              </span>
              <span class="mr-2"><i class="fa-solid fa-database"></i></span>
              <span>Databases</span>
              ${connection.databases ? html`
                <span class="ml-2 badge badge-outline badge-xs">${connection.databases.length}</span>
              ` : ''}
            </div>
            
            <!-- Databases List (when expanded) -->
            ${this.isExpanded(databasesNodeId) && connection.databases ? html`
              <div class="ml-8 space-y-1">
                ${connection.databases.map(dbName => {
                  const dbNodeId = `${connection.id}-db-${dbName}`;
                  const bundlesNodeId = `${connection.id}-db-${dbName}-bundles`;
                  
                  return html`
                    <!-- Database Node -->
                    <div class="space-y-1">
                      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                           @click=${() => this.toggleNode(dbNodeId)}>
                        <span class="mr-2 w-4 text-center">
                          ${this.isExpanded(dbNodeId) ? '▼' : '▶'}
                        </span>
                        <span class="mr-2"><i class="fa-solid fa-database"></i></span>
                        <span>${dbName}</span>
                      </div>
                      
                      <!-- Database Content (when expanded) -->
                      ${this.isExpanded(dbNodeId) ? html`
                        <div class="ml-6 space-y-1">
                          <!-- Bundles Node -->
                          <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                               @click=${() => this.handleDatabaseClick(connection, dbName, bundlesNodeId)}>
                            <span class="mr-2 w-4 text-center">
                              ${this.isExpanded(bundlesNodeId) ? '▼' : '▶'}
                            </span>
                            <span class="mr-2"><i class="fa-regular fa-file-zipper"></i></span>
                            <span>Bundles</span>
                            ${connection.bundles ? html`
                              <span class="ml-2 badge badge-outline badge-xs">${connection.bundles.length}</span>
                            ` : ''}
                          </div>
                          
                          <!-- Bundles List (when expanded) -->
                          ${this.isExpanded(bundlesNodeId) && connection.bundles ? html`
                            <div class="ml-8 space-y-1">
                             
                              ${connection.bundles.map(bundleName => {
                                const bundleNodeId = `${connection.id}-db-${dbName}-bundle-${bundleName}`;
                                const fieldsNodeId = `${connection.id}-db-${dbName}-bundle-${bundleName}-fields`;
                                const relationshipsNodeId = `${connection.id}-db-${dbName}-bundle-${bundleName}-relationships`;
                                const indexesNodeId = `${connection.id}-db-${dbName}-bundle-${bundleName}-indexes`;
                                const bundleDetails = connection.bundleDetails?.get(bundleName);
                                
                                return html`
                                  <!-- Bundle Node (clickable) -->
                                  <div class="space-y-1">
                                    <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                                        @click=${() => this.handleBundleClick(connection, bundleName, bundleNodeId)}>
                                      <span class="mr-2 w-4 text-center">
                                        ${this.isExpanded(bundleNodeId) ? '▼' : '▶'}
                                      </span>
                                      <span class="mr-2"><i class="fa-regular fa-file-zipper"></i></span>
                                      <span>${bundleName}</span>
                                    </div>
                                    
                                    <!-- Bundle Content (when expanded) -->
                                    ${this.isExpanded(bundleNodeId) && bundleDetails ? html`
                                      <div class="ml-6 space-y-1">
                                        <!-- Fields Node -->
                                        <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                                            @click=${() => this.handleFieldsClick(connection, bundleName, fieldsNodeId)}>
                                          <span class="mr-2 w-4 text-center">
                                            ${this.isExpanded(fieldsNodeId) ? '▼' : '▶'}
                                          </span>
                                          <span class="mr-2"><i class="fa-solid fa-tag"></i></span>
                                          <span>Fields</span>
                                          ${bundleDetails.documentStructure?.FieldDefinitions ? html`
                                            <span class="ml-2 badge badge-outline badge-xs">${bundleDetails.documentStructure.FieldDefinitions.length}</span>
                                          ` : ''}
                                        </div>
                                        
                                        <!-- Fields List (when expanded) -->
                                        ${this.isExpanded(fieldsNodeId) && bundleDetails.documentStructure?.FieldDefinitions ? html`
                                          <div class="ml-8 space-y-1">
                                           
                                            ${(() => {
  console.log('FieldDefinitions:', bundleDetails.documentStructure.FieldDefinitions);
  console.log('FieldDefinitions type:', typeof bundleDetails.documentStructure.FieldDefinitions);
  console.log('Is array:', Array.isArray(bundleDetails.documentStructure.FieldDefinitions));
  
  const fieldDefs = bundleDetails.documentStructure.FieldDefinitions;
  const fieldsArray = Array.isArray(fieldDefs) ? fieldDefs : Object.values(fieldDefs);
  
  return fieldsArray.map((field: any) => html`
    <div class="flex items-center p-1 rounded hover:bg-base-300 text-sm">
      <span class="mr-2 w-4"></span>
      <span class="mr-2"><i class="fa-solid fa-tags"></i></span>
      <span>${field.Name || field.name || field}</span>
    </div>
  `);
})()}
                                            ${bundleDetails.documentStructure.FieldDefinitions.length === 0 ? html`
                                              <div class="ml-4 text-xs text-gray-500 italic">No fields found</div>
                                            ` : ''}
                                          </div>
                                        ` : ''}
                                        
                                        <!-- Relationships Node -->
                                        <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                                            @click=${() => this.toggleNode(relationshipsNodeId)}>
                                          <span class="mr-2 w-4 text-center">
                                            ${this.isExpanded(relationshipsNodeId) ? '▼' : '▶'}
                                          </span>
                                          <span class="mr-2"><i class="fa-solid fa-circle-nodes"></i></span>
                                          <span>Relationships</span>
                                        </div>
                                        
                                        <!-- Indexes Node -->
                                        <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                                            @click=${() => this.toggleNode(indexesNodeId)}>
                                          <span class="mr-2 w-4 text-center">
                                            ${this.isExpanded(indexesNodeId) ? '▼' : '▶'}
                                          </span>
                                          <span class="mr-2"><i class="fa-solid fa-folder-tree"></i></span>
                                          <span>Indexes</span>
                                        </div>
                                      </div>
                                    ` : ''}
                                  </div>
                                `;
                              })}


                              ${connection.bundles.length === 0 ? html`
                                <div class="ml-4 text-xs text-gray-500 italic">No bundles found</div>
                              ` : ''}
                            </div>
                          ` : ''}
                        </div>
                      ` : ''}
                    </div>
                  `;
                })}
                ${connection.databases.length === 0 ? html`
                  <div class="ml-4 text-xs text-gray-500 italic">No databases found</div>
                ` : ''}
              </div>
            ` : ''}
            
          </div>
        ` : ''}
        
        <!-- Error Message -->
        ${connection.status === 'error' && connection.lastError ? html`
          <div class="ml-6 text-xs text-error">
            Error: ${connection.lastError}
          </div>
        ` : ''}
      </div>
    `;
  }

  private handleConnect(event: Event, connectionId: string) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('connect-database', {
      detail: { connectionId },
      bubbles: true
    }));
  }

  private handleDisconnect(event: Event, connectionId: string) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('disconnect-database', {
      detail: { connectionId },
      bubbles: true
    }));
  }

  render() {
    return html`
      <div>
        ${this.connections.map(connection => this.renderConnection(connection))}
        
        ${this.connections.length === 0 ? html`
          <div class="text-center text-gray-400 py-8">
            <div class="text-4xl mb-2">🔌</div>
            <div>No connections</div>
            <div class="text-sm">Click "New Connection" to get started</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private async handleBundleClick(connection: Connection, bundleName: string, bundleNodeId: string) {
    // Toggle the bundle node
    this.toggleNode(bundleNodeId);
    
    // If expanding and bundle details are not loaded, fetch them
    if (this.isExpanded(bundleNodeId)) {
      try {
        console.log('Fetching details for bundle:', bundleName);
        
        // Import the connection manager
        const { connectionManager } = await import('../services/connection-manager');
        
        // Get bundle details (this will fetch if not cached)
        const bundleDetails = await connectionManager.getBundleDetails(connection.id, bundleName);
        
        if (bundleDetails) {
          console.log('Bundle details loaded:', bundleDetails);
          this.requestUpdate();
        }
      } catch (error) {
        console.error('Error fetching bundle details:', error);
      }
    }
  }

  private async handleFieldsClick(connection: Connection, bundleName: string, fieldsNodeId: string) {
    // Toggle the fields node
    this.toggleNode(fieldsNodeId);
    console.log('Fields clicked for bundle:', bundleName);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-tree': ConnectionTree;
  }
}
