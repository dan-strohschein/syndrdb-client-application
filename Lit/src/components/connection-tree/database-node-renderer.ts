/**
 * Database node renderer for the connection tree - New hierarchical structure
 */
import { html, TemplateResult } from 'lit';
import { Connection, BundleDetails } from '../../services/connection-manager';
import { 
  generateDatabasesNodeId,
  generateDatabaseNodeId, 
  generateBundlesNodeId,
  generateBundleNodeId, 
  generateFieldsNodeId,
  generateIndexesNodeId,
  generateHashIndexesNodeId,
  generateBTreeIndexesNodeId,
  generateRelationshipsNodeId,
  formatCountBadge,
  getNodeIcon 
} from './tree-utils';
import { TreeDataService } from './tree-data-service';
import { UserManagementRenderer } from './user-management-renderer';
import { BundleManager } from '../../services/bundle-manager';
import { Bundle } from '../../types/bundle';

export class DatabaseNodeRenderer {

  private static bundleManager = new BundleManager();

  /**
   * Render the Databases container node and its children
   */
  static renderDatabasesNode(
    connection: Connection,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, data:any) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void,
    onUsersClick: (connection: Connection, usersNodeId: string) => Promise<void>,
    onBundleClick?: (connection: Connection, bundleName: string, bundleNodeId: string) => Promise<void>
  ): TemplateResult {
    const databasesNodeId = generateDatabasesNodeId(connection.id);
    const expanded = isExpanded(databasesNodeId);
    const databaseCount = connection.databases?.length || 0;

    return html`
      <!-- Databases Container Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${() => {
             onSetActiveConnection(connection.id);
             onToggleNode(databasesNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, databasesNodeId, 'Databases', 'databases', null)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('databases')}"></i>
        </span>
        <span>Databases</span>
        <span class="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
          ${formatCountBadge(databaseCount)}
        </span>
      </div>

      <!-- Databases Children (when expanded) -->
      ${expanded ? html`
        <div class="ml-6 space-y-1">
          ${connection.databases?.map(databaseName => 
            DatabaseNodeRenderer.renderIndividualDatabaseNode(
              connection, 
              databaseName, 
              isExpanded, 
              onToggleNode, 
              onContextMenu,
              onSetActiveConnection,
              onRequestUpdate,
              onUsersClick,
              onBundleClick
            )
          )}
        </div>
      ` : ''}

      <!-- Users Node (sibling to Databases) -->
      ${
        UserManagementRenderer.renderUsersNode(
          connection,
          "primary",
          isExpanded,
          onToggleNode,
          onContextMenu,
          onUsersClick
        )
      }
    `;
  }

  /**
   * Render an individual database node and its children
   */
  static renderIndividualDatabaseNode(
    connection: Connection,
    databaseName: string,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, data:any) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void,
    onUsersClick: (connection: Connection, usersNodeId: string) => Promise<void>,
    onBundleClick?: (connection: Connection, bundleName: string, bundleNodeId: string) => Promise<void>
  ): TemplateResult {
    const databaseNodeId = generateDatabaseNodeId(connection.id, databaseName);
    const expanded = isExpanded(databaseNodeId);
    let bundles: Bundle[] = [];
    return html`
      <!-- Individual Database Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${async () => {
             onSetActiveConnection(connection.id);
             // Set database context when clicking on a database
             
             try {
               const { connectionManager } = await import('../../services/connection-manager');
               await connectionManager.setDatabaseContext(connection.id, databaseName);
              // IF the database node has not been expanded before, load its bundles
              if (!expanded) {
                try {
                  bundles = await this.bundleManager.loadBundlesForDatabase(connection.id, databaseName);
                  await connectionManager.setBundlesForDatabase(connection.id, databaseName, bundles);
                } catch (error) {
                  console.error('Failed to load bundles for database:', databaseName, error);
                }
              }

             } catch (error) {
               console.error('Failed to set database context:', databaseName, error);
             }
             onToggleNode(databaseNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, databaseNodeId, databaseName, 'database', databaseName)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('database')}"></i>
        </span>
        <span>${databaseName}</span>
      </div>

      <!-- Database Children (when expanded) -->
      ${expanded ? html`
        <div class="ml-6 space-y-1">
          <!-- Bundles Container -->
          ${DatabaseNodeRenderer.renderBundlesNode(
            connection, 
            databaseName, 
            bundles,
            isExpanded, 
            onToggleNode, 
            onContextMenu,
            onSetActiveConnection,
            onRequestUpdate,
            onBundleClick
          )}
          
         
          
        </div>
      ` : ''}
    `;
  }

  /**
   * Render the Bundles container node and its children
   */
  static renderBundlesNode(
    connection: Connection,
    databaseName: string,
    bundles: Bundle[],
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, data:any) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void,
    onBundleClick?: (connection: Connection, bundleName: string, bundleNodeId: string) => Promise<void>
  ): TemplateResult {
    const bundlesNodeId = generateBundlesNodeId(connection.id, databaseName);
    const expanded = isExpanded(bundlesNodeId);
    // Get bundles specific to this database
// Get bundles from connection object instead of local variable
  const storedBundles = connection.databaseBundles?.get(databaseName) || [];
  
    let bundleCount = storedBundles.length;

    return html`
      <!-- Bundles Container Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${async () => {
             onSetActiveConnection(connection.id);
             // Set database context when clicking on bundles node
             try {
               const { connectionManager } = await import('../../services/connection-manager');
               await connectionManager.setDatabaseContext(connection.id, databaseName);
             } catch (error) {
               console.error('Failed to set database context:', databaseName, error);
             }
               
             
             onToggleNode(bundlesNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, bundlesNodeId, 'Bundles', 'bundles', storedBundles)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('bundles')}"></i>
        </span>
        <span>Bundles</span>
        <span class="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
          ${formatCountBadge(bundleCount)}
        </span>
      </div>

      <!-- Bundles Children (when expanded) -->
      ${expanded ? html`
        <div class="ml-6 space-y-1">
          ${storedBundles.map((bundle: Bundle) => 
            DatabaseNodeRenderer.renderIndividualBundleNode(
              connection, 
              databaseName, 
              bundle.Name, 
              bundle,
              isExpanded, 
              onToggleNode, 
              onContextMenu,
              onSetActiveConnection,
              onRequestUpdate,
              onBundleClick
            )
          )}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render an individual bundle node and its children
   */
  static renderIndividualBundleNode(
    connection: Connection,
    databaseName: string,
    bundleName: string,
    bundle: Bundle,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, bundle: Bundle) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void,
    onBundleClick?: (connection: Connection, bundleName: string, bundleNodeId: string) => Promise<void>
  ): TemplateResult {
    const bundleNodeId = generateBundleNodeId(connection.id, databaseName, bundleName);
    const expanded = isExpanded(bundleNodeId);

    return html`
      <!-- Individual Bundle Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${async () => {
             onSetActiveConnection(connection.id);
             
             // Set database context before bundle operations
             try {
               const { connectionManager } = await import('../../services/connection-manager');
               await connectionManager.setDatabaseContext(connection.id, databaseName);
             } catch (error) {
               console.error('Failed to set database context:', databaseName, error);
             }
             
             // Check if we're expanding the node (was collapsed, now will be expanded)
             const wasCollapsed = !isExpanded(bundleNodeId);
             
             // Toggle the node
             onToggleNode(bundleNodeId);
             
             // Load bundle details only when expanding
             if (wasCollapsed && onBundleClick) {
               await onBundleClick(connection, bundleName, bundleNodeId);
             }
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, bundleNodeId, bundle.Name, 'bundle', bundle)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <draggable-component class="mr-2 cursor-move" 
        .getDropDataHandler=${() => bundle.Name}
        .dragData=${bundle.Name}
        title="Drag to create a query">
          <span class="mr-2">
            <i class="${getNodeIcon('bundle')}"></i>
          </span>
          <span>${bundle.Name}</span>
        </draggable-component>
      </div>

      <!-- Bundle Children (when expanded) -->
      ${expanded ? html`
        <div class="ml-6 space-y-1">
          <!-- Fields Container -->
          ${DatabaseNodeRenderer.renderFieldsNode(
            connection, 
            databaseName, 
            bundleName,
            bundle,
            isExpanded, 
            onToggleNode, 
            onContextMenu,
            onSetActiveConnection,
            onRequestUpdate
          )}
          
          <!-- Relationships Container -->
          ${DatabaseNodeRenderer.renderRelationshipsNode(
            connection, 
            databaseName, 
            bundleName,
            bundle,
            isExpanded, 
            onToggleNode, 
            onContextMenu,
            onSetActiveConnection,
            onRequestUpdate
          )}

          <!-- Indexes Container -->
          ${DatabaseNodeRenderer.renderIndexesNode(
            connection, 
            databaseName, 
            bundleName,
            bundle,
            isExpanded, 
            onToggleNode, 
            onContextMenu,
            onSetActiveConnection,
            onRequestUpdate
          )}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render the Fields container node and its children
   */
  static renderFieldsNode(
    connection: Connection,
    databaseName: string,
    bundleName: string,
    bundle: Bundle,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, bundle: Bundle) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void
  ): TemplateResult {
    const fieldsNodeId = generateFieldsNodeId(connection.id, databaseName, bundleName);
    const expanded = isExpanded(fieldsNodeId);
    const bundleDetails = connection.bundleDetails?.get(bundleName);
    const fieldCount = bundleDetails?.documentStructure?.FieldDefinitions?.length || 0;

    return html`
      <!-- Fields Container Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${async () => {
             onSetActiveConnection(connection.id);
             // Set database context before field operations
             try {
               const { connectionManager } = await import('../../services/connection-manager');
               await connectionManager.setDatabaseContext(connection.id, databaseName);
             } catch (error) {
               console.error('Failed to set database context:', databaseName, error);
             }
             onToggleNode(fieldsNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, fieldsNodeId, 'Fields', 'fields', bundle)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('fields')}"></i>
        </span>
        <span>Fields</span>
        <span class="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
          ${formatCountBadge(fieldCount)}
        </span>
      </div>

      <!-- Fields Children (when expanded) -->
      ${expanded && bundleDetails?.documentStructure?.FieldDefinitions && Array.isArray(bundleDetails.documentStructure.FieldDefinitions) ? html`
        <div class="ml-6 space-y-1">
          ${bundleDetails.documentStructure.FieldDefinitions.map((field: any) => html`
            <div class="flex  p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                 @contextmenu=${(e: MouseEvent) => onContextMenu(e, connection.id + '-field-' + field.Name, field.Name, 'field', bundle)}>
              
              <span class="mr-2">
                <i class="${getNodeIcon('field')}"></i>
              </span>
              <span>${field.Name}</span>
              <span class="ml-2 text-xs text-gray-500">${field.Type}</span>
              ${field.IsRequired ? html`<span class="ml-1 text-xs text-red-500">*</span>` : ''}
            </div>
          `)}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render the Relationships container node and its children
   */
  static renderRelationshipsNode(
    connection: Connection,
    databaseName: string,
    bundleName: string,
    bundle: Bundle,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, bundle: Bundle) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void
  ): TemplateResult {
    const relationshipsNodeId = generateRelationshipsNodeId(connection.id, databaseName, bundleName);
    const expanded = isExpanded(relationshipsNodeId);
    const bundleDetails = connection.bundleDetails?.get(bundleName);
    const relationshipCount = bundleDetails?.relationships?.length || 0;

    return html`
      <!-- Relationships Container Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${() => {
             onSetActiveConnection(connection.id);
             onToggleNode(relationshipsNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, relationshipsNodeId, 'Relationships', 'relationships', bundle)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('relationships')}"></i>
        </span>
        <span>Relationships</span>
        <span class="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
          ${formatCountBadge(relationshipCount)}
        </span>
      </div>

      <!-- Relationships Children (when expanded) -->
      ${expanded && bundleDetails?.relationships && Array.isArray(bundleDetails.relationships) && bundleDetails.relationships.length > 0 ? html`
        <div class="ml-6 space-y-1">
          ${bundleDetails.relationships.map((rel: any, index: number) => html`
            <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                 @contextmenu=${(e: MouseEvent) => onContextMenu(e, connection.id + '-relationship-' + index, 'Relationship ' + (index + 1), 'relationship', bundle)}>
              
              <span class="mr-2">
                <i class="${getNodeIcon('relationship')}"></i>
              </span>
              <span>${rel.Name || `Relationship ${index + 1}`}</span>
            </div>
          `)}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render the Indexes container node and its children
   */
  static renderIndexesNode(
    connection: Connection,
    databaseName: string,
    bundleName: string,
    bundle: Bundle,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, bundle: Bundle) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void
  ): TemplateResult {
    const indexesNodeId = generateIndexesNodeId(connection.id, databaseName, bundleName);
    const expanded = isExpanded(indexesNodeId);
    const bundleDetails = connection.bundleDetails?.get(bundleName);
    const indexCount = bundleDetails?.indexes?.length || 0;

    return html`
      <!-- Indexes Container Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${async () => {
             onSetActiveConnection(connection.id);
             // Set database context before index operations
             try {
               const { connectionManager } = await import('../../services/connection-manager');
               await connectionManager.setDatabaseContext(connection.id, databaseName);
             } catch (error) {
               console.error('Failed to set database context:', databaseName, error);
             }
             onToggleNode(indexesNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, indexesNodeId, 'Indexes', 'indexes', bundle)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('indexes')}"></i>
        </span>
        <span>Indexes</span>
        <span class="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
          ${formatCountBadge(indexCount)}
        </span>
      </div>

      <!-- Indexes Children (when expanded) -->
      ${expanded ? html`
        <div class="ml-6 space-y-1">
          <!-- Hash Indexes -->
          ${DatabaseNodeRenderer.renderHashIndexesNode(
            connection, 
            databaseName, 
            bundleName,
            bundle,
            isExpanded, 
            onToggleNode, 
            onContextMenu,
            onSetActiveConnection,
            onRequestUpdate
          )}
          
          <!-- B-Tree Indexes -->
          ${DatabaseNodeRenderer.renderBTreeIndexesNode(
            connection, 
            databaseName, 
            bundleName,
            bundle,
            isExpanded, 
            onToggleNode, 
            onContextMenu,
            onSetActiveConnection,
            onRequestUpdate
          )}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render the Hash Indexes container node and its children
   */
  static renderHashIndexesNode(
    connection: Connection,
    databaseName: string,
    bundleName: string,
    bundle: Bundle,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, bundle: Bundle) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void
  ): TemplateResult {
    const hashIndexesNodeId = generateHashIndexesNodeId(connection.id, databaseName, bundleName);
    const expanded = isExpanded(hashIndexesNodeId);
    const bundleDetails = connection.bundleDetails?.get(bundleName);
    const hashIndexCount = bundleDetails?.indexes?.filter((idx: any) => idx.IndexType === 'hash').length || 0;

    return html`
      <!-- Hash Indexes Container Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${() => {
             onSetActiveConnection(connection.id);
             onToggleNode(hashIndexesNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, hashIndexesNodeId, 'Hash', 'hash-indexes', bundle)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('hash-indexes')}"></i>
        </span>
        <span>Hash</span>
        <span class="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
          ${formatCountBadge(hashIndexCount)}
        </span>
      </div>

      <!-- Hash Indexes Children (when expanded) -->
      ${expanded && bundleDetails?.indexes ? html`
        <div class="ml-6 space-y-1">
          ${bundleDetails.indexes
            .filter((idx: any) => idx.IndexType === 'hash')
            .map((index: any, i: number) => html`
            <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                 @contextmenu=${(e: MouseEvent) => onContextMenu(e, connection.id + '-hash-index-' + i, 'Hash Index ' + (i + 1), 'index', bundle)}>
             
              <span class="mr-2">
                <i class="${getNodeIcon('index')}"></i>
              </span>
              <span>${index.IndexName || `Hash Index ${i + 1}`}</span>
            </div>
          `)}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render the B-Tree Indexes container node and its children
   */
  static renderBTreeIndexesNode(
    connection: Connection,
    databaseName: string,
    bundleName: string,
    bundle: Bundle,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, bundle: Bundle) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void
  ): TemplateResult {
    const btreeIndexesNodeId = generateBTreeIndexesNodeId(connection.id, databaseName, bundleName);
    const expanded = isExpanded(btreeIndexesNodeId);
    const bundleDetails = connection.bundleDetails?.get(bundleName);
    const btreeIndexCount = bundleDetails?.indexes?.filter((idx: any) => idx.IndexType === 'b-tree').length || 0;

    return html`
      <!-- B-Tree Indexes Container Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${() => {
             onSetActiveConnection(connection.id);
             onToggleNode(btreeIndexesNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, btreeIndexesNodeId, 'B-Tree', 'btree-indexes', bundle)}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2">
          <i class="${getNodeIcon('btree-indexes')}"></i>
        </span>
        <span>B-Tree</span>
        <span class="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
          ${formatCountBadge(btreeIndexCount)}
        </span>
      </div>

      <!-- B-Tree Indexes Children (when expanded) -->
      ${expanded && bundleDetails?.indexes ? html`
        <div class="ml-6 space-y-1">
          ${bundleDetails.indexes
            .filter((idx: any) => idx.IndexType === 'b-tree')
            .map((index: any, i: number) => html`
            <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                 @contextmenu=${(e: MouseEvent) => onContextMenu(e, connection.id + '-btree-index-' + i, 'B-Tree Index ' + (i + 1), 'index', bundle)}>
             
              <span class="mr-2">
                <i class="${getNodeIcon('index')}"></i>
              </span>
              <span>${index.IndexName || `B-Tree Index ${i + 1}`}</span>
            </div>
          `)}
        </div>
      ` : ''}
    `;
  }
}
