# Cursor Prompt: Add zstd Response Compression Support to SyndrDB Electron Client

## Goal

The SyndrDB server supports zstd response compression, negotiated via `compress=zstd` in the connection string. When enabled, the server sends compressed responses using a `ZSTD:<length>\n<compressed_bytes>\n` wire format instead of raw JSON. This client has **no compression support** — `handleQueryData()` in `syndrdb-main-service.ts` does `data.toString()` on the raw `Buffer` and uses brace-counting to extract JSON objects, which corrupts binary zstd payloads. Implement transparent zstd decompression so the client can negotiate compression and decompress responses before parsing.

---

## Files to Modify

### 1. `package.json` — Add `fzstd` dependency

Add `fzstd` to `dependencies`:

```json
"dependencies": {
    "cally": "^0.8.0",
    "fzstd": "^0.1.1",
    "geist": "^1.5.1",
    "lit": "^3.0.0"
}
```

**Why `fzstd`:** Pure JavaScript zstd decompressor. No native addon compilation — works in any Electron version without `electron-rebuild`. Import: `import { decompress } from 'fzstd'`. Usage: `decompress(new Uint8Array(buffer))` returns `Uint8Array`.

---

### 2. `src/electron/syndrdb-main-service.ts` — Three changes

#### Change A: Add `fzstd` import and binary buffer to `SyndrConnection`

At the top of the file, add:
```typescript
import { decompress as zstdDecompress } from 'fzstd';
```

Add a `binaryBuffer` field to the `SyndrConnection` interface:
```typescript
interface SyndrConnection {
  id: string;
  config: ConnectionConfig;
  socket: Socket | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'authenticating';
  lastError?: string;
  messageHandlers: Map<string, (response: any) => void>;
  messageId: number;
  authenticationComplete: boolean;
  messageBuffer: string;        // existing — keeps working for uncompressed JSON
  binaryBuffer: Buffer;         // NEW — accumulates raw bytes for zstd detection
}
```

Initialize it in `connect()` where the connection object is created:
```typescript
binaryBuffer: Buffer.alloc(0)   // Initialize empty binary buffer
```

Also clear it in `disconnect()`:
```typescript
connection.binaryBuffer = Buffer.alloc(0);
```

#### Change B: Modify `buildConnectionString()` to append compression option

Change the existing `buildConnectionString` method from:
```typescript
private buildConnectionString(config: ConnectionConfig): string {
    return `syndrdb://${config.hostname}:${config.port}:${config.database}:${config.username}:${config.password}`;
}
```

To:
```typescript
private buildConnectionString(config: ConnectionConfig): string {
    return `syndrdb://${config.hostname}:${config.port}:${config.database}:${config.username}:${config.password}:compress=zstd`;
}
```

The server parses the 6th colon-separated field as `key=value` options. Multiple options use `&` as separator (e.g., `compress=zstd&pipeline=true`).

#### Change C: Rewrite `handleQueryData()` to detect and decompress zstd responses

The current implementation (lines 375-454) does `data.toString()` immediately, which corrupts binary zstd payloads. The rewrite must:

1. Accumulate raw `Buffer` data in `connection.binaryBuffer`
2. Check if the buffer starts with the ASCII bytes `ZSTD:` (hex: `5a 53 54 44 3a`)
3. If zstd: parse the header to get the compressed length, wait until the full payload has arrived, decompress, then feed the resulting JSON string into the existing brace-counting logic
4. If not zstd: use the existing string-based brace-counting path (backwards compatible)

Here is the complete replacement for `handleQueryData()`:

```typescript
/**
 * Handle query data using buffered approach for large responses.
 * Detects ZSTD-compressed responses and decompresses transparently.
 */
