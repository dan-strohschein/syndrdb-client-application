// Global connection pool for managing authenticated SyndrDB connections
import { SyndrDBDriver } from '../drivers/syndrdb-driver';

export interface PooledConnection {
  id: string;
  connectionId: string; // SyndrDB main service connection ID
  driver: SyndrDBDriver;
  name: string;
  hostname: string;
  port: string;
  database: string;
  username: string;
  lastUsed: Date;
  isActive: boolean;
}

export class ConnectionPool {
  private static instance: ConnectionPool;
  private connections: Map<string, PooledConnection> = new Map();

  private constructor() {}

  static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool();
    }
    return ConnectionPool.instance;
  }

  /**
   * Add a connection to the pool
   */
  addConnection(connection: PooledConnection): void {
    console.log('🏊 Adding connection to pool:', connection.id);
    this.connections.set(connection.id, connection);
  }

  /**
   * Get a connection from the pool
   */
  getConnection(connectionId: string): PooledConnection | undefined {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastUsed = new Date();
      console.log('🏊 Retrieved connection from pool:', connectionId);
    }
    return connection;
  }

  /**
   * Get connection by name
   */
  getConnectionByName(name: string): PooledConnection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.name === name) {
        connection.lastUsed = new Date();
        return connection;
      }
    }
    return undefined;
  }

  /**
   * Remove a connection from the pool
   */
  removeConnection(connectionId: string): void {
    console.log('🏊 Removing connection from pool:', connectionId);
    this.connections.delete(connectionId);
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): PooledConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isActive);
  }

  /**
   * Mark connection as inactive
   */
  markInactive(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      console.log('🏊 Marked connection as inactive:', connectionId);
    }
  }

  /**
   * Mark connection as active
   */
  markActive(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = true;
      connection.lastUsed = new Date();
      console.log('🏊 Marked connection as active:', connectionId);
    }
  }

  /**
   * Clean up old inactive connections
   */
  cleanup(maxIdleTimeMs: number = 300000): void { // 5 minutes default
    const now = new Date();
    const toRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      if (!connection.isActive && 
          (now.getTime() - connection.lastUsed.getTime()) > maxIdleTimeMs) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => {
      console.log('🏊 Cleaning up old connection:', id);
      this.removeConnection(id);
    });
  }
}

// Export singleton instance
export const connectionPool = ConnectionPool.getInstance();
