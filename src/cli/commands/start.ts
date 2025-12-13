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
import { AIAnalyzer, AIAnalysisResult } from '../../core/analyzer/aiAnalyzer';
import { SanityExporter } from '../../core/exporter/sanity';
import { logger } from '../../utils/logger';
import { SecretsManager } from '../../utils/secrets';
import { SanityModel, PageType } from '../../types';
import * as path from 'path';
import chalk from 'chalk';

export const startCommand = new Command('start')
  .description('Start interactive site analysis and Sanity schema generation (supports AI-powered analysis)')
  .argument('[url]', 'Base URL of the site to analyze (optional - will prompt if not provided)')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--no-ai', 'Skip AI-powered analysis')
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

      logger.startSpinner('Detecting content objects...');
      let detectedObjects = analyzer.detectObjects();
      await workspace.saveJSON('objects.json', detectedObjects);
      logger.succeedSpinner(`Found ${detectedObjects.length} reusable object types`);

      // AI-powered analysis (optional)
      let aiAnalysis: AIAnalysisResult | null = null;
      console.log();
      const useAI = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enabled',
          message: '🤖 Use AI to enhance analysis and detect blocks? (requires Anthropic API key)',
          default: true,
        },
      ]);

      if (useAI.enabled) {
        // Check for stored API key
        let apiKey: string | null = SecretsManager.getApiKey('anthropic');

        if (apiKey) {
          const keyPreview = `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
          console.log(chalk.dim(`  Using stored API key: ${keyPreview}`));
        } else {
          // Prompt for API key
          const apiKeyPrompt = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: 'Enter your Anthropic API key (sk-ant-...):',
              validate: (input) => input.startsWith('sk-ant-') || 'API key must start with sk-ant-',
            },
          ]);
          apiKey = apiKeyPrompt.apiKey;

          // Ask if they want to store it
          const storeKey = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'store',
              message: 'Store this API key for future use? (stored in ~/.site2sanity/secrets.json)',
              default: true,
            },
          ]);

          if (storeKey.store && apiKey) {
            SecretsManager.setApiKey('anthropic', apiKey);
            console.log(chalk.dim('  API key stored securely'));
          }
        }

        if (!apiKey) {
          logger.error('No API key provided');
          return;
        }

        try {
          logger.startSpinner('Running AI analysis (this may take 10-30 seconds)...');

          const aiAnalyzer = new AIAnalyzer({
            enabled: true,
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
            apiKey: apiKey,
            maxPagesPerAnalysis: 20,
            useVision: false, // Will be enabled when we add screenshot support
          });

          aiAnalysis = await aiAnalyzer.analyzeSite(pages, pageTypes);
          await workspace.saveJSON('aiAnalysis.json', aiAnalysis);

          logger.succeedSpinner(
            `AI found ${aiAnalysis.detectedBlocks.length} blocks, enhanced ${aiAnalysis.enhancedObjects.length} objects`
          );

          // Merge AI-enhanced objects with detected objects
          if (aiAnalysis.enhancedObjects.length > 0) {
            detectedObjects = [
              ...detectedObjects,
              ...aiAnalysis.enhancedObjects.map(obj => ({
                id: `ai-${obj.name}`,
                type: obj.type,
                name: obj.name,
                instances: [], // AI doesn't provide instances
                confidence: 0.9,
                suggestedFields: obj.suggestedFields.map(f => ({
                  name: f.name,
                  type: f.type,
                  required: f.required,
                  examples: [],
                })),
                pageTypeRefs: [],
                rationale: obj.description,
              })),
            ];
          }
        } catch (error) {
          logger.failSpinner(`AI analysis failed: ${(error as Error).message}`);
          logger.info('Continuing with basic analysis...');
        }
      }

      // Show results
      console.log();
      logger.info('Page Types Found:');
      pageTypes.forEach(pt => {
        console.log(`  • ${pt.name} (${pt.pageCount} page${pt.pageCount > 1 ? 's' : ''})`);
      });

      if (detectedObjects.length > 0) {
        console.log();
        logger.info('Reusable Objects Found:');
        detectedObjects.forEach(obj => {
          const source = obj.id.startsWith('ai-') ? '🤖 AI' : 'Pattern';
          const instanceCount = obj.instances.length > 0 ? `${obj.instances.length} instance${obj.instances.length > 1 ? 's' : ''}` : 'suggested';
          console.log(`  • ${obj.type}: ${obj.name} (${instanceCount}) [${source}]`);
        });
      }

      if (aiAnalysis && aiAnalysis.detectedBlocks.length > 0) {
        console.log();
        logger.info('🤖 AI-Detected Blocks:');
        aiAnalysis.detectedBlocks.forEach(block => {
          console.log(`  • ${block.name} (${block.occurrences} occurrence${block.occurrences > 1 ? 's' : ''})`);
          console.log(`    ${block.description}`);
        });
      }

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

      // Interactive mapping with merging support
      const model: SanityModel = {
        documents: [],
        objects: [],
        blocks: [],
        singletons: [],
      };

      console.log();

      // Ask about merging page types
      const mergeAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'merge',
          message: 'Would you like to merge any page types together?',
          default: false,
        },
      ]);

      let processedTypes = [...pageTypes];
      const mergedTypeIds = new Set<string>();

      if (mergeAnswer.merge) {
        let continueMerging = true;

        while (continueMerging) {
          const availableTypes = processedTypes.filter(pt => !mergedTypeIds.has(pt.id));

          if (availableTypes.length < 2) {
            logger.info('Not enough page types left to merge');
            break;
          }

          const mergeSelection = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'types',
              message: 'Select page types to merge (use space to select):',
              choices: availableTypes.map(pt => ({
                name: `${pt.name} (${pt.pageCount} page${pt.pageCount > 1 ? 's' : ''})`,
                value: pt.id,
              })),
              validate: (input) => input.length >= 2 || 'Select at least 2 types to merge',
            },
            {
              type: 'input',
              name: 'mergedName',
              message: 'Name for merged page type:',
              default: 'page',
              when: (ans) => ans.types.length >= 2,
            },
          ]);

          if (mergeSelection.types.length >= 2) {
            // Create merged type
            const typesToMerge = pageTypes.filter(pt => mergeSelection.types.includes(pt.id));
            const mergedExamples = typesToMerge.flatMap(pt => pt.examples);
            const mergedPageCount = typesToMerge.reduce((sum, pt) => sum + pt.pageCount, 0);

            const mergedType: PageType = {
              id: `merged-${Date.now()}`,
              name: mergeSelection.mergedName,
              confidence: Math.max(...typesToMerge.map(pt => pt.confidence)),
              examples: mergedExamples.slice(0, 5),
              urlPattern: 'merged',
              domSignature: '',
              jsonLdTypes: [],
              features: typesToMerge[0].features,
              pageCount: mergedPageCount,
              rationale: `Merged from: ${typesToMerge.map(pt => pt.name).join(', ')}`,
            };

            processedTypes.push(mergedType);
            typesToMerge.forEach(pt => mergedTypeIds.add(pt.id));

            logger.success(`Merged ${typesToMerge.length} types into "${mergeSelection.mergedName}"`);
          }

          const continueAnswer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continue',
              message: 'Merge more page types?',
              default: false,
            },
          ]);

          continueMerging = continueAnswer.continue;
        }
      }

      // Filter out merged types
      const finalTypes = processedTypes.filter(pt => !mergedTypeIds.has(pt.id));

      console.log();
      logger.info('Final page types to map:');
      finalTypes.forEach(pt => {
        console.log(`  • ${pt.name} (${pt.pageCount} page${pt.pageCount > 1 ? 's' : ''})`);
      });
      console.log();

      // Map each type to Sanity schema
      for (const pageType of finalTypes) {
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

      // Helper function to map detected types to Sanity types
      const mapToSanityType = (type: string): string => {
        const typeMap: Record<string, string> = {
          'string': 'string',
          'number': 'number',
          'boolean': 'boolean',
          'datetime': 'datetime',
          'url': 'url',
          'array': 'array',
          'object': 'object',
        };
        return typeMap[type] || 'string';
      };

      // Add object types from detected objects
      if (detectedObjects.length > 0) {
        console.log();
        const includeObjectsAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'include',
            message: `Create Sanity object types for detected reusable content (authors, categories, etc.)?`,
            default: true,
          },
        ]);

        if (includeObjectsAnswer.include) {
          for (const obj of detectedObjects) {
            const objTypeAnswer = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'include',
                message: `Include ${obj.type}: "${obj.name}" (${obj.instances.length} instance${obj.instances.length > 1 ? 's' : ''})?`,
                default: obj.instances.length > 2,
              },
            ]);

            if (objTypeAnswer.include) {
              // Convert object type to Sanity schema
              const titleCaseName = obj.name
                .split(/[\s-]/)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

              const camelCaseName = obj.name
                .split(/[\s-]/)
                .map((word, index) =>
                  index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join('');

              // Create Sanity fields from detected fields
              const sanityFields = obj.suggestedFields.map(field => ({
                name: field.name,
                title: field.name.charAt(0).toUpperCase() + field.name.slice(1),
                type: mapToSanityType(field.type),
                validation: field.required ? 'required' : undefined,
              }));

              // Ensure basic fields exist
              if (!sanityFields.find(f => f.name === 'name')) {
                sanityFields.unshift({
                  name: 'name',
                  title: 'Name',
                  type: 'string',
                  validation: 'required',
                });
              }

              model.objects.push({
                name: camelCaseName,
                title: titleCaseName,
                type: 'object',
                fields: sanityFields,
                description: obj.rationale,
              });
            }
          }
        }
      }

      // Add AI-detected blocks
      if (aiAnalysis && aiAnalysis.detectedBlocks.length > 0) {
        console.log();
        const includeBlocksAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'include',
            message: `🤖 Create Sanity block types from AI-detected patterns?`,
            default: true,
          },
        ]);

        if (includeBlocksAnswer.include) {
          for (const block of aiAnalysis.detectedBlocks) {
            const blockTypeAnswer = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'include',
                message: `Include "${block.name}" block (${block.occurrences} occurrence${block.occurrences > 1 ? 's' : ''})?`,
                default: block.occurrences > 2,
              },
            ]);

            if (blockTypeAnswer.include) {
              const camelCaseName = block.name
                .split(/[\s-]/)
                .map((word, index) =>
                  index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join('');

              const titleCaseName = block.name
                .split(/[\s-]/)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

              const sanityFields = block.fields.map(field => ({
                name: field.name,
                title: field.name.charAt(0).toUpperCase() + field.name.slice(1),
                type: mapToSanityType(field.type),
                description: field.description,
              }));

              model.blocks.push({
                name: camelCaseName,
                title: titleCaseName,
                type: 'object',
                fields: sanityFields,
                description: block.description,
              });
            }
          }
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
        logger.info('Generated files:');
        console.log(`  ${outDir}/sanity/schemaTypes/`);
        console.log(`  ${outDir}/sanity/README.md`);
        console.log();

        // Step 8: Offer to initialize Sanity Studio
        const initSanityAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'initSanity',
            message: 'Would you like to initialize a new Sanity Studio project with these schemas?',
            default: true,
          },
        ]);

        if (initSanityAnswer.initSanity) {
          console.log();
          logger.section('Initialize Sanity Studio');
          logger.info('This will create a new Sanity Studio project and integrate your generated schemas.');
          console.log();
          logger.info('You can also run this later with: s2s sanity-init');
          console.log();

          const studioPath = await inquirer.prompt([
            {
              type: 'input',
              name: 'path',
              message: 'Where should the Sanity Studio be created?',
              default: './studio',
            },
          ]);

          const studioName = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'What would you like to name your Sanity project?',
              default: path.basename(path.resolve(studioPath.path)),
            },
          ]);

          console.log();
          logger.info('Starting Sanity CLI wizard...');
          logger.info('You may be prompted to log in or create a Sanity account.');
          console.log(chalk.dim('Follow the prompts to complete the setup.\n'));

          // Run sanity init
          const { spawn } = await import('child_process');
          const studioOutputPath = path.resolve(studioPath.path);

          const sanityInitSuccess = await new Promise<boolean>((resolve) => {
            const args = ['create', 'sanity@latest', '--'];
            args.push('--output-path', studioOutputPath);
            args.push('--create-project', studioName.name);
            args.push('--dataset-default');
            args.push('--template', 'clean');
            args.push('--no-mcp');

            const child = spawn('npm', args, {
              stdio: 'inherit',
              shell: true,
            });

            child.on('close', (code) => resolve(code === 0));
            child.on('error', () => resolve(false));
          });

          if (sanityInitSuccess) {
            // Wait a moment for files to be written
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Copy schema files
            logger.startSpinner('Integrating generated schemas...');

            try {
              const { copySchemaFilesToProject, updateSanityConfigFile } = await import('./sanity-init');
              await copySchemaFilesToProject(outDir, studioOutputPath);
              await updateSanityConfigFile(studioOutputPath);
              logger.succeedSpinner('Schemas integrated successfully!');

              console.log();
              logger.success('Sanity Studio created!');
              console.log();
              logger.info('To start your studio:');
              console.log(`  1. ${chalk.cyan(`cd ${path.relative(process.cwd(), studioOutputPath)}`)}`);
              console.log(`  2. ${chalk.cyan('npm run dev')}`);
              console.log(`  3. Open ${chalk.cyan('http://localhost:3333')} in your browser`);
            } catch (error) {
              logger.failSpinner(`Failed to integrate schemas: ${(error as Error).message}`);
              logger.info('You can manually run: s2s sanity-init --skip-init');
            }
          } else {
            logger.warn('Sanity initialization did not complete.');
            logger.info('You can run "s2s sanity-init" later to create a Sanity Studio.');
          }
        } else {
          console.log();
          logger.success('All done!');
          console.log();
          logger.info('Next steps:');
          console.log('  1. Copy schemaTypes/ to your Sanity Studio project');
          console.log('  2. Follow instructions in README.md');
          console.log('  3. Customize the schema for your needs');
          console.log();
          logger.info('Or run "s2s sanity-init" to create a new Sanity Studio project.');
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
