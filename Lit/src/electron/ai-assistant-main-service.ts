/**
 * Main process service: HTTP client for the AI Assistant model server.
 * API keys stay in main process; renderer calls via IPC.
 */

import type {
  AIAssistantGenerateRequest,
  AIAssistantGenerateResponse,
  AIAssistantResponseData
} from '../types/electron-api';
import { getAIAssistantApiKey } from './secure-storage';

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Call the model server with the given request. Uses endpoint and requestTimeout
 * from the request (renderer passes from config). API key from secure storage or env.
 */
export async function generateQuery(
  request: AIAssistantGenerateRequest & { endpoint?: string; requestTimeout?: number }
): Promise<AIAssistantGenerateResponse> {
  const endpoint = request.endpoint?.trim() || '';
  const timeoutMs = request.requestTimeout ?? DEFAULT_TIMEOUT_MS;

  if (!endpoint) {
    return { success: false, error: 'AI Assistant endpoint not configured. Set aiAssistant.endpoint in config.' };
  }

  const apiKey = await getAIAssistantApiKey();
  if (!apiKey) {
    return {
      success: false,
      error:
        'AI Assistant API key not set. Set SYNDRDB_AI_ASSISTANT_API_KEY in environment or configure in app settings.'
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: request.prompt,
        schemaContext: request.schemaContext,
        currentDatabase: request.currentDatabase
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Server error ${response.status}: ${text.slice(0, 200)}`
      };
    }

    const data = (await response.json()) as AIAssistantResponseData;
    if (!data || typeof data !== 'object' || !Array.isArray((data as any).statements)) {
      return { success: false, error: 'Invalid response shape: expected { statements: [...] }' };
    }

    return { success: true, data };
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      return { success: false, error: `Request timed out after ${timeoutMs}ms` };
    }
    return { success: false, error: message };
  }
}
