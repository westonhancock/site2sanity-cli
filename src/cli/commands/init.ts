/**
 * Init command - Initialize a new site2sanity project
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { isValidUrl, normalizeUrl } from '../../utils/url';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';

export const initCommand = new Command('init')
  .description('Initialize a new s2s project')
  .argument('<url>', 'Base URL of the site to analyze')
  .option('-d, --dir <directory>', 'Global workspace directory', '~/.s2s')
  .option('--max-pages <number>', 'Maximum pages to crawl', '1000000')
  .option('--max-depth <number>', 'Maximum crawl depth', '100')
  .option('--exclude-paths <patterns>', 'Comma-separated URL path patterns to exclude (e.g., "/admin/*,/api/*")')
  .option('--follow-subdomains', 'Follow links to subdomains')
  .option('--allowed-subdomains <subdomains>', 'Comma-separated list of specific subdomains to follow (e.g., "blog,docs")')
  .option('--overwrite', 'Overwrite existing crawl data for this URL')
  .action(async (url: string, options: any) => {
    try {
      logger.section('Initializing site2sanity project');

      // Validate URL
      if (!isValidUrl(url)) {
        logger.error(`Invalid URL: ${url}`);
        process.exit(1);
      }

      const baseUrl = normalizeUrl(url);
      logger.info(`Base URL: ${baseUrl}`);

      // Initialize workspace
      const workspace = new Workspace(options.dir);

      // Check if crawl already exists for this URL
      const existingCrawl = workspace.checkExistingCrawl(baseUrl);

      if (existingCrawl.exists && !options.overwrite) {
        logger.warn(`A crawl already exists for ${baseUrl}`);
        logger.info(`Location: ${existingCrawl.path}`);

        const { proceed } = await inquirer.prompt([
          {
            type: 'list',
            name: 'proceed',
            message: 'What would you like to do?',
            choices: [
              { name: 'Overwrite existing crawl data', value: 'overwrite' },
              { name: 'Cancel', value: 'cancel' },
            ],
          },
        ]);

        if (proceed === 'cancel') {
          logger.info('Initialization cancelled');
          process.exit(0);
        }
      }

      logger.startSpinner('Creating workspace structure...');

      // Set URL for workspace (creates URL-based subdirectory)
      workspace.setUrl(baseUrl);

      // Parse exclude paths if provided
      const excludePaths = options.excludePaths
        ? options.excludePaths.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        : [];

      // Parse allowed subdomains if provided
      const allowedSubdomains = options.allowedSubdomains
        ? options.allowedSubdomains.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        : [];

      await workspace.init(baseUrl, {
        crawl: {
          maxPages: parseInt(options.maxPages),
          maxDepth: parseInt(options.maxDepth),
          include: [],
          exclude: [],
          excludePaths,
          followSubdomains: options.followSubdomains || allowedSubdomains.length > 0,
          allowedSubdomains,
          render: false,
          screenshot: 'none',
          throttle: 100,
          concurrency: 5,
          respectRobots: true,
        },
      } as any);

      if (excludePaths.length > 0) {
        logger.info(`Excluding paths: ${excludePaths.join(', ')}`);
      }
      if (allowedSubdomains.length > 0) {
        logger.info(`Following subdomains: ${allowedSubdomains.join(', ')}`);
      }

      logger.succeedSpinner('Workspace created');

      // Show next steps
      logger.success('Project initialized successfully!');
      console.log();
      logger.info(`Workspace created at: ${workspace.getPath()}`);
      console.log();
      logger.info('Next steps:');
      console.log('  1. Run "s2s crawl" to start crawling the site');
      console.log('  2. Run "s2s analyze" to analyze the crawl data');
      console.log('  3. Run "s2s map" to create Sanity schema interactively');
      console.log('  4. Run "s2s export" to generate Sanity artifacts');
      console.log();

    } catch (error) {
      logger.error(`Failed to initialize project: ${(error as Error).message}`);
      process.exit(1);
    }
  });
