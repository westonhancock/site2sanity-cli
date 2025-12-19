/**
 * Analyze command - Analyze crawl data
 *
 * Supports --json flag for AI-agent friendly output
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { Analyzer } from '../../core/analyzer';
import { logger } from '../../utils/logger';
import {
  createOutput,
  ErrorCode,
  ErrorResponses,
  AnalyzeResponseData,
} from '../../utils/output';

export const analyzeCommand = new Command('analyze')
  .description('Analyze crawl data to detect page types, objects, and relationships (supports --json for AI agents)')
  .option('-d, --dir <directory>', 'Global workspace directory', '~/.s2s')
  .option('--json', 'Output results as JSON (for AI agents)')
  .action(async (options: any) => {
    const output = createOutput(options);

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

      const config = await workspace.loadConfig();
      const db = new CrawlDatabase(workspace.getPath());

      const pages = db.getAllPages();

      if (pages.length === 0) {
        if (output.isJsonMode()) {
          output.error(
            ErrorCode.NO_PAGES_FOUND,
            'No pages found',
            ErrorResponses.noPagesFound()
          );
          process.exit(1);
        }
        logger.error('No pages found. Run "s2s crawl" first.');
        process.exit(1);
      }

      if (!output.isJsonMode()) {
        logger.section('Analyzing Site');
        logger.info(`Analyzing ${pages.length} pages...`);
      }

      const analyzer = new Analyzer(pages);

      // Analyze navigation
      if (!output.isJsonMode()) {
        logger.startSpinner('Analyzing navigation structure...');
      }
      const navigation = analyzer.analyzeNavigation();
      await workspace.saveJSON('navigation.json', navigation);
      if (!output.isJsonMode()) {
        logger.succeedSpinner(`Found ${navigation.primaryNav.length} primary nav items`);
      }

      // Detect page types
      if (!output.isJsonMode()) {
        logger.startSpinner('Detecting page types...');
      }
      const pageTypes = analyzer.detectPageTypes(
        config.analyze.clusteringThreshold,
        config.analyze.maxClusters
      );
      await workspace.saveJSON('pageTypes.json', pageTypes);
      if (!output.isJsonMode()) {
        logger.succeedSpinner(`Detected ${pageTypes.length} page types`);
      }

      // Detect relationships
      if (!output.isJsonMode()) {
        logger.startSpinner('Detecting relationships...');
      }
      const relationships = analyzer.detectRelationships(pageTypes);
      await workspace.saveJSON('relationships.json', relationships);
      if (!output.isJsonMode()) {
        logger.succeedSpinner(`Found ${relationships.length} relationships`);
      }

      // Detect objects
      if (!output.isJsonMode()) {
        logger.startSpinner('Detecting content objects...');
      }
      const detectedObjects = await analyzer.detectObjects();
      await workspace.saveJSON('objects.json', detectedObjects);
      if (!output.isJsonMode()) {
        logger.succeedSpinner(`Found ${detectedObjects.length} reusable object types`);
      }

      db.close();

      // Output results
      if (output.isJsonMode()) {
        const responseData: AnalyzeResponseData = {
          workspace: workspace.getPath(),
          stats: {
            pagesAnalyzed: pages.length,
            pageTypesDetected: pageTypes.length,
            objectsDetected: detectedObjects.length,
            relationshipsFound: relationships.length,
          },
          pageTypes: pageTypes.map(pt => ({
            id: pt.id,
            name: pt.name,
            pageCount: pt.pageCount,
            confidence: pt.confidence,
            urlPattern: pt.urlPattern,
            examples: pt.examples.slice(0, 3),
          })),
          objects: detectedObjects.map(obj => ({
            id: obj.id,
            type: obj.type,
            name: obj.name,
            instanceCount: obj.instances.length,
            confidence: obj.confidence,
          })),
          relationships: relationships.map(rel => ({
            type: rel.type,
            description: rel.description,
            confidence: rel.confidence,
          })),
        };
        output.success(responseData);
      } else {
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

        if (detectedObjects.length > 0) {
          logger.info('Detected Objects:');
          detectedObjects.forEach(obj => {
            console.log(`  ${obj.name} (${obj.instances.length} instances)`);
          });
          console.log();
        }

        logger.success('Analysis completed!');
        console.log();
        logger.info('Next steps:');
        console.log('  1. Run "s2s report" to view detailed report');
        console.log('  2. Run "s2s map" to create Sanity schema interactively');
        console.log('  3. Run "s2s list page-types --json" to query detected types');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (output.isJsonMode()) {
        output.error(ErrorCode.ANALYSIS_FAILED, 'Analysis failed', {
          details: errorMessage,
          recoverable: true,
          suggestion: 'Check that crawl data exists and is valid',
        });
      } else {
        logger.error(`Analysis failed: ${errorMessage}`);
        if (process.env.DEBUG) {
          console.error(error);
        }
      }
      process.exit(1);
    }
  });
