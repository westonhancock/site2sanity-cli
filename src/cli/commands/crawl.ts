/**
 * Crawl command - Crawl the website
 *
 * Supports --json flag for AI-agent friendly output
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { Crawler } from '../../core/crawler';
import { logger } from '../../utils/logger';
import {
  createOutput,
  ErrorCode,
  ErrorResponses,
  CrawlResponseData,
} from '../../utils/output';

export const crawlCommand = new Command('crawl')
  .description('Crawl the website and collect pages')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--render', 'Use headless browser for JavaScript-heavy sites')
  .option('--screenshot <mode>', 'Capture screenshots: none, aboveFold, fullPage', 'none')
  .option('--max-pages <number>', 'Override max pages from config')
  .option('--max-depth <number>', 'Override max depth from config')
  .option('--exclude-paths <patterns>', 'Comma-separated URL path patterns to exclude (e.g., "/admin/*,/api/*")')
  .option('--follow-subdomains', 'Follow links to subdomains')
  .option('--allowed-subdomains <subdomains>', 'Comma-separated list of specific subdomains to follow (e.g., "blog,docs")')
  .option('--resume', 'Resume previous crawl')
  .option('--json', 'Output results as JSON (for AI agents)')
  .action(async (options: any) => {
    const output = createOutput(options);
    const startTime = Date.now();

    try {
      const workspace = new Workspace(options.dir);

      if (!workspace.exists()) {
        if (output.isJsonMode()) {
          output.error(
            ErrorCode.WORKSPACE_NOT_FOUND,
            'Workspace not initialized',
            ErrorResponses.workspaceNotFound(options.dir)
          );
          process.exit(1);
        }
        logger.error('Workspace not initialized. Run "s2s init <url>" first.');
        process.exit(1);
      }

      // Load config
      const config = await workspace.loadConfig();

      // Override config with CLI options
      if (options.render !== undefined) {
        config.crawl.render = options.render;
      }
      if (options.screenshot) {
        config.crawl.screenshot = options.screenshot as any;
      }
      if (options.maxPages) {
        config.crawl.maxPages = parseInt(options.maxPages);
      }
      if (options.maxDepth) {
        config.crawl.maxDepth = parseInt(options.maxDepth);
      }
      if (options.excludePaths) {
        const paths = options.excludePaths
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        config.crawl.excludePaths = paths;
        logger.info(`Excluding paths: ${paths.join(', ')}`);
      }
      if (options.followSubdomains) {
        config.crawl.followSubdomains = true;
      }
      if (options.allowedSubdomains) {
        config.crawl.followSubdomains = true; // Implicitly enable
        const subdomains = options.allowedSubdomains
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        config.crawl.allowedSubdomains = subdomains;
        logger.info(`Following subdomains: ${subdomains.join(', ')}`);
      }

      if (!output.isJsonMode()) {
        logger.section('Crawling Website');
      }

      // Initialize database
      const db = new CrawlDatabase(workspace.getPath());

      if (!options.resume) {
        if (!output.isJsonMode()) {
          logger.info('Starting fresh crawl (clearing previous data)');
        }
        db.clear();
      } else {
        const existingPages = db.getPageCount();
        if (existingPages > 0 && !output.isJsonMode()) {
          logger.info(`Resuming crawl (${existingPages} pages already crawled)`);
        }
      }

      // Create run directory
      const runDir = workspace.createRun();
      if (!output.isJsonMode()) {
        logger.info(`Run directory: ${runDir}`);
        logger.startSpinner('Crawling...');
      }

      // Start crawler
      const crawler = new Crawler(config.baseUrl, config.crawl, db);
      await crawler.crawl();

      // Save crawl metadata
      db.setMetadata('lastCrawl', new Date().toISOString());
      db.setMetadata('crawlConfig', config.crawl);

      const pageCount = db.getPageCount();
      const successfulPages = db.getPagesByStatus(200).length;
      const duration = Date.now() - startTime;

      db.close();

      // Output results
      if (output.isJsonMode()) {
        const responseData: CrawlResponseData = {
          workspace: workspace.getPath(),
          baseUrl: config.baseUrl,
          stats: {
            totalPages: pageCount,
            successfulPages: successfulPages,
            errorPages: pageCount - successfulPages,
            duration,
          },
        };
        output.success(responseData);
      } else {
        logger.succeedSpinner('Crawl completed!');
        logger.section('Crawl Summary');
        logger.info(`Total pages: ${pageCount}`);
        logger.info(`Successful (200): ${successfulPages}`);
        logger.info(`Errors: ${pageCount - successfulPages}`);

        logger.success('Crawl completed!');
        console.log();
        logger.info('Next steps:');
        console.log('  1. Run "s2s analyze" to analyze the crawl data');
        console.log('  2. Run "s2s report" to view crawl statistics');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (output.isJsonMode()) {
        output.error(ErrorCode.CRAWL_FAILED, 'Crawl failed', {
          details: errorMessage,
          recoverable: true,
          suggestion: 'Check network connectivity and URL validity',
        });
      } else {
        logger.error(`Crawl failed: ${errorMessage}`);
        if (process.env.DEBUG) {
          console.error(error);
        }
      }
      process.exit(1);
    }
  });
