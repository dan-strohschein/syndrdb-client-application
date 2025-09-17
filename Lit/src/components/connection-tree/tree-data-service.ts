/**
 * Data fetching service for the connection tree
 */
import { Connection, BundleDetails } from '../../services/connection-manager';

export class TreeDataService {
  /**
   * Fetch bundle details for a specific bundle
   */
  static async fetchBundleDetails(connectionId: string, bundleName: string): Promise<BundleDetails | null> {
    try {
      console.log('Fetching details for bundle:', bundleName);
      
      // Import the connection manager
      const { connectionManager } = await import('../../services/connection-manager');
      
      // Get bundle details (this will fetch if not cached)
      const bundleDetails = await connectionManager.getBundleDetails(connectionId, bundleName);
      
      if (bundleDetails) {
        console.log('Bundle details loaded:', bundleDetails);
        return bundleDetails;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching bundle details:', error);
      throw error;
    }
  }

  /**
   * Fetch users for a connection
   */
  static async fetchConnectionUsers(connectionId: string): Promise<void> {
    try {
      console.log('Refreshing metadata to fetch users for connection:', connectionId);
      
      // Import the connection manager
      const { connectionManager } = await import('../../services/connection-manager');
      
      // Refresh metadata to get users
      await connectionManager.refreshConnectionMetadata(connectionId);
      
      console.log('Users data refreshed successfully');
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Refresh connection metadata
   */
  static async refreshConnectionMetadata(connectionId: string): Promise<void> {
    try {
      const { connectionManager } = await import('../../services/connection-manager');
      await connectionManager.refreshConnectionMetadata(connectionId);
    } catch (error) {
      console.error('Error refreshing connection metadata:', error);
      throw error;
    }
  }

  /**
   * Get cached bundle details if available
   */
  static async getCachedBundleDetails(connectionId: string, bundleName: string): Promise<BundleDetails | null> {
    try {
      const { connectionManager } = await import('../../services/connection-manager');
      return await connectionManager.getBundleDetails(connectionId, bundleName);
    } catch (error) {
      console.error('Error getting cached bundle details:', error);
      return null;
    }
  }
}
