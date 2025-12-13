/**
 * Sanity Init command - Initialize a Sanity Studio project with generated schemas
 *
 * Uses the output from `s2s start` to bootstrap a fully configured Sanity project.
 * Based on Sanity CLI documentation (2025):
 * - https://www.sanity.io/docs/cli-reference/init
 * - https://www.sanity.io/docs/studio/installation
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { Workspace } from '../../utils/workspace';
import { SanityModel } from '../../types';

interface SanityInitOptions {
  dir: string;
  outputPath?: string;
  projectName?: string;
  dataset?: string;
  template?: string;
  skipInit?: boolean;
  typescript?: boolean;
}

/**
 * Check if npm is available
 */
function checkNpmAvailable(): boolean {
  try {
    execSync('npm --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a Sanity project exists at the given path
 */
function isSanityProject(projectPath: string): boolean {
  const sanityConfigTs = path.join(projectPath, 'sanity.config.ts');
  const sanityConfigJs = path.join(projectPath, 'sanity.config.js');
  const sanityJson = path.join(projectPath, 'sanity.json');

  return fs.existsSync(sanityConfigTs) || fs.existsSync(sanityConfigJs) || fs.existsSync(sanityJson);
}

/**
 * Run npm create sanity@latest with the given options
 */
async function runSanityInit(options: {
  outputPath: string;
  projectName?: string;
  dataset?: string;
  template?: string;
  typescript?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const args = ['create', 'sanity@latest', '--'];

    // Add output path
    args.push('--output-path', options.outputPath);

    // Add optional flags
    if (options.projectName) {
      args.push('--create-project', options.projectName);
    }

    if (options.dataset) {
      args.push('--dataset', options.dataset);
    } else {
      args.push('--dataset-default'); // Use 'production' dataset by default
    }

    if (options.template) {
      args.push('--template', options.template);
    } else {
      args.push('--template', 'clean'); // Start with clean template
    }

    // Skip MCP configuration during init (user can configure later)
    args.push('--no-mcp');

    console.log();
    logger.info(`Running: npm ${args.join(' ')}`);
    console.log();
    console.log(chalk.dim('This will open the Sanity CLI wizard...'));
    console.log(chalk.dim('Follow the prompts to create or sign into your Sanity account.\n'));

    const child = spawn('npm', args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      logger.error(`Failed to start Sanity CLI: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Copy generated schema files to the Sanity project
 * Exported for use by the start command
 */
export async function copySchemaFilesToProject(
  sourceDir: string,
  targetProjectPath: string
): Promise<void> {
  const sourceSchemaDir = path.join(sourceDir, 'sanity', 'schemaTypes');
  const targetSchemaDir = path.join(targetProjectPath, 'schemaTypes');

  // Check if source exists
  if (!fs.existsSync(sourceSchemaDir)) {
    throw new Error(`Schema directory not found: ${sourceSchemaDir}`);
  }

  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetSchemaDir)) {
    fs.mkdirSync(targetSchemaDir, { recursive: true });
  }

  // Copy all schema files recursively
  copyDirRecursive(sourceSchemaDir, targetSchemaDir);

  logger.success(`Copied schema files to ${targetSchemaDir}`);
}

/**
 * Recursively copy a directory
 */
function copyDirRecursive(source: string, target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Update sanity.config.ts to use the generated schemas
 * Exported for use by the start command
 */
export async function updateSanityConfigFile(projectPath: string): Promise<void> {
  const configPath = path.join(projectPath, 'sanity.config.ts');
  const configPathJs = path.join(projectPath, 'sanity.config.js');

  let configFile = configPath;
  if (!fs.existsSync(configPath) && fs.existsSync(configPathJs)) {
    configFile = configPathJs;
  }

  if (!fs.existsSync(configFile)) {
    logger.warn('Could not find sanity.config.ts - you may need to manually configure schema imports');
    return;
  }

  let content = fs.readFileSync(configFile, 'utf-8');

  // Check if schemaTypes is already imported
  if (content.includes("from './schemaTypes'") || content.includes('from "./schemaTypes"')) {
    logger.info('Schema import already configured in sanity.config.ts');
    return;
  }

  // Add import for schemaTypes
  const importStatement = "import { schemaTypes } from './schemaTypes'\n";

  // Find the position after existing imports
  const importRegex = /^import .+ from .+$/gm;
  let lastImportIndex = 0;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    lastImportIndex = match.index + match[0].length;
  }

  if (lastImportIndex > 0) {
    content = content.slice(0, lastImportIndex) + '\n' + importStatement + content.slice(lastImportIndex);
  } else {
    content = importStatement + content;
  }

  // Update schema configuration
  // Look for schema: { types: ... } or schema: { types: schemaTypes }
  const schemaTypesRegex = /schema:\s*\{\s*types:\s*\[?\s*\]?\s*\}/;
  const schemaTypesRegex2 = /schema:\s*\{\s*types:\s*schemaTypes\s*\}/;

  if (schemaTypesRegex.test(content)) {
    content = content.replace(schemaTypesRegex, 'schema: { types: schemaTypes }');
  } else if (!schemaTypesRegex2.test(content)) {
    // Try to find schema configuration and update it
    const schemaConfigRegex = /schema:\s*\{/;
    if (schemaConfigRegex.test(content)) {
      content = content.replace(schemaConfigRegex, 'schema: {\n    types: schemaTypes,');
    }
  }

  fs.writeFileSync(configFile, content);
  logger.success('Updated sanity.config.ts with schema imports');
}

/**
 * Generate a summary of what was created
 */
function printSummary(projectPath: string, model: SanityModel): void {
  console.log();
  logger.section('Sanity Studio Created!');

  console.log(chalk.green('✓ Project initialized at:'), projectPath);
  console.log();

  logger.info('Schema types integrated:');
  console.log(`  • ${model.documents.length} document type${model.documents.length !== 1 ? 's' : ''}`);
  console.log(`  • ${model.objects.length} object type${model.objects.length !== 1 ? 's' : ''}`);
  console.log(`  • ${model.blocks.length} block type${model.blocks.length !== 1 ? 's' : ''}`);
  console.log(`  • ${model.singletons.length} singleton${model.singletons.length !== 1 ? 's' : ''}`);
  console.log();

  logger.info('Next steps:');
  console.log(`  1. ${chalk.cyan(`cd ${path.basename(projectPath)}`)}`);
  console.log(`  2. ${chalk.cyan('npm run dev')} - Start Sanity Studio`);
  console.log(`  3. Open ${chalk.cyan('http://localhost:3333')} in your browser`);
  console.log();

  logger.info('Optional:');
  console.log(`  • ${chalk.cyan('sanity deploy')} - Deploy your Studio to the cloud`);
  console.log(`  • ${chalk.cyan('sanity mcp configure')} - Set up AI integrations`);
  console.log(`  • Customize schemas in ${chalk.cyan('schemaTypes/')} directory`);
  console.log();
}

export const sanityInitCommand = new Command('sanity-init')
  .description('Initialize a Sanity Studio project with generated schemas from s2s start')
  .option('-d, --dir <directory>', 'Workspace directory with s2s output', '.site2sanity')
  .option('-o, --output-path <path>', 'Path for the new Sanity project', './studio')
  .option('-n, --project-name <name>', 'Name for the Sanity project')
  .option('--dataset <dataset>', 'Dataset name (default: production)')
  .option('--template <template>', 'Sanity template to use (default: clean)')
  .option('--skip-init', 'Skip Sanity init and only copy schemas to existing project')
  .option('--typescript', 'Use TypeScript (default)', true)
  .action(async (options: SanityInitOptions) => {
    try {
      logger.section('Initialize Sanity Studio');

      // Check npm is available
      if (!checkNpmAvailable()) {
        logger.error('npm is required but not found. Please install Node.js and npm first.');
        process.exit(1);
      }

      // Check workspace exists
      const workspace = new Workspace(options.dir);
      if (!workspace.exists()) {
        logger.error(`Workspace not found at ${options.dir}`);
        logger.info('Run "s2s start" first to analyze a website and generate schemas.');
        process.exit(1);
      }

      // Load the generated model
      const model = await workspace.loadJSON<SanityModel>('model.json');
      if (!model) {
        logger.error('No Sanity model found in workspace.');
        logger.info('Run "s2s start" first and complete the schema generation step.');
        process.exit(1);
      }

      // Check if schema files were exported
      const outDir = path.resolve('out');
      const schemaDir = path.join(outDir, 'sanity', 'schemaTypes');
      if (!fs.existsSync(schemaDir)) {
        logger.error('No exported schema files found.');
        logger.info('Run "s2s start" and choose to export schema files, or run "s2s export".');
        process.exit(1);
      }

      // Display what was found
      logger.info('Found generated schemas:');
      console.log(`  • ${model.documents.length} document types`);
      console.log(`  • ${model.objects.length} object types`);
      console.log(`  • ${model.blocks.length} block types`);
      console.log(`  • ${model.singletons.length} singletons`);
      console.log();

      // Determine output path
      let outputPath = options.outputPath || './studio';

      // Interactive mode if no output path specified
      if (!options.outputPath) {
        const pathAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'outputPath',
            message: 'Where should the Sanity Studio be created?',
            default: './studio',
          },
        ]);
        outputPath = pathAnswer.outputPath;
      }

      outputPath = path.resolve(outputPath);

      // Check if project already exists
      const projectExists = isSanityProject(outputPath);

      if (projectExists && !options.skipInit) {
        const existingAction = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: `A Sanity project already exists at ${outputPath}. What would you like to do?`,
            choices: [
              { name: 'Update schemas only (keep existing project)', value: 'update' },
              { name: 'Start fresh (overwrite existing project)', value: 'overwrite' },
              { name: 'Cancel', value: 'cancel' },
            ],
          },
        ]);

        if (existingAction.action === 'cancel') {
          logger.info('Cancelled.');
          process.exit(0);
        }

        if (existingAction.action === 'update') {
          options.skipInit = true;
        } else {
          // Remove existing project
          fs.rmSync(outputPath, { recursive: true, force: true });
        }
      }

      // Initialize Sanity project (unless skipping)
      if (!options.skipInit) {
        // Get project name if not provided
        let projectName = options.projectName;
        if (!projectName) {
          const nameAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'projectName',
              message: 'What would you like to name your Sanity project?',
              default: path.basename(outputPath),
            },
          ]);
          projectName = nameAnswer.projectName;
        }

        // Ask about dataset
        let dataset = options.dataset;
        if (!dataset) {
          const datasetAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'dataset',
              message: 'Dataset name:',
              default: 'production',
            },
          ]);
          dataset = datasetAnswer.dataset;
        }

        console.log();
        logger.info('Initializing Sanity Studio...');
        logger.info('You may be prompted to log in or create a Sanity account.');
        console.log();

        const success = await runSanityInit({
          outputPath,
          projectName,
          dataset,
          template: options.template || 'clean',
          typescript: options.typescript,
        });

        if (!success) {
          logger.error('Sanity initialization failed.');
          logger.info('You can try running manually: npm create sanity@latest');
          process.exit(1);
        }

        // Wait a moment for files to be written
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Verify project exists
      if (!fs.existsSync(outputPath)) {
        logger.error(`Project directory not found: ${outputPath}`);
        process.exit(1);
      }

      // Copy schema files
      logger.startSpinner('Integrating generated schemas...');

      try {
        await copySchemaFilesToProject(outDir, outputPath);
        await updateSanityConfigFile(outputPath);
        logger.succeedSpinner('Schemas integrated successfully!');
      } catch (error) {
        logger.failSpinner(`Failed to integrate schemas: ${(error as Error).message}`);
        process.exit(1);
      }

      // Print summary
      printSummary(outputPath, model);

    } catch (error) {
      logger.error(`Failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });
