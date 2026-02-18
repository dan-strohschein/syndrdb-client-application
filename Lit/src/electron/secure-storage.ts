/**
 * OS-agnostic secure storage for the AI Assistant API key.
 * Main process only. Uses Electron safeStorage (macOS Keychain, Windows DPAPI, Linux libsecret)
 * with fallback to a file in userData when keychain is unavailable.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { app, safeStorage } from 'electron';

const ENV_OVERRIDE = 'SYNDRDB_AI_ASSISTANT_API_KEY';
const FILE_NAME = 'ai-assistant-api-key.enc';

/**
 * Dev override: if set, return without touching disk/keychain.
 */
export async function getAIAssistantApiKey(): Promise<string | null> {
  const envKey = process.env[ENV_OVERRIDE];
  if (envKey && envKey.trim() !== '') {
    return envKey.trim();
  }

  try {
    const { filePath, useEncryption } = getStoragePathAndMode();
    const exists = await fileExists(filePath);
    if (!exists) {
      return null;
    }

    const raw = await fs.readFile(filePath);
    if (useEncryption) {
      return safeStorage.decryptString(raw as unknown as Buffer);
    }
    // Fallback: plaintext file (with limitation documented in ADD-AI-CHAT)
    return raw.toString('utf-8').trim() || null;
  } catch (err) {
    console.warn('Failed to read AI assistant API key:', err);
    return null;
  }
}

/**
 * Persist API key. Uses safeStorage when available, otherwise plaintext in userData.
 */
export async function setAIAssistantApiKey(value: string): Promise<void> {
  const { filePath, useEncryption } = getStoragePathAndMode();

  if (useEncryption) {
    const encrypted = safeStorage.encryptString(value);
    await fs.writeFile(filePath, encrypted);
  } else {
    console.warn(
      'AI Assistant API key will be stored in plaintext in userData (keychain unavailable). ' +
        'Consider setting SYNDRDB_AI_ASSISTANT_API_KEY in environment for development.'
    );
    await fs.writeFile(filePath, value, 'utf-8');
  }
}

function getStoragePathAndMode(): { filePath: string; useEncryption: boolean } {
  const userDataPath = app.getPath('userData');
  const filePath = join(userDataPath, FILE_NAME);
  let useEncryption = false;
  try {
    useEncryption = safeStorage.isEncryptionAvailable();
  } catch {
    // safeStorage not available (e.g. Linux without secret service)
  }
  return { filePath, useEncryption };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