private handleQueryData(data: Buffer, connection: SyndrConnection) {
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
            let completeMessages: string[] = [];
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
```

---

## Wire Protocol Reference

### Server-side compression (from SyndrDB `src/internal/server/server.go:1953-1959`)
```go
// Write ZSTD:<length>\n header followed by compressed bytes and \n
writer.WriteString("ZSTD:")
writer.WriteString(strconv.Itoa(len(compressed)))  // decimal ASCII, e.g. "1234"
writer.WriteByte('\n')
writer.Write(compressed)     // exactly len(compressed) raw bytes
writer.WriteByte('\n')       // trailing newline
writer.Flush()
```

### Connection string format
```
syndrdb://hostname:port:database:username:password[:options]
```
The 6th colon-separated field holds `key=value` pairs separated by `&`. For compression: `compress=zstd`.

Example: `syndrdb://127.0.0.1:5432:mydb:admin:secret:compress=zstd`

### Working Go client decompression (from `src/cmd/client/internal/client.go:187-214`)
```go
if strings.HasPrefix(line, "ZSTD:") {
    lengthStr := strings.TrimSpace(strings.TrimPrefix(line, "ZSTD:"))
    compLen, _ := strconv.Atoi(lengthStr)
    compressed := make([]byte, compLen)
    io.ReadFull(c.reader, compressed)
    c.reader.ReadByte() // trailing \n
    decompressed, _ := zstdDecoder.DecodeAll(compressed, nil)
    return string(decompressed), nil
}
```

---

## Current Code Reference

### `SyndrConnection` interface (lines 6-16 of `syndrdb-main-service.ts`)
```typescript
interface SyndrConnection {
  id: string;
  config: ConnectionConfig;
  socket: Socket | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'authenticating';
  lastError?: string;
  messageHandlers: Map<string, (response: any) => void>;
  messageId: number;
  authenticationComplete: boolean;
  messageBuffer: string;
}
```

### `ConnectionConfig` interface (from `src/drivers/syndrdb-driver.ts`)
```typescript
export interface ConnectionConfig {
  name: string;
  hostname: string;
  port: string;
  database: string;
  username: string;
  password: string;
}
```

### Current `buildConnectionString()` (line 491-493)
```typescript
private buildConnectionString(config: ConnectionConfig): string {
    return `syndrdb://${config.hostname}:${config.port}:${config.database}:${config.username}:${config.password}`;
}
```

### Current `handleQueryData()` (lines 375-454)
```typescript
private handleQueryData(data: Buffer, connection: SyndrConnection) {
    const chunk = data.toString();  // <-- THIS CORRUPTS BINARY ZSTD DATA
    connection.messageBuffer += chunk;
    // ... brace-counting JSON extraction ...
}
```

### Connection initialization (lines 32-41 in `connect()`)
```typescript
const connection: SyndrConnection = {
    id: connectionId,
    config,
    socket: null,
    status: 'connecting',
    messageHandlers: new Map(),
    messageId: 0,
    authenticationComplete: false,
    messageBuffer: ''
};
```

### `disconnect()` cleanup (lines 267-283)
```typescript
async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    if (connection.socket) {
        connection.socket.destroy();
        connection.socket = null;
    }
    connection.status = 'disconnected';
    connection.messageHandlers.clear();
    connection.messageBuffer = '';
    this.connections.delete(connectionId);
    this.emitConnectionStatus(connectionId, 'disconnected');
}
```

---

## Critical Implementation Notes

1. **Binary buffer is essential.** The current `messageBuffer` is a `string`. Calling `.toString()` on a `Buffer` containing zstd binary data corrupts it (invalid UTF-8 byte sequences get replaced with U+FFFD). The `binaryBuffer: Buffer` field accumulates raw bytes so the `ZSTD:` header can be detected and the compressed payload extracted without corruption.

2. **TCP delivers data in arbitrary chunks.** A single `ZSTD:1234\n<1234 bytes>\n` response may arrive across multiple `socket.on('data')` events. The buffer accumulator must handle partial reads — return early if the header or payload is incomplete, and process on the next data event.

3. **Backwards compatibility.** When `ZSTD:` is not detected at the start of the buffer, fall through to the existing string-based brace-counting path. This ensures uncompressed connections continue to work.

4. **`fzstd` API.** `decompress(new Uint8Array(buffer))` returns `Uint8Array`. Convert to string with `Buffer.from(result).toString('utf-8')`. The result is the original JSON text.

5. **The `ZSTD:` header and length are ASCII text.** Only the payload bytes after the first `\n` are binary. The trailing `\n` after the payload is also consumed.

6. **Each compressed response is a single complete JSON object.** After decompression, you can call `JSON.parse()` directly — no need for brace-counting on the decompressed output.

---

## Verification

1. `npm install` — installs `fzstd`
2. `npm run build` — compiles without TypeScript errors
3. Connect to a SyndrDB server — compression is negotiated automatically via the connection string
4. Execute a SELECT query — results display correctly (server sends compressed, client decompresses)
5. Test with a server that does NOT have compression — uncompressed JSON responses still parse correctly (backwards compatible)
