/**
 * AI Assistant Service — renderer singleton. Orchestrates prompt → IPC → compile → validate.
 */

import type { ElectronAPI, AIAssistantGenerateRequest } from '../types/electron-api';
import { compileAIResponse } from '../domain/syndrql-compiler.js';
import { LanguageServiceV2 } from '../components/code-editor/syndrQL-language-serviceV2/index.js';
import { DEFAULT_CONFIG } from '../config/config-types.js';

export interface AIGenerateResult {
  syndrql: string;
  explanation?: string;
  valid: boolean;
  errors?: Array<{ message: string }>;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export class AIAssistantService {
  private static instance: AIAssistantService;

  private constructor() {}

  static getInstance(): AIAssistantService {
    if (!AIAssistantService.instance) {
      AIAssistantService.instance = new AIAssistantService();
    }
    return AIAssistantService.instance;
  }

  /**
   * Generate SyndrQL from natural language. Serializes schema, calls main process, compiles IR, validates.
   */
  async generate(
    prompt: string,
    schemaContext: unknown,
    currentDatabase: string,
    endpoint?: string,
    requestTimeout?: number
  ): Promise<AIGenerateResult> {
    const api = window.electronAPI?.aiAssistant;
    if (!api) {
      return {
        syndrql: '',
        valid: false,
        error: 'AI Assistant not available (missing IPC).'
      };
    }

    const request: AIAssistantGenerateRequest = {
      prompt,
      schemaContext,
      currentDatabase,
      endpoint,
      requestTimeout
    };

    const response = await api.generateQuery(request);

    if (!response.success) {
      return {
        syndrql: '',
        valid: false,
        error: response.error
      };
    }

    const data = response.data;
    let syndrql: string;
    try {
      syndrql = compileAIResponse(data as import('../domain/ai-ir-schema').AIAssistantResponse);
    } catch (err) {
      return {
        syndrql: '',
        valid: false,
        error: err instanceof Error ? err.message : 'Compilation failed.'
      };
    }

    let valid = false;
    let errors: Array<{ message: string }> = [];

    try {
      const lang = new LanguageServiceV2(DEFAULT_CONFIG);
      await lang.initialize();
      lang.loadContextFromCache(schemaContext as Partial<import('../components/code-editor/syndrQL-language-serviceV2/document-context').CachedContextData>);
      if (currentDatabase) {
        lang.setCurrentDatabase(currentDatabase);
      }
      const validation = await lang.validate(syndrql);
      valid = validation.valid;
      errors = validation.errors.map((e) => ({ message: e.message }));
    } catch {
      valid = false;
      errors = [{ message: 'Validation failed.' }];
    }

    return {
      syndrql,
      explanation: data.explanation,
      valid,
      errors: errors.length ? errors : undefined
    };
  }
}
