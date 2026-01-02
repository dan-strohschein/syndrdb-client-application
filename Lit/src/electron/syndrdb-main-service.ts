// Main process SyndrDB service - Handles actual TCP socket connections
import { Socket } from 'net';
import { EventEmitter } from 'events';
import { ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';

interface SyndrConnection {
  id: string;
  config: ConnectionConfig;
  socket: Socket | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'authenticating';
  lastError?: string;
  messageHandlers: Map<string, (response: any) => void>;
  messageId: number;
  authenticationComplete: boolean;
  messageBuffer: string; // Buffer for incomplete JSON messages
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
      messageId: 0,
      authenticationComplete: false,
      messageBuffer: '' // Initialize empty message buffer
    };

    this.connections.set(connectionId, connection);
    this.emitConnectionStatus(connectionId, 'connecting');

    try {
      // Create TCP socket
      const socket = new Socket();
      connection.socket = socket;

      // Build SyndrDB connection string
      const connectionString = this.buildConnectionString(config);
      // We'll log the actual connection details in the socket.connect section

      return new Promise((resolve, reject) => {
        if (!socket) {
          reject({ success: false, error: 'Failed to create socket' });
          return;
        }

        // Set socket timeout
        socket.setTimeout(10000);

        // Normalize hostname to ensure IPv4 connection
        const hostname = config.hostname === 'localhost' ? '127.0.0.1' : config.hostname;
        console.log('Connecting to SyndrDB:', `${hostname}:${config.port} (normalized from ${config.hostname})`);

        socket.connect({
          port: parseInt(config.port),
          host: hostname,
          family: 4  // Force IPv4
        }, () => {
          console.log('🔌 TCP Socket connected, waiting for welcome message...');
        });

        socket.on('data', (data) => {
          try {
            // Use different handling based on connection status
            if (connection.status === 'connecting' || connection.status === 'authenticating') {
              // Simple handling for authentication - use original approach
              this.handleAuthenticationData(data, connection, resolve, reject, connectionString);
            } else if (connection.status === 'connected' && connection.authenticationComplete) {
              // Buffered handling for query responses
              this.handleQueryData(data, connection);
            } else {
              console.log('⚠️ Received data in unexpected status:', connection.status);
            }
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
          console.log('🔌 SyndrDB socket closed for connection:', connectionId);
          console.log('🔌 Connection was in status:', connection.status);
          console.log('🔌 Socket close reason: normal closure');
          connection.status = 'disconnected';
          this.emitConnectionStatus(connectionId, 'disconnected');
        });

        socket.on('timeout', () => {
          console.error('⏰ SyndrDB connection timeout for:', connectionId);
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
    console.log('🚀 SyndrDBMainService.executeQuery called:', { connectionId, query });
    
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.log('❌ Connection not found:', connectionId);
      console.log('❌ Available connections:', Array.from(this.connections.keys()));
      throw new Error('Connection not found');
    }
    
    if (connection.status !== 'connected') {
      console.log('❌ Connection not in connected status:', connection.status);
      throw new Error(`Connection not available - status: ${connection.status}`);
    }
    
    if (!connection.socket) {
      console.log('❌ No socket available on connection');
      throw new Error('No socket available');
    }
    
    if (!connection.authenticationComplete) {
      console.log('❌ Authentication not complete on connection');
      throw new Error('Authentication not complete');
    }

    console.log('✅ Connection validation passed - ready for query execution');

    const messageId = `query_${++connection.messageId}`;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Store the handler for this specific message
        connection.messageHandlers.set(messageId, (response) => {
          console.log('📨 Received raw response for query:', { messageId, response });
          const executionTime = Date.now() - startTime;
          
          if (response.success !== false && !response.error) {
            // Use the raw server response directly - no modification
            let data;
            let documentCount = 0;
            let resultCount = 0;
            
            if (response.Result && response.ResultCount >= 0) {
              // SyndrDB format
              data = response.Result;
              documentCount = response.ResultCount || data?.length || 0;
              resultCount = response.ResultCount || data?.length || 0;
            } else if (response.Result === null && response.ResultCount === 0) {
              data = null;
              documentCount = 0;
              resultCount = 0;
            } else if (response.data) {
              // Fallback format
              data = response.data;
              documentCount = data?.length || 0;
              resultCount = data?.length || 0;
            } else if (response.results) {
              // Alternative fallback format  
              data = response.results;
              documentCount = data?.length || 0;
              resultCount = data?.length || 0;
            } else {
              // Single response format
              data = [response];
              documentCount = 1;
              resultCount = 1;
            }
            
            resolve({
              success: true,
              data: data,
              executionTime,
              documentCount,
              ResultCount: resultCount,
            });
          } else {
            resolve({
              success: false,
              error: response.error || 'Query execution failed',
              executionTime
            });
          }
        });      // Send the query as plain text (SyndrDB expects this format)
      console.log('🔥 Sending query to SyndrDB TCP socket:', query);
      console.log('🔥 Socket state:', { 
        socketExists: !!connection.socket, 
        readable: connection.socket?.readable,
        writable: connection.socket?.writable,
        destroyed: connection.socket?.destroyed
      });
      
      if (connection.socket) {
        connection.socket.write(query + '\n\x04');
        console.log('✅ Query sent to TCP socket successfully (with \\x04 terminator)');
      } else {
        console.log('❌ No socket available to send query');
      }

      // Timeout after 10 seconds (reduced for faster debugging)
      setTimeout(() => {
        if (connection.messageHandlers.has(messageId)) {
          console.log('⏰ Query timeout reached for message:', messageId);
          console.log('⏰ Connection status:', connection.status);
          console.log('⏰ Socket state at timeout:', {
            socketExists: !!connection.socket,
            readable: connection.socket?.readable,
            writable: connection.socket?.writable,
            destroyed: connection.socket?.destroyed
          });
          connection.messageHandlers.delete(messageId);
          reject(new Error('Query timeout'));
        }
      }, 10000); // Reduced from 30000 to 10000
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
    connection.messageBuffer = ''; // Clear message buffer
    this.connections.delete(connectionId);
    this.emitConnectionStatus(connectionId, 'disconnected');
  }

  /**
   * Handle authentication data using the original simple approach
   */
  private handleAuthenticationData(
    data: Buffer, 
    connection: SyndrConnection, 
    resolve: (value: { success: boolean; connectionId?: string; error?: string }) => void,
    reject: (reason?: any) => void,
    connectionString: string
  ) {
    const message = data.toString().trim();
    console.log('🔐 Raw data received:', message);
    console.log('🔐 Current connection status:', connection.status);

    // Handle welcome message (step 2) - wait for welcome, then send connection string
    if (connection.status === 'connecting' && message.includes('Welcome to SyndrDB')) {
      console.log('📩 Received welcome message, sending connection string immediately...');
      console.log('🔐 Connection string to send:', connectionString);
      
      // Send the connection string immediately (step 3)
      if (connection.socket) {
        const authString = connectionString + ';\n\x04';
        console.log('🔐 Writing to socket - Length:', authString.length, 'bytes (includes `;\\n\\x04` terminator)');
        console.log('🔐 Socket writable:', connection.socket.writable);
        console.log('🔐 Socket destroyed:', connection.socket.destroyed);
        
        const writeSuccess = connection.socket.write(authString, 'utf8', (err) => {
          if (err) {
            console.error('❌ Socket write error:', err);
          } else {
            console.log('✅ Socket write completed successfully');
          }
        });
        
        console.log('🔐 Write returned:', writeSuccess);
      }
      
      connection.status = 'authenticating';
      console.log('🔐 Status changed to authenticating, waiting for authentication response...');
      return;
    }

    // Handle authentication response (step 4) - display raw results
    if (connection.status === 'authenticating') {
      console.log('🎉 RAW AUTHENTICATION RESPONSE:', message);
      
      // Try to parse as JSON
      let response;
      try {
        response = JSON.parse(message);
        console.log('🔐 Parsed authentication response:', JSON.stringify(response, null, 2));
      } catch (parseError) {
        console.log('🔐 Non-JSON authentication response, treating as raw text');
        response = { message };
      }
      
      // Check for success
      if ((response.message && response.message.includes('Authentication successful')) ||
          response.status === 'success') {
        console.log('🎉 Authentication successful!');
        connection.status = 'connected';
        connection.authenticationComplete = true;
        
        // Remove connection timeout after successful authentication
        connection.socket?.setTimeout(0);
        console.log('✅ Socket timeout removed after authentication');
        
        this.emitConnectionStatus(connection.id, 'connected');
        console.log('✅ SyndrDB authentication fully complete - ready for queries');
        
        resolve({ success: true, connectionId: connection.id });
        return;
      }
      
      // Check for authentication failure
      if (response.error || response.status === 'error') {
        console.log('❌ Authentication failed:', response);
        connection.status = 'error';
        connection.lastError = response.message || response.error || 'Authentication failed';
        this.emitConnectionStatus(connection.id, 'error', connection.lastError);
        
        resolve({ success: false, error: connection.lastError });
        return;
      }
    }
  }

  /**
   * Handle query data using buffered approach for large responses
   */
  private handleQueryData(data: Buffer, connection: SyndrConnection) {
    const chunk = data.toString();
    console.log('📊 Query chunk received:', chunk.length, 'bytes');
    
    // Add chunk to message buffer
    connection.messageBuffer += chunk;
    
    // Try to extract complete JSON messages from buffer
    let completeMessages: string[] = [];
    let remainingBuffer = connection.messageBuffer;
    
    // Look for complete JSON objects by counting braces
    let braceCount = 0;
    let messageStart = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < remainingBuffer.length; i++) {
      const char = remainingBuffer[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          
          // Found complete JSON object
          if (braceCount === 0) {
            const completeMessage = remainingBuffer.substring(messageStart, i + 1).trim();
            if (completeMessage) {
              completeMessages.push(completeMessage);
            }
            messageStart = i + 1;
          }
        }
      }
    }
    
    // Update buffer with remaining incomplete data
    connection.messageBuffer = remainingBuffer.substring(messageStart);
    
    console.log('📊 Extracted', completeMessages.length, 'complete messages, buffer remaining:', connection.messageBuffer.length, 'bytes');
    
    // Process each complete message
    for (const messageText of completeMessages) {
      console.log('📊 Processing complete query response:', messageText.substring(0, 200) + (messageText.length > 200 ? '...' : ''));
      
      // Parse as JSON for query responses
      try {
        const response = JSON.parse(messageText);
        console.log('📊 Parsed query JSON:', {
          hasResult: 'Result' in response,
          hasResultCount: 'ResultCount' in response,
          resultCount: response.ResultCount,
          dataSize: response.Result?.length || 0
        });
        
        // Route to query handler
        this.handleMessage(connection.id, response);
      } catch (parseError) {
        console.error('📊 Failed to parse query response as JSON:', parseError);
        console.log('📊 Raw message that failed:', messageText);
      }
    }
  }

  /**
   * Handle incoming messages from SyndrDB server
   */
  private handleMessage(connectionId: string, response: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log('🔍 handleMessage called with response:', response);
    console.log('🔍 Available message handlers:', Array.from(connection.messageHandlers.keys()));

    if (response.id && connection.messageHandlers.has(response.id)) {
      // Response includes the query ID - direct match
      console.log('✅ Found handler for response ID:', response.id);
      const handler = connection.messageHandlers.get(response.id);
      connection.messageHandlers.delete(response.id);
      handler?.(response);
    } else if (connection.messageHandlers.size > 0) {
      // SyndrDB might not include the query ID in response
      // If we have pending handlers, assume this response is for the most recent query
      console.log('⚠️ Response has no ID, using most recent handler');
      const handlerEntries = Array.from(connection.messageHandlers.entries());
      if (handlerEntries.length > 0) {
        const [messageId, handler] = handlerEntries[handlerEntries.length - 1];
        console.log('📞 Calling handler for message ID:', messageId);
        connection.messageHandlers.delete(messageId);
        handler?.(response);
      }
    } else {
      console.log('❌ No handlers available for response');
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
    const statusData = {
      connectionId,
      status,
      error
    };
    console.log('📡 Emitting connection status event:', statusData);
    this.emit('connection-status', statusData);
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
