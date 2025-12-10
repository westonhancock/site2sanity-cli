/**
 * Project command - Manage and edit existing workspaces
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { Analyzer } from '../../core/analyzer';
import { SanityExporter } from '../../core/exporter/sanity';
import { logger } from '../../utils/logger';
import { SanityModel, PageType } from '../../types';
import * as path from 'path';
import * as fs from 'fs/promises';

export const projectCommand = new Command('project')
  .description('Open and edit an existing workspace')
  .argument('[name]', 'Project name (optional - will show list if not provided)')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .action(async (name: string | undefined, options: any) => {
    try {
      const workspace = new Workspace(options.dir);

      // Check if workspace exists
      if (!workspace.exists()) {
        logger.error(`No workspace found at ${workspace.getPath()}`);
        logger.info('Run "s2s" to create a new project');
        process.exit(1);
      }

      const config = await workspace.loadConfig();

      logger.section(`Project: ${config.baseUrl}`);
      console.log();

      // Load existing data
      const db = new CrawlDatabase(workspace.getPath());
      const pageCount = db.getPageCount();

      console.log(`  Base URL: ${config.baseUrl}`);
      console.log(`  Pages crawled: ${pageCount}`);
      console.log(`  Workspace: ${workspace.getPath()}`);
      console.log();

      // Show menu
      const action = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Re-analyze and regenerate schema', value: 'reanalyze' },
            { name: 'View page types', value: 'view' },
            { name: 'Export schema', value: 'export' },
            { name: 'View configuration', value: 'config' },
            { name: 'Exit', value: 'exit' },
          ],
        },
      ]);

      if (action.action === 'exit') {
        return;
      }

      if (action.action === 'config') {
        console.log();
        logger.info('Configuration:');
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      if (action.action === 'view') {
        try {
          const pageTypes = await workspace.loadJSON('pageTypes.json') as PageType[];
          console.log();
          logger.info('Page Types:');
          pageTypes.forEach((pt: PageType) => {
            console.log(`  • ${pt.name} (${pt.pageCount} page${pt.pageCount > 1 ? 's' : ''})`);
          });
        } catch (error) {
          logger.error('No page types found. Run re-analyze first.');
        }
        return;
      }

      if (action.action === 'reanalyze') {
        console.log();
        logger.section('Re-analyzing Site Structure');

        const pages = db.getAllPages();
        const analyzer = new Analyzer(pages);

        logger.startSpinner('Analyzing navigation...');
        const navigation = analyzer.analyzeNavigation();
        await workspace.saveJSON('navigation.json', navigation);
        logger.succeedSpinner(`Found ${navigation.primaryNav.length} nav items`);

        logger.startSpinner('Detecting page types...');
        const pageTypes = analyzer.detectPageTypes(
          config.analyze.clusteringThreshold,
          config.analyze.maxClusters,
          true
        );
        await workspace.saveJSON('pageTypes.json', pageTypes);
        logger.succeedSpinner(`Detected ${pageTypes.length} page types`);

        logger.startSpinner('Detecting relationships...');
        const relationships = analyzer.detectRelationships(pageTypes);
        await workspace.saveJSON('relationships.json', relationships);
        logger.succeedSpinner(`Found ${relationships.length} relationships`);

        // Show results
        console.log();
        logger.info('Page Types Found:');
        pageTypes.forEach((pt: PageType) => {
          console.log(`  • ${pt.name} (${pt.pageCount} page${pt.pageCount > 1 ? 's' : ''})`);
        });

        // Offer to regenerate schema
        const regenerate = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Generate Sanity schema from these page types?',
            default: true,
          },
        ]);

        if (regenerate.proceed) {
          // Continue with interactive mapping (simplified version)
          const model: SanityModel = {
            documents: [],
            objects: [],
            blocks: [],
            singletons: [],
          };

          for (const pageType of pageTypes) {
            const include = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'include',
                message: `Include "${pageType.name}" (${pageType.pageCount} page${pageType.pageCount > 1 ? 's' : ''})?`,
                default: true,
              },
            ]);

            if (include.include) {
              const titleCaseName = pageType.name
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

              const camelCaseName = pageType.name
                .split('-')
                .map((word, index) =>
                  index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join('');

              model.documents.push({
                name: camelCaseName,
                title: titleCaseName,
                type: 'document',
                mode: 'builder',
                fields: [
                  {
                    name: 'title',
                    title: 'Title',
                    type: 'string',
                    validation: 'required',
                  },
                  {
                    name: 'slug',
                    title: 'Slug',
                    type: 'slug',
                    options: { source: 'title' },
                  },
                ],
                preview: {
                  select: {
                    title: 'title',
                  },
                },
                __source: {
                  pageType: pageType.id,
                  confidence: pageType.confidence,
                },
              });
            }
          }

          await workspace.saveJSON('model.json', model);

          // Export
          const outDir = path.resolve('out');
          const exporter = new SanityExporter(outDir);
          await exporter.export(model);

          console.log();
          logger.success('Schema regenerated and exported!');
        }
      }

      if (action.action === 'export') {
        try {
          const model = await workspace.loadJSON('model.json') as SanityModel;
          logger.startSpinner('Exporting schema...');

          const outDir = path.resolve('out');
          const exporter = new SanityExporter(outDir);
          await exporter.export(model);

          logger.succeedSpinner('Schema exported!');
          console.log();
          logger.info('Generated files:');
          console.log(`  ${outDir}/sanity/schemaTypes/`);
        } catch (error) {
          logger.error('No model found. Run re-analyze first.');
        }
      }

      db.close();
    } catch (error) {
      logger.error(`Failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });
