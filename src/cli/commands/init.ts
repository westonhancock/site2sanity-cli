/**
 * Init command - Initialize a new site2sanity project
 */

import { Command } from 'commander';
import { isValidUrl, normalizeUrl } from '../../utils/url';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';

export const initCommand = new Command('init')
  .description('Initialize a new site2sanity project')
  .argument('<url>', 'Base URL of the site to analyze')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--max-pages <number>', 'Maximum pages to crawl', '1000')
  .option('--max-depth <number>', 'Maximum crawl depth', '10')
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

      await workspace.init(baseUrl, {
        crawl: {
          maxPages: parseInt(options.maxPages),
          maxDepth: parseInt(options.maxDepth),
          include: [],
          exclude: [],
          render: false,
          screenshot: 'none',
          throttle: 100,
          concurrency: 5,
          respectRobots: true,
        },
      } as any);

      logger.succeedSpinner('Workspace created');

      // Show next steps
      logger.success('Project initialized successfully!');
      console.log();
      logger.info('Next steps:');
      console.log('  1. Run "site2sanity crawl" to start crawling the site');
      console.log('  2. Run "site2sanity analyze" to analyze the crawl data');
      console.log('  3. Run "site2sanity map" to create Sanity schema interactively');
      console.log('  4. Run "site2sanity export" to generate Sanity artifacts');
      console.log();
      logger.info('Configuration saved to: ' + options.dir + '/config.json');

    } catch (error) {
      logger.error(`Failed to initialize project: ${(error as Error).message}`);
      process.exit(1);
    }
  });
