// Main process SyndrDB service - Handles actual TCP socket connections
import { Socket } from 'net';
import { EventEmitter } from 'events';
import { decompress as zstdDecompress } from 'fzstd';
import { ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';

/** Shape of a parsed response from the SyndrDB server */
export interface SyndrDBResponse {
  success?: boolean;
  error?: string;
  Result?: unknown;
  ResultCount?: number;
  data?: unknown;
  id?: string;
  message?: string;
  status?: string;
  results?: unknown[];
  [key: string]: unknown;
}

interface SyndrConnection {
  id: string;
  config: ConnectionConfig;
  socket: Socket | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'authenticating';
  lastError?: string;
  messageHandlers: Map<string, (response: SyndrDBResponse) => void>;
  messageId: number;
  authenticationComplete: boolean;
  messageBuffer: string; // Buffer for incomplete JSON messages
  binaryBuffer: Buffer; // Accumulates raw bytes for zstd detection
  monitorState: 'idle' | 'header_received' | 'streaming';
  monitorBuffer: string;
  pendingSnapshotTimestamp: number | null;
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
      messageBuffer: '', // Initialize empty message buffer
      binaryBuffer: Buffer.alloc(0),
      monitorState: 'idle',
      monitorBuffer: '',
      pendingSnapshotTimestamp: null
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
            
            if (response.Result && response.ResultCount != null && response.ResultCount >= 0) {
              // SyndrDB format
              data = response.Result;
              const count = response.ResultCount || (Array.isArray(data) ? data.length : 0);
              documentCount = count;
              resultCount = count;
            } else if (response.Result === null && response.ResultCount === 0) {
              data = null;
              documentCount = 0;
              resultCount = 0;
            } else if (response.data) {
              // Fallback / GraphQL response format
              data = response.data;
              if (Array.isArray(data)) {
                // Flat array (e.g. fallback format)
                documentCount = data.length;
                resultCount = data.length;
              } else if (typeof data === 'object' && data !== null) {
                // GraphQL response shape: { "orders": [...], ... }
                // Extract count from the first array-valued field
                const firstArray = Object.values(data).find((v): v is unknown[] => Array.isArray(v));
                documentCount = firstArray?.length || 0;
                resultCount = firstArray?.length || 0;
              } else {
                documentCount = 0;
                resultCount = 0;
              }
            } else if (response.results) {
              // Alternative fallback format
              data = response.results;
              const resultsLength = Array.isArray(data) ? data.length : 0;
              documentCount = resultsLength;
              resultCount = resultsLength;
            } else {
              // Single response format
              data = [response];
              documentCount = 1;
              resultCount = 1;
            }
            
            resolve({
              success: true,
              data: data as Record<string, unknown>[],
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
    connection.messageBuffer = '';
    connection.binaryBuffer = Buffer.alloc(0);
    connection.monitorState = 'idle';
    connection.monitorBuffer = '';
    connection.pendingSnapshotTimestamp = null;
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
   * Handle query data using buffered approach for large responses.
   * Detects ZSTD-compressed responses and decompresses transparently.
   * Also detects MONITOR:v1 streaming protocol and routes accordingly.
   */
  private handleQueryData(data: Buffer, connection: SyndrConnection) {
    // If the connection is in monitor mode, route ALL data to the monitor handler
    if (connection.monitorState !== 'idle') {
      this.handleMonitorData(data, connection);
      return;
    }

    // Accumulate raw bytes
    connection.binaryBuffer = Buffer.concat([connection.binaryBuffer, data]);

    // Process as many complete messages as possible from the binary buffer
    while (connection.binaryBuffer.length > 0) {
      // Check for ZSTD header (ASCII: "ZSTD:")
      const ZSTD_PREFIX = Buffer.from('ZSTD:');

      if (connection.binaryBuffer.length >= 5 && connection.binaryBuffer.subarray(0, 5).equals(ZSTD_PREFIX)) {
        // --- Compressed response path ---

        // Find the newline after "ZSTD:<length>"
        const headerEnd = connection.binaryBuffer.indexOf(0x0A); // '\n'
        if (headerEnd === -1) {
          // Haven't received the full header yet — wait for more data
          return;
        }

        // Parse length from "ZSTD:<length>\n"
        const headerStr = connection.binaryBuffer.subarray(5, headerEnd).toString('ascii');
        const compressedLength = parseInt(headerStr, 10);
        if (isNaN(compressedLength) || compressedLength <= 0) {
          console.error('Invalid ZSTD header length:', headerStr);
          // Skip past the bad header and try again
          connection.binaryBuffer = connection.binaryBuffer.subarray(headerEnd + 1);
          continue;
        }

        // Total frame size: header + \n + compressed bytes + trailing \n
        const frameSize = headerEnd + 1 + compressedLength + 1;
        if (connection.binaryBuffer.length < frameSize) {
          // Haven't received the full compressed payload yet — wait for more data
          return;
        }

        // Extract the compressed bytes
        const compressedStart = headerEnd + 1;
        const compressedBytes = connection.binaryBuffer.subarray(compressedStart, compressedStart + compressedLength);

        // Decompress
        try {
          const decompressed = zstdDecompress(new Uint8Array(compressedBytes));
          const jsonText = Buffer.from(decompressed).toString('utf-8');
          console.log('📊 Decompressed ZSTD response:', compressedLength, 'bytes ->', jsonText.length, 'bytes');

          // Parse and route the decompressed JSON
          const response = JSON.parse(jsonText);
          this.handleMessage(connection.id, response);
        } catch (err) {
          console.error('📊 Failed to decompress/parse ZSTD response:', err);
        }

        // Consume the frame from the buffer
        connection.binaryBuffer = connection.binaryBuffer.subarray(frameSize);

      } else {
        // --- Uncompressed JSON response path (backwards compatible) ---

        // Convert accumulated buffer to string and feed into existing brace-counting parser
        const chunk = connection.binaryBuffer.toString('utf-8');
        connection.binaryBuffer = Buffer.alloc(0);

        connection.messageBuffer += chunk;

        // Extract complete JSON objects using brace-counting
        const completeMessages: string[] = [];
        let braceCount = 0;
        let messageStart = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < connection.messageBuffer.length; i++) {
          const char = connection.messageBuffer[i];

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
              if (braceCount === 0) {
                const completeMessage = connection.messageBuffer.substring(messageStart, i + 1).trim();
                if (completeMessage) {
                  completeMessages.push(completeMessage);
                }
                messageStart = i + 1;
              }
            }
          }
        }

        connection.messageBuffer = connection.messageBuffer.substring(messageStart);

        for (const messageText of completeMessages) {
          try {
            const response = JSON.parse(messageText);
            this.handleMessage(connection.id, response);
          } catch (parseError) {
            console.error('📊 Failed to parse query response as JSON:', parseError);
          }
        }

        // Exit the while loop — uncompressed path consumed the entire buffer
        break;
      }
    }
  }

  /**
   * Handle data arriving on a connection that is in monitor mode.
   * Uses brace-counting to extract complete JSON objects (same approach as
   * the normal query path) so it works regardless of whether the server
   * uses the MONITOR:v1 line protocol or sends plain JSON frames.
   * Also recognises SNAPSHOT:<ts> and END:monitor_stopped control lines
   * if the server uses the streaming wire format.
   */
  private handleMonitorData(data: Buffer, connection: SyndrConnection) {
    // Accumulate into the text buffer
    connection.monitorBuffer += data.toString('utf-8');

    // --- Handle control lines that appear OUTSIDE JSON objects ----------
    // Strip any leading non-JSON content (MONITOR:v1 header, SNAPSHOT:, etc.)
    // and then extract complete JSON objects via brace-counting.

    let buf = connection.monitorBuffer;
    const completeJsonValues: string[] = [];

    // Outer loop: skip non-JSON text, then extract one JSON value ({...} or [...]), repeat
    while (buf.length > 0) {
      // Find the start of the next JSON value — either '{' or '['
      const objStart = buf.indexOf('{');
      const arrStart = buf.indexOf('[');

      let jsonStart: number;
      let openChar: string;
      let closeChar: string;

      if (objStart === -1 && arrStart === -1) {
        // No JSON in remaining buffer – scan for control lines
        this.processMonitorControlLines(buf, connection);
        buf = '';
        break;
      } else if (objStart === -1) {
        jsonStart = arrStart; openChar = '['; closeChar = ']';
      } else if (arrStart === -1) {
        jsonStart = objStart; openChar = '{'; closeChar = '}';
      } else {
        // Use whichever comes first
        if (arrStart < objStart) {
          jsonStart = arrStart; openChar = '['; closeChar = ']';
        } else {
          jsonStart = objStart; openChar = '{'; closeChar = '}';
        }
      }

      // Process any text before the JSON start as control lines
      if (jsonStart > 0) {
        const prefix = buf.substring(0, jsonStart);
        this.processMonitorControlLines(prefix, connection);
        buf = buf.substring(jsonStart);
      }

      // Bracket/brace counting to find the matching close
      let depth = 0;
      let inString = false;
      let escaped = false;
      let endIdx = -1;

      for (let i = 0; i < buf.length; i++) {
        const ch = buf[i];

        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }

        if (!inString) {
          if (ch === openChar || ch === '{' || ch === '[') depth++;
          else if (ch === closeChar || ch === '}' || ch === ']') {
            depth--;
            if (depth === 0) {
              endIdx = i;
              break;
            }
          }
        }
      }

      if (endIdx === -1) {
        // Incomplete JSON value – wait for more data
        break;
      }

      completeJsonValues.push(buf.substring(0, endIdx + 1));
      buf = buf.substring(endIdx + 1);
    }

    connection.monitorBuffer = buf;

    // Emit each complete JSON value as a snapshot
    for (const jsonText of completeJsonValues) {
      try {
        const parsed = JSON.parse(jsonText);
        const timestamp = connection.pendingSnapshotTimestamp || Date.now();
        connection.pendingSnapshotTimestamp = null;
        this.emit('monitor-snapshot', {
          connectionId: connection.id,
          timestamp,
          data: parsed
        });
      } catch {
        console.warn('📡 Monitor: failed to parse JSON:', jsonText.substring(0, 120));
      }
    }
  }

  /**
   * Scan text for monitor control lines (SNAPSHOT:<ts>, END:monitor_stopped,
   * MONITOR:v1 header).  Called for non-JSON segments in the monitor buffer.
   */
  private processMonitorControlLines(text: string, connection: SyndrConnection) {
    const lines = text.split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (line.startsWith('MONITOR:v1')) {
        console.log('📡 Detected MONITOR:v1 header');
        continue; // just skip the header
      }

      if (line.startsWith('SNAPSHOT:')) {
        const tsStr = line.substring('SNAPSHOT:'.length);
        connection.pendingSnapshotTimestamp = parseInt(tsStr, 10) || Date.now();
        continue;
      }

      if (line === 'END:monitor_stopped') {
        console.log('📡 Monitor stopped for connection:', connection.id);
        connection.monitorState = 'idle';
        connection.monitorBuffer = '';
        connection.pendingSnapshotTimestamp = null;
        this.emit('monitor-stopped', { connectionId: connection.id });
        return;
      }
    }
  }

  /**
   * Start a monitor stream on a connection. The connection socket behavior changes
   * to streaming mode — it should use a dedicated connection.
   */
  async startMonitor(connectionId: string, command: string): Promise<{ success: boolean; error?: string }> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }
    if (connection.status !== 'connected' || !connection.socket) {
      return { success: false, error: 'Connection not available' };
    }
    if (!connection.authenticationComplete) {
      return { success: false, error: 'Authentication not complete' };
    }

    try {
      // Flag the connection as monitoring BEFORE sending the command so that
      // the very first response frame is routed to the monitor handler
      // instead of the normal query message-handler lookup.
      connection.monitorState = 'streaming';
      connection.monitorBuffer = '';
      connection.pendingSnapshotTimestamp = null;

      connection.socket.write(command + '\n\x04');
      console.log('📡 Monitor command sent:', command);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send monitor command';
      return { success: false, error: message };
    }
  }

  /**
   * Stop an active monitor stream on a connection.
   */
  async stopMonitor(connectionId: string): Promise<{ success: boolean; error?: string }> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }
    if (!connection.socket || connection.socket.destroyed) {
      return { success: false, error: 'No active socket' };
    }

    try {
      connection.socket.write('STOP MONITOR;\n\x04');
      // Reset monitor state so the connection can be used normally again
      connection.monitorState = 'idle';
      connection.monitorBuffer = '';
      connection.pendingSnapshotTimestamp = null;
      console.log('📡 Stop monitor sent for connection:', connectionId);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop monitor';
      return { success: false, error: message };
    }
  }

  /**
   * Handle incoming messages from SyndrDB server
   */
  private handleMessage(connectionId: string, response: SyndrDBResponse) {
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
    return `syndrdb://${config.hostname}:${config.port}:${config.database}:${config.username}:${config.password}:compress=zstd`;
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
