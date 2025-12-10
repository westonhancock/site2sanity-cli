/**
 * Cleanup command - Remove workspace and export directories
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export const cleanupCommand = new Command('cleanup')
  .description('Remove workspace and export directories')
  .option('-d, --dir <directory>', 'Workspace directory to remove', '.site2sanity')
  .option('-o, --out <directory>', 'Output directory to remove', 'out')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options: any) => {
    try {
      const workspace = new Workspace(options.dir);
      const outDir = path.resolve(options.out);

      // Check what exists
      const workspaceExists = workspace.exists();
      const outDirExists = await fs.access(outDir).then(() => true).catch(() => false);

      if (!workspaceExists && !outDirExists) {
        logger.info('Nothing to clean up - directories do not exist');
        return;
      }

      // Show what will be removed
      console.log();
      logger.section('Cleanup');

      if (workspaceExists) {
        console.log(`  Will remove: ${workspace.getPath()}`);
      }

      if (outDirExists) {
        console.log(`  Will remove: ${outDir}`);
      }

      // Confirm
      if (!options.yes) {
        const confirm = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Are you sure you want to delete these directories?',
            default: false,
          },
        ]);

        if (!confirm.proceed) {
          logger.info('Cleanup cancelled');
          return;
        }
      }

      // Remove directories
      console.log();

      if (workspaceExists) {
        logger.startSpinner(`Removing ${workspace.getPath()}...`);
        await fs.rm(workspace.getPath(), { recursive: true, force: true });
        logger.succeedSpinner(`Removed workspace directory`);
      }

      if (outDirExists) {
        logger.startSpinner(`Removing ${outDir}...`);
        await fs.rm(outDir, { recursive: true, force: true });
        logger.succeedSpinner(`Removed export directory`);
      }

      console.log();
      logger.success('Cleanup complete!');
    } catch (error) {
      logger.error(`Cleanup failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });
