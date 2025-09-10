// Main process SyndrDB service - Handles actual TCP socket connections
import { Socket } from 'net';
import { EventEmitter } from 'events';
import { ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';

interface SyndrConnection {
  id: string;
  config: ConnectionConfig;
  socket: Socket | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastError?: string;
  messageHandlers: Map<string, (response: any) => void>;
  messageId: number;
}

export class SyndrDBMainService extends EventEmitter {
  private connections: Map<string, SyndrConnection> = new Map();
  private connectionIdCounter = 0;

  constructor() {
    super();
  }

  /**
   * Connect to a SyndrDB server using TCP socket
   */
  async connect(config: ConnectionConfig): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const connectionId = `syndr_${++this.connectionIdCounter}_${Date.now()}`;
    
    const connection: SyndrConnection = {
      id: connectionId,
      config,
      socket: null,
      status: 'connecting',
      messageHandlers: new Map(),
      messageId: 0
    };

    this.connections.set(connectionId, connection);
    this.emitConnectionStatus(connectionId, 'connecting');

    try {
      // Create TCP socket
      const socket = new Socket();
      connection.socket = socket;

      // Build SyndrDB connection string
      const connectionString = this.buildConnectionString(config);
      console.log('Connecting to SyndrDB:', `${config.hostname}:${config.port}`);

      return new Promise((resolve, reject) => {
        if (!socket) {
          reject({ success: false, error: 'Failed to create socket' });
          return;
        }

        // Set socket timeout
        socket.setTimeout(10000);

        socket.connect(parseInt(config.port), config.hostname, () => {
          console.log('TCP Socket connected, sending authentication...');
          
          // Send the connection string for authentication
          socket.write(connectionString + '\n');
        });

        socket.on('data', (data) => {
          try {
            const message = data.toString().trim();
            console.log('Received from SyndrDB:', message);

            // Try to parse as JSON
            let response;
            try {
              response = JSON.parse(message);
            } catch {
              // If not JSON, treat as simple string response
              response = { message };
            }

            // Handle initial authentication response
            if (connection.status === 'connecting') {
              if (response.success !== false && !response.error) {
                connection.status = 'connected';
                this.emitConnectionStatus(connectionId, 'connected');
                console.log('SyndrDB authentication successful');
                resolve({ success: true, connectionId });
              } else {
                connection.status = 'error';
                connection.lastError = response.error || 'Authentication failed';
                this.emitConnectionStatus(connectionId, 'error', connection.lastError);
                resolve({ success: false, error: connection.lastError });
              }
              return;
            }

            // Handle query responses
            this.handleMessage(connectionId, response);
          } catch (error) {
            console.error('Error processing SyndrDB response:', error);
          }
        });

        socket.on('error', (error) => {
          console.error('SyndrDB socket error:', error);
          connection.status = 'error';
          connection.lastError = error.message;
          this.emitConnectionStatus(connectionId, 'error', error.message);
          resolve({ success: false, error: error.message });
        });

        socket.on('close', () => {
          console.log('SyndrDB socket disconnected');
          connection.status = 'disconnected';
          this.emitConnectionStatus(connectionId, 'disconnected');
        });

        socket.on('timeout', () => {
          console.error('SyndrDB connection timeout');
          socket.destroy();
          connection.status = 'error';
          connection.lastError = 'Connection timeout';
          this.emitConnectionStatus(connectionId, 'error', 'Connection timeout');
          resolve({ success: false, error: 'Connection timeout' });
        });
      });

    } catch (error) {
      connection.status = 'error';
      connection.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emitConnectionStatus(connectionId, 'error', connection.lastError);
      return { success: false, error: connection.lastError };
    }
  }

  /**
   * Test connection without storing it permanently
   */
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      const result = await this.connect(config);
      if (result.success && result.connectionId) {
        // Immediately disconnect the test connection
        await this.disconnect(result.connectionId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Execute a query on a specific connection
   */
  async executeQuery(connectionId: string, query: string): Promise<QueryResult> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected' || !connection.socket) {
      throw new Error('Connection not available');
    }

    const messageId = `query_${++connection.messageId}`;
    const startTime = Date.now();

    const queryMessage = {
      id: messageId,
      type: 'query',
      query: query.trim()
    };

    return new Promise((resolve, reject) => {
      // Store the handler for this specific message
      connection.messageHandlers.set(messageId, (response) => {
        const executionTime = Date.now() - startTime;
        
        if (response.success !== false && !response.error) {
          resolve({
            success: true,
            data: response.data || response.results || [response],
            executionTime,
            documentCount: response.data ? response.data.length : (response.results ? response.results.length : 1)
          });
        } else {
          resolve({
            success: false,
            error: response.error || 'Query execution failed',
            executionTime
          });
        }
      });

      // Send the query
      const queryString = JSON.stringify(queryMessage);
      console.log('Sending query to SyndrDB:', queryString);
      connection.socket?.write(queryString + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (connection.messageHandlers.has(messageId)) {
          connection.messageHandlers.delete(messageId);
          reject(new Error('Query timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Disconnect from a specific connection
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    if (connection.socket) {
      connection.socket.destroy();
      connection.socket = null;
    }

    connection.status = 'disconnected';
    connection.messageHandlers.clear();
    this.connections.delete(connectionId);
    this.emitConnectionStatus(connectionId, 'disconnected');
  }

  /**
   * Handle incoming messages from SyndrDB server
   */
  private handleMessage(connectionId: string, response: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (response.id && connection.messageHandlers.has(response.id)) {
      const handler = connection.messageHandlers.get(response.id);
      connection.messageHandlers.delete(response.id);
      handler?.(response);
    }
  }

  /**
   * Build SyndrDB connection string
   */
  private buildConnectionString(config: ConnectionConfig): string {
    return `syndrdb://${config.hostname}:${config.port}:${config.database}:${config.username}:${config.password}`;
  }

  /**
   * Emit connection status change events
   */
  private emitConnectionStatus(connectionId: string, status: string, error?: string) {
    this.emit('connection-status', {
      connectionId,
      status,
      error
    });
  }

  /**
   * Get all active connections
   */
  getConnections(): SyndrConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get a specific connection
   */
  getConnection(connectionId: string): SyndrConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Cleanup - disconnect all connections
   */
  cleanup(): void {
    for (const [connectionId] of this.connections) {
      this.disconnect(connectionId);
    }
  }
}
