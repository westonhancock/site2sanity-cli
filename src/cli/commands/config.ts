/**
 * Config command - Manage API keys and secrets
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { SecretsManager } from '../../utils/secrets';
import { logger } from '../../utils/logger';
import chalk from 'chalk';

export const configCommand = new Command('config')
  .description('Manage API keys for AI-powered analysis (Anthropic Claude, OpenAI)')
  .action(async () => {
    try {
      logger.section('Configuration');

      const action = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Set API key', value: 'set' },
            { name: 'View stored API keys', value: 'list' },
            { name: 'Delete API key', value: 'delete' },
            { name: 'Clear all secrets', value: 'clear' },
            { name: 'Exit', value: 'exit' },
          ],
        },
      ]);

      if (action.action === 'exit') {
        return;
      }

      if (action.action === 'set') {
        await setApiKey();
      } else if (action.action === 'list') {
        listApiKeys();
      } else if (action.action === 'delete') {
        await deleteApiKey();
      } else if (action.action === 'clear') {
        await clearAllSecrets();
      }
    } catch (error) {
      logger.error(`Configuration failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

/**
 * Set an API key
 */
async function setApiKey(): Promise<void> {
  const provider = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which provider?',
      choices: [
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
      ],
    },
  ]);

  const keyPrompt = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key:`,
      validate: (input) => {
        if (!input) return 'API key is required';
        if (provider.provider === 'anthropic' && !input.startsWith('sk-ant-')) {
          return 'Anthropic API keys start with sk-ant-';
        }
        if (provider.provider === 'openai' && !input.startsWith('sk-')) {
          return 'OpenAI API keys start with sk-';
        }
        return true;
      },
    },
  ]);

  SecretsManager.setApiKey(provider.provider, keyPrompt.apiKey);
  logger.success(`${provider.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key stored securely`);
  console.log(chalk.dim(`Stored in: ~/.site2sanity/secrets.json`));
}

/**
 * List stored API keys
 */
function listApiKeys(): void {
  const secrets = SecretsManager.listSecrets();

  if (secrets.length === 0) {
    console.log(chalk.yellow('\nNo API keys configured'));
    console.log('\nYou can set API keys by:');
    console.log('  • Running: s2s config');
    console.log('  • Setting environment variables: ANTHROPIC_API_KEY or OPENAI_API_KEY');
    return;
  }

  console.log('\nConfigured API keys:');
  for (const secret of secrets) {
    console.log(`  ${chalk.bold(secret.provider)}: ${chalk.dim(secret.keyPreview)}`);
  }
  console.log();
}

/**
 * Delete an API key
 */
async function deleteApiKey(): Promise<void> {
  const secrets = SecretsManager.listSecrets();

  if (secrets.length === 0) {
    logger.warn('No API keys configured');
    return;
  }

  const provider = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which API key would you like to delete?',
      choices: secrets.map(s => ({
        name: `${s.provider} (${s.keyPreview})`,
        value: s.provider,
      })),
    },
  ]);

  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete the ${provider.provider} API key?`,
      default: false,
    },
  ]);

  if (confirm.confirm) {
    SecretsManager.deleteApiKey(provider.provider);
    logger.success(`${provider.provider} API key deleted`);
  }
}

/**
 * Clear all secrets
 */
async function clearAllSecrets(): Promise<void> {
  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to delete ALL API keys?',
      default: false,
    },
  ]);

  if (confirm.confirm) {
    SecretsManager.clearAll();
    logger.success('All secrets cleared');
  }
}
