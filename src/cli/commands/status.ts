/**
 * Status command - Get workspace status for AI agents
 *
 * Provides a quick overview of what phases have been completed
 * and what data is available in the workspace.
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { logger } from '../../utils/logger';
import {
  createOutput,
  ErrorCode,
  StatusResponseData,
} from '../../utils/output';
import { PageType, DetectedObject, SanityModel } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

export const statusCommand = new Command('status')
  .description('[AI] Check workspace status: which phases are complete, counts, etc.')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--json', 'Output results as JSON (for AI agents)')
  .action(async (options: any) => {
    const output = createOutput(options);

    try {
      const workspace = new Workspace(options.dir);

      // Check if workspace exists
      if (!workspace.exists()) {
        if (output.isJsonMode()) {
          const responseData: StatusResponseData = {
            workspace: options.dir,
            initialized: false,
            phases: {
              crawl: { complete: false },
              analysis: { complete: false },
              mapping: { complete: false },
              export: { complete: false },
            },
          };
          output.success(responseData);
          return;
        }

        logger.section('Workspace Status');
        logger.warn(`No workspace found at ${options.dir}`);
        logger.info('Run "s2s init <url>" to initialize a workspace');
        return;
      }

      // Load config
      const config = await workspace.loadConfig();

      // Check crawl status
      let crawlComplete = false;
      let pageCount = 0;
      let lastCrawl: string | undefined;

      try {
        const db = new CrawlDatabase(workspace.getPath());
        pageCount = db.getPageCount();
        crawlComplete = pageCount > 0;
        const metadata = db.getMetadata('lastCrawl');
        if (metadata) {
          lastCrawl = metadata as string;
        }
        db.close();
      } catch {
        // Database doesn't exist or is corrupted
      }

      // Check analysis status
      let analysisComplete = false;
      let pageTypesCount = 0;
      let objectsCount = 0;

      const pageTypesPath = path.join(workspace.getPath(), 'data', 'pageTypes.json');
      if (fs.existsSync(pageTypesPath)) {
        try {
          const pageTypes = JSON.parse(fs.readFileSync(pageTypesPath, 'utf-8')) as PageType[];
          pageTypesCount = pageTypes.length;
          analysisComplete = pageTypesCount > 0;
        } catch {
          // Invalid JSON
        }
      }

      const objectsPath = path.join(workspace.getPath(), 'data', 'objects.json');
      if (fs.existsSync(objectsPath)) {
        try {
          const objects = JSON.parse(fs.readFileSync(objectsPath, 'utf-8')) as DetectedObject[];
          objectsCount = objects.length;
        } catch {
          // Invalid JSON
        }
      }

      // Check mapping status
      let mappingComplete = false;
      let documentsCount = 0;

      const modelPath = path.join(workspace.getPath(), 'data', 'model.json');
      if (fs.existsSync(modelPath)) {
        try {
          const model = JSON.parse(fs.readFileSync(modelPath, 'utf-8')) as SanityModel;
          documentsCount = model.documents.length;
          mappingComplete = documentsCount > 0;
        } catch {
          // Invalid JSON
        }
      }

      // Check export status
      let exportComplete = false;
      let exportDir: string | undefined;

      const defaultOutDir = path.resolve('out');
      const schemaTypesDir = path.join(defaultOutDir, 'sanity', 'schemaTypes');
      if (fs.existsSync(schemaTypesDir)) {
        exportComplete = true;
        exportDir = defaultOutDir;
      }

      // Output results
      if (output.isJsonMode()) {
        const responseData: StatusResponseData = {
          workspace: workspace.getPath(),
          initialized: true,
          baseUrl: config.baseUrl,
          phases: {
            crawl: {
              complete: crawlComplete,
              pageCount: crawlComplete ? pageCount : undefined,
              lastRun: lastCrawl,
            },
            analysis: {
              complete: analysisComplete,
              pageTypesCount: analysisComplete ? pageTypesCount : undefined,
              objectsCount: analysisComplete ? objectsCount : undefined,
            },
            mapping: {
              complete: mappingComplete,
              documentsCount: mappingComplete ? documentsCount : undefined,
            },
            export: {
              complete: exportComplete,
              outputDir: exportDir,
            },
          },
        };
        output.success(responseData);
      } else {
        logger.section('Workspace Status');
        logger.info(`Workspace: ${workspace.getPath()}`);
        logger.info(`Base URL: ${config.baseUrl}`);
        console.log();

        // Crawl phase
        const crawlStatus = crawlComplete ? '✓' : '○';
        const crawlColor = crawlComplete ? 'green' : 'gray';
        console.log(`  ${crawlStatus} Crawl: ${crawlComplete ? `${pageCount} pages` : 'Not started'}`);
        if (lastCrawl) {
          console.log(`      Last run: ${new Date(lastCrawl).toLocaleString()}`);
        }

        // Analysis phase
        const analysisStatus = analysisComplete ? '✓' : '○';
        console.log(`  ${analysisStatus} Analysis: ${analysisComplete ? `${pageTypesCount} page types, ${objectsCount} objects` : 'Not started'}`);

        // Mapping phase
        const mappingStatus = mappingComplete ? '✓' : '○';
        console.log(`  ${mappingStatus} Mapping: ${mappingComplete ? `${documentsCount} documents` : 'Not started'}`);

        // Export phase
        const exportStatus = exportComplete ? '✓' : '○';
        console.log(`  ${exportStatus} Export: ${exportComplete ? exportDir : 'Not started'}`);

        console.log();

        // Next step suggestion
        if (!crawlComplete) {
          logger.info('Next step: Run "s2s crawl" to crawl the website');
        } else if (!analysisComplete) {
          logger.info('Next step: Run "s2s analyze" to analyze the crawl data');
        } else if (!mappingComplete) {
          logger.info('Next step: Run "s2s map" to create the schema model');
        } else if (!exportComplete) {
          logger.info('Next step: Run "s2s export" to generate schema files');
        } else {
          logger.success('All phases complete!');
          logger.info('Run "s2s sanity-init" to initialize a Sanity Studio project');
        }
      }
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (output.isJsonMode()) {
        output.error(ErrorCode.UNKNOWN_ERROR, 'Failed to get status', {
          details: errorMessage,
          recoverable: true,
        });
      } else {
        logger.error(`Failed to get status: ${errorMessage}`);
        if (process.env.DEBUG) {
          console.error(error);
        }
      }
      process.exit(1);
    }
  });
