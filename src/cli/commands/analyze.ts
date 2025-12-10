/**
 * Analyze command - Analyze crawl data
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { Analyzer } from '../../core/analyzer';
import { logger } from '../../utils/logger';

export const analyzeCommand = new Command('analyze')
  .description('Analyze crawl data to detect IA, page types, and relationships')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .action(async (options: any) => {
    try {
      const workspace = new Workspace(options.dir);

      if (!workspace.exists()) {
        logger.error('Workspace not initialized. Run "s2s init <url>" first.');
        process.exit(1);
      }

      const config = await workspace.loadConfig();
      const db = new CrawlDatabase(workspace.getPath());

      const pages = db.getAllPages();

      if (pages.length === 0) {
        logger.error('No pages found. Run "s2s crawl" first.');
        process.exit(1);
      }

      logger.section('Analyzing Site');
      logger.info(`Analyzing ${pages.length} pages...`);

      const analyzer = new Analyzer(pages);

      // Analyze navigation
      logger.startSpinner('Analyzing navigation structure...');
      const navigation = analyzer.analyzeNavigation();
      await workspace.saveJSON('navigation.json', navigation);
      logger.succeedSpinner(`Found ${navigation.primaryNav.length} primary nav items`);

      // Detect page types
      logger.startSpinner('Detecting page types...');
      const pageTypes = analyzer.detectPageTypes(
        config.analyze.clusteringThreshold,
        config.analyze.maxClusters
      );
      await workspace.saveJSON('pageTypes.json', pageTypes);
      logger.succeedSpinner(`Detected ${pageTypes.length} page types`);

      // Detect relationships
      logger.startSpinner('Detecting relationships...');
      const relationships = analyzer.detectRelationships(pageTypes);
      await workspace.saveJSON('relationships.json', relationships);
      logger.succeedSpinner(`Found ${relationships.length} relationships`);

      // Display summary
      logger.section('Analysis Summary');

      logger.info('Navigation:');
      console.log(`  Primary nav items: ${navigation.primaryNav.length}`);
      console.log(`  Footer items: ${navigation.footer.length}`);
      console.log(`  Breadcrumb patterns: ${navigation.breadcrumbs.length}`);
      console.log();

      logger.info('Page Types:');
      pageTypes.slice(0, 10).forEach(pt => {
        console.log(`  ${pt.name} (${pt.pageCount} pages, ${(pt.confidence * 100).toFixed(0)}% confidence)`);
      });
      console.log();

      logger.info('Relationships:');
      relationships.forEach(rel => {
        console.log(`  ${rel.type}: ${rel.description}`);
      });
      console.log();

      logger.success('Analysis completed!');
      console.log();
      logger.info('Next steps:');
      console.log('  1. Run "s2s report" to view detailed report');
      console.log('  2. Run "s2s map" to create Sanity schema interactively');

      db.close();
    } catch (error) {
      logger.error(`Analysis failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });
