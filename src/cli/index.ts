#!/usr/bin/env node

/**
 * Site2Sanity CLI
 * Main entry point
 */

import { Command } from 'commander';
import { startCommand } from './commands/start';
import { initCommand } from './commands/init';
import { crawlCommand } from './commands/crawl';
import { analyzeCommand } from './commands/analyze';
import { mapCommand } from './commands/map';
import { lintCommand } from './commands/lint';
import { exportCommand } from './commands/export';
import { reportCommand } from './commands/report';
import { doctorCommand } from './commands/doctor';
import { cleanupCommand } from './commands/cleanup';
import { projectCommand } from './commands/project';
import { configCommand } from './commands/config';
import { sanityInitCommand } from './commands/sanity-init';

const program = new Command();

program
  .name('s2s')
  .description('Interactive CLI: two-phase website crawling with AI vision analysis to generate Sanity CMS schemas')
  .version('0.1.0');

// Primary interactive command
program.addCommand(startCommand, { isDefault: true });

// Individual commands (for advanced users)
program.addCommand(initCommand);
program.addCommand(crawlCommand);
program.addCommand(analyzeCommand);
program.addCommand(mapCommand);
program.addCommand(lintCommand);
program.addCommand(exportCommand);
program.addCommand(reportCommand);
program.addCommand(doctorCommand);

// Workspace management
program.addCommand(projectCommand);
program.addCommand(cleanupCommand);

// Configuration
program.addCommand(configCommand);

// Sanity project initialization
program.addCommand(sanityInitCommand);

// Parse arguments
program.parse(process.argv);
