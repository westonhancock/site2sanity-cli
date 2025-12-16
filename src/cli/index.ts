#!/usr/bin/env node

/**
 * Site2Sanity CLI
 * Main entry point
 *
 * Supports both interactive mode (default) and non-interactive mode
 * for AI agents via --json flag on individual commands.
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
import { statusCommand } from './commands/status';
import { listCommand } from './commands/list';

const program = new Command();

const description = `Interactive CLI: crawl websites and generate Sanity CMS schemas

HUMAN USERS:
  Run 's2s <url>' for the interactive workflow that guides you through
  crawling, analysis, and schema generation.

AI AGENTS (Claude Code, Cursor, Copilot, etc.):
  Use individual commands with --json flag for structured output:

  RECOMMENDED WORKFLOW:
    1. s2s init <url>                    # Initialize workspace
    2. s2s crawl --json                  # Crawl site, get stats
    3. s2s analyze --json                # Detect page types
    4. s2s status --json                 # Check progress
    5. s2s list page-types --json        # Inspect detected types
    6. s2s export --types a,b --json     # Export specific types

  JSON OUTPUT FORMAT:
    Success: {"success": true, "data": {...}}
    Error:   {"success": false, "error": {"code": "...", "suggestion": "..."}}

  COMMANDS WITH --json SUPPORT:
    crawl, analyze, export, status, list

  QUERY COMMANDS (for inspecting state):
    s2s status --json                    # Workspace phase status
    s2s list page-types --json           # Detected page types
    s2s list objects --json              # Detected objects
    s2s list blocks --json               # AI-detected blocks
    s2s list documents --json            # Schema model contents`;

program
  .name('s2s')
  .description(description)
  .version('0.1.0');

// Primary interactive command
program.addCommand(startCommand, { isDefault: true });

// Individual commands (for advanced users and AI agents)
program.addCommand(initCommand);
program.addCommand(crawlCommand);
program.addCommand(analyzeCommand);
program.addCommand(mapCommand);
program.addCommand(lintCommand);
program.addCommand(exportCommand);
program.addCommand(reportCommand);
program.addCommand(doctorCommand);

// AI-agent friendly introspection commands
program.addCommand(statusCommand);
program.addCommand(listCommand);

// Workspace management
program.addCommand(projectCommand);
program.addCommand(cleanupCommand);

// Configuration
program.addCommand(configCommand);

// Sanity project initialization
program.addCommand(sanityInitCommand);

// Parse arguments
program.parse(process.argv);
