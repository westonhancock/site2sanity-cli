/**
 * Secrets Manager - Securely store and retrieve API keys
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SECRETS_DIR = path.join(os.homedir(), '.site2sanity');
const SECRETS_FILE = path.join(SECRETS_DIR, 'secrets.json');

interface Secrets {
  anthropicApiKey?: string;
  openaiApiKey?: string;
}

export class SecretsManager {
  /**
   * Get an API key (checks env vars first, then stored secrets)
   */
  static getApiKey(provider: 'anthropic' | 'openai'): string | null {
    // Check environment variables first
    if (provider === 'anthropic') {
      const envKey = process.env.ANTHROPIC_API_KEY;
      if (envKey) return envKey;
    } else if (provider === 'openai') {
      const envKey = process.env.OPENAI_API_KEY;
      if (envKey) return envKey;
    }

    // Check stored secrets
    const secrets = this.loadSecrets();
    if (provider === 'anthropic') {
      return secrets.anthropicApiKey || null;
    } else if (provider === 'openai') {
      return secrets.openaiApiKey || null;
    }

    return null;
  }

  /**
   * Store an API key securely
   */
  static setApiKey(provider: 'anthropic' | 'openai', apiKey: string): void {
    const secrets = this.loadSecrets();

    if (provider === 'anthropic') {
      secrets.anthropicApiKey = apiKey;
    } else if (provider === 'openai') {
      secrets.openaiApiKey = apiKey;
    }

    this.saveSecrets(secrets);
  }

  /**
   * Delete an API key
   */
  static deleteApiKey(provider: 'anthropic' | 'openai'): void {
    const secrets = this.loadSecrets();

    if (provider === 'anthropic') {
      delete secrets.anthropicApiKey;
    } else if (provider === 'openai') {
      delete secrets.openaiApiKey;
    }

    this.saveSecrets(secrets);
  }

  /**
   * Check if an API key is stored
   */
  static hasApiKey(provider: 'anthropic' | 'openai'): boolean {
    return this.getApiKey(provider) !== null;
  }

  /**
   * List all stored secrets (masked)
   */
  static listSecrets(): { provider: string; keyPreview: string }[] {
    const secrets = this.loadSecrets();
    const result: { provider: string; keyPreview: string }[] = [];

    if (process.env.ANTHROPIC_API_KEY) {
      result.push({
        provider: 'anthropic',
        keyPreview: this.maskKey(process.env.ANTHROPIC_API_KEY) + ' (env)',
      });
    } else if (secrets.anthropicApiKey) {
      result.push({
        provider: 'anthropic',
        keyPreview: this.maskKey(secrets.anthropicApiKey) + ' (stored)',
      });
    }

    if (process.env.OPENAI_API_KEY) {
      result.push({
        provider: 'openai',
        keyPreview: this.maskKey(process.env.OPENAI_API_KEY) + ' (env)',
      });
    } else if (secrets.openaiApiKey) {
      result.push({
        provider: 'openai',
        keyPreview: this.maskKey(secrets.openaiApiKey) + ' (stored)',
      });
    }

    return result;
  }

  /**
   * Load secrets from file
   */
  private static loadSecrets(): Secrets {
    if (!fs.existsSync(SECRETS_FILE)) {
      return {};
    }

    try {
      const data = fs.readFileSync(SECRETS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  /**
   * Save secrets to file
   */
  private static saveSecrets(secrets: Secrets): void {
    // Ensure directory exists
    if (!fs.existsSync(SECRETS_DIR)) {
      fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
    }

    // Write secrets with restricted permissions
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), {
      mode: 0o600, // Read/write for owner only
    });
  }

  /**
   * Mask API key for display
   */
  private static maskKey(key: string): string {
    if (key.length <= 8) return '***';
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
  }

  /**
   * Clear all secrets
   */
  static clearAll(): void {
    if (fs.existsSync(SECRETS_FILE)) {
      fs.unlinkSync(SECRETS_FILE);
    }
  }
}
