/**
 * Crawl command - Crawl the website
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { Crawler } from '../../core/crawler';
import { logger } from '../../utils/logger';

export const crawlCommand = new Command('crawl')
  .description('Crawl the website and collect pages')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--render', 'Use headless browser for JavaScript-heavy sites')
  .option('--screenshot <mode>', 'Capture screenshots: none, aboveFold, fullPage', 'none')
  .option('--max-pages <number>', 'Override max pages from config')
  .option('--max-depth <number>', 'Override max depth from config')
  .option('--resume', 'Resume previous crawl')
  .action(async (options: any) => {
    try {
      const workspace = new Workspace(options.dir);

      if (!workspace.exists()) {
        logger.error('Workspace not initialized. Run "site2sanity init <url>" first.');
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

      logger.section('Crawling Website');

      // Initialize database
      const db = new CrawlDatabase(workspace.getPath());

      if (!options.resume) {
        logger.info('Starting fresh crawl (clearing previous data)');
        db.clear();
      } else {
        const existingPages = db.getPageCount();
        if (existingPages > 0) {
          logger.info(`Resuming crawl (${existingPages} pages already crawled)`);
        }
      }

      // Create run directory
      const runDir = workspace.createRun();
      logger.info(`Run directory: ${runDir}`);

      // Start crawler
      logger.startSpinner('Crawling...');

      const crawler = new Crawler(config.baseUrl, config.crawl, db);
      await crawler.crawl();

      // Save crawl metadata
      db.setMetadata('lastCrawl', new Date().toISOString());
      db.setMetadata('crawlConfig', config.crawl);

      const pageCount = db.getPageCount();
      const successfulPages = db.getPagesByStatus(200).length;

      logger.section('Crawl Summary');
      logger.info(`Total pages: ${pageCount}`);
      logger.info(`Successful (200): ${successfulPages}`);
      logger.info(`Errors: ${pageCount - successfulPages}`);

      logger.success('Crawl completed!');
      console.log();
      logger.info('Next steps:');
      console.log('  1. Run "site2sanity analyze" to analyze the crawl data');
      console.log('  2. Run "site2sanity report" to view crawl statistics');

      db.close();
    } catch (error) {
      logger.error(`Crawl failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });
