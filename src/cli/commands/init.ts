/**
 * Init command - Initialize a new site2sanity project
 */

import { Command } from 'commander';
import { isValidUrl, normalizeUrl } from '../../utils/url';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';

export const initCommand = new Command('init')
  .description('Initialize a new s2s project')
  .argument('<url>', 'Base URL of the site to analyze')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--max-pages <number>', 'Maximum pages to crawl', '1000')
  .option('--max-depth <number>', 'Maximum crawl depth', '10')
  .option('--exclude-paths <patterns>', 'Comma-separated URL path patterns to exclude (e.g., "/admin/*,/api/*")')
  .option('--follow-subdomains', 'Follow links to subdomains')
  .option('--allowed-subdomains <subdomains>', 'Comma-separated list of specific subdomains to follow (e.g., "blog,docs")')
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
      logger.startSpinner('Creating workspace structure...');

      const workspace = new Workspace(options.dir);

      if (workspace.exists()) {
        logger.failSpinner('Workspace already exists');
        logger.warn(`A workspace already exists at ${options.dir}`);
        logger.info('Use a different directory with --dir or remove the existing workspace');
        process.exit(1);
      }

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
      logger.info('Next steps:');
      console.log('  1. Run "s2s crawl" to start crawling the site');
      console.log('  2. Run "s2s analyze" to analyze the crawl data');
      console.log('  3. Run "s2s map" to create Sanity schema interactively');
      console.log('  4. Run "s2s export" to generate Sanity artifacts');
      console.log();
      logger.info('Configuration saved to: ' + options.dir + '/config.json');

    } catch (error) {
      logger.error(`Failed to initialize project: ${(error as Error).message}`);
      process.exit(1);
    }
  });
