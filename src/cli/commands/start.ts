/**
 * Start command - Interactive workflow for the entire process
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { isValidUrl, normalizeUrl } from '../../utils/url';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { Crawler } from '../../core/crawler';
import { Analyzer } from '../../core/analyzer';
import { SanityExporter } from '../../core/exporter/sanity';
import { logger } from '../../utils/logger';
import { SanityModel, PageType } from '../../types';
import * as path from 'path';

export const startCommand = new Command('start')
  .description('Start interactive site analysis and Sanity schema generation')
  .argument('[url]', 'Base URL of the site to analyze (optional - will prompt if not provided)')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .action(async (url: string | undefined, options: any) => {
    try {
      logger.section('Welcome to site2sanity!');
      console.log('This tool will help you analyze a website and generate Sanity CMS schema.\n');

      // Step 1: Get URL and initialize
      let baseUrl = url;
      if (!baseUrl) {
        const urlAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'What website would you like to analyze?',
            validate: (input) => isValidUrl(input) || 'Please enter a valid URL',
          },
        ]);
        baseUrl = urlAnswer.url;
      }

      if (!isValidUrl(baseUrl!)) {
        logger.error(`Invalid URL: ${baseUrl}`);
        process.exit(1);
      }

      baseUrl = normalizeUrl(baseUrl!);
      logger.info(`Analyzing: ${baseUrl}\n`);

      // Initialize workspace
      const workspace = new Workspace(options.dir);

      if (workspace.exists()) {
        const overwrite = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'A workspace already exists. Start fresh?',
            default: false,
          },
        ]);

        if (!overwrite.overwrite) {
          logger.info('Using existing workspace');
        } else {
          await workspace.init(baseUrl);
        }
      } else {
        await workspace.init(baseUrl);
      }

      const config = await workspace.loadConfig();

      // Step 2: Configure crawl
      console.log();
      logger.section('Crawl Configuration');

      const crawlAnswers = await inquirer.prompt([
        {
          type: 'number',
          name: 'maxPages',
          message: 'Maximum pages to crawl:',
          default: 50,
        },
        {
          type: 'number',
          name: 'maxDepth',
          message: 'Maximum crawl depth:',
          default: 3,
        },
        {
          type: 'confirm',
          name: 'render',
          message: 'Use headless browser? (required for JS-heavy sites)',
          default: true,
        },
      ]);

      config.crawl.maxPages = crawlAnswers.maxPages;
      config.crawl.maxDepth = crawlAnswers.maxDepth;
      config.crawl.render = crawlAnswers.render;

      // Step 3: Crawl
      console.log();
      logger.section('Crawling Website');

      const db = new CrawlDatabase(workspace.getPath());
      db.clear();

      const runDir = workspace.createRun();
      logger.startSpinner(`Crawling ${baseUrl}...`);

      const crawler = new Crawler(config.baseUrl, config.crawl, db);
      await crawler.crawl();

      const pageCount = db.getPageCount();
      logger.succeedSpinner(`Crawled ${pageCount} pages`);

      // Step 4: Analyze
      console.log();
      logger.section('Analyzing Site Structure');

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
        true // Include singletons
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
      pageTypes.forEach(pt => {
        console.log(`  • ${pt.name} (${pt.pageCount} page${pt.pageCount > 1 ? 's' : ''})`);
      });

      // Step 5: Map to Sanity schema
      console.log();
      logger.section('Create Sanity Schema');

      const mapAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Generate Sanity schema from these page types?',
          default: true,
        },
      ]);

      if (!mapAnswer.proceed) {
        logger.info('Stopped. Run "s2s map" later to create schema.');
        process.exit(0);
      }

      // Interactive mapping
      const model: SanityModel = {
        documents: [],
        objects: [],
        blocks: [],
        singletons: [],
      };

      console.log();
      for (const pageType of pageTypes) {
        const typeAnswers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'include',
            message: `Include "${pageType.name}" (${pageType.pageCount} page${pageType.pageCount > 1 ? 's' : ''})?`,
            default: true,
          },
          {
            type: 'input',
            name: 'documentName',
            message: 'Sanity document type name:',
            default: pageType.name
              .split('-')
              .map((word, index) =>
                index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
              )
              .join(''),
            when: (ans) => ans.include,
          },
        ]);

        if (typeAnswers.include) {
          const titleCaseName = pageType.name
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          model.documents.push({
            name: typeAnswers.documentName,
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

      // Add site settings
      const settingsAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addSettings',
          message: 'Add global site settings document?',
          default: true,
        },
      ]);

      if (settingsAnswer.addSettings) {
        model.singletons.push({
          name: 'siteSettings',
          title: 'Site Settings',
          type: 'document',
          singleton: true,
          mode: 'template',
          fields: [
            {
              name: 'title',
              title: 'Site Title',
              type: 'string',
            },
            {
              name: 'description',
              title: 'Site Description',
              type: 'text',
            },
          ],
          preview: {
            select: {
              title: 'title',
            },
          },
        });
      }

      await workspace.saveJSON('model.json', model);

      // Step 6: Validate
      console.log();
      logger.section('Validating Schema');
      logger.success(`Created schema with ${model.documents.length} document types`);

      // Step 7: Export
      console.log();
      const exportAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'export',
          message: 'Export Sanity TypeScript schema files?',
          default: true,
        },
      ]);

      if (exportAnswer.export) {
        logger.startSpinner('Generating Sanity schema files...');

        const outDir = path.resolve('out');
        const exporter = new SanityExporter(outDir);
        await exporter.export(model);

        logger.succeedSpinner('Schema exported!');

        console.log();
        logger.success('All done!');
        console.log();
        logger.info('Generated files:');
        console.log(`  ${outDir}/sanity/schemaTypes/`);
        console.log(`  ${outDir}/sanity/README.md`);
        console.log();
        logger.info('Next steps:');
        console.log('  1. Copy schemaTypes/ to your Sanity Studio project');
        console.log('  2. Follow instructions in README.md');
        console.log('  3. Customize the schema for your needs');
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
