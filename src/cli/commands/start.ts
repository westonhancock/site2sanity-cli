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
  .description('Interactive workflow: two-phase crawl (HTML + screenshots), AI-powered analysis with vision, schema generation, and optional Sanity Studio setup')
  .argument('[url]', 'Base URL of the site to analyze (optional - will prompt if not provided)')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--no-ai', 'Skip AI-powered analysis with vision (blocks, objects, enhanced fields)')
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
          name: 'followSubdomains',
          message: 'Follow subdomains? (e.g., blog.example.com when crawling example.com)',
          default: false,
        },
      ]);

      config.crawl.maxPages = crawlAnswers.maxPages;
      config.crawl.maxDepth = crawlAnswers.maxDepth;
      config.crawl.followSubdomains = crawlAnswers.followSubdomains;
      config.crawl.render = false; // Always use HTML crawl first (Phase 1)

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

      // Phase 2: Selective screenshot capture for AI analysis
      console.log();
      logger.section('Visual Analysis Preparation');

      const screenshotAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'capture',
          message: 'Capture screenshots for AI-powered block detection? (recommended)',
          default: true,
        },
      ]);

      let hasScreenshots = false;
      if (screenshotAnswer.capture) {
        // Select representative pages per type
        const representativeUrls: string[] = [];
        const samplesPerType = config.crawl.screenshotSamplesPerType || 3;

        for (const pageType of pageTypes) {
          const typePages = pageType.examples.slice(0, samplesPerType);
          representativeUrls.push(...typePages);
        }

        logger.info(`Capturing ${representativeUrls.length} screenshots (${samplesPerType} per page type)`);
        logger.startSpinner('Taking full-page screenshots...');

        try {
          await crawler.crawlWithScreenshots(representativeUrls);
          hasScreenshots = true;
          logger.succeedSpinner(`Captured ${representativeUrls.length} screenshots`);
        } catch (error) {
          logger.failSpinner(`Screenshot capture failed: ${(error as Error).message}`);
          logger.info('Continuing without screenshots...');
        }
      }

      // AI-powered analysis (optional)
      let aiAnalysis: AIAnalysisResult | null = null;
      console.log();
      const useAI = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enabled',
          message: `🤖 Use AI to enhance analysis and detect blocks?${hasScreenshots ? ' (will use screenshots)' : ''} (requires Anthropic API key)`,
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
            useVision: hasScreenshots,
          });

          aiAnalysis = await aiAnalyzer.analyzeSite(pages, pageTypes, workspace.getPath());
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
        // Main line with name and count
        console.log(`\n  ${chalk.bold(pt.name)} ${chalk.dim(`(${pt.pageCount} page${pt.pageCount > 1 ? 's' : ''})`)}${pt.confidence < 0.7 ? chalk.yellow(' ⚠ Low confidence') : ''}`);

        // Example URL
        if (pt.examples && pt.examples.length > 0) {
          console.log(`    ${chalk.dim('Example:')} ${chalk.cyan(pt.examples[0])}`);
        }

        // URL pattern
        if (pt.urlPattern) {
          console.log(`    ${chalk.dim('Pattern:')} ${pt.urlPattern}`);
        }

        // Content features
        const features: string[] = [];
        if (pt.features.hasDate) features.push('date');
        if (pt.features.hasAuthor) features.push('author');
        if (pt.features.hasPrice) features.push('price');
        if (pt.features.hasForm) features.push('form');
        if (pt.features.hasGallery) features.push('gallery');
        if (pt.features.hasBreadcrumbs) features.push('breadcrumbs');
        if (pt.features.hasRelatedContent) features.push('related content');
        if (pt.features.richContent) features.push('rich content');

        if (features.length > 0) {
          console.log(`    ${chalk.dim('Features:')} ${features.join(', ')}`);
        }

        // Rationale
        if (pt.rationale) {
          console.log(`    ${chalk.dim('Description:')} ${pt.rationale}`);
        }
      });

      if (detectedObjects.length > 0) {
        console.log();
        logger.info('Reusable Objects Found:');
        detectedObjects.forEach(obj => {
          const source = obj.id.startsWith('ai-') ? '🤖 AI' : 'Pattern';
          const instanceCount = obj.instances.length > 0 ? `${obj.instances.length} instance${obj.instances.length > 1 ? 's' : ''}` : 'suggested';

          console.log(`\n  ${chalk.bold(obj.name)} ${chalk.dim(`(${instanceCount})`)} ${chalk.dim(`[${source}]`)}`);

          // Show field structure
          if (obj.suggestedFields && obj.suggestedFields.length > 0) {
            const fieldNames = obj.suggestedFields.map(f => f.name).join(', ');
            console.log(`    ${chalk.dim('Fields:')} ${fieldNames}`);
          }

          // Show unique examples
          const uniqueExamples = [...new Set(
            obj.instances
              .map(i => i.data.name || i.data.title || (typeof i.data === 'string' ? i.data : JSON.stringify(i.data).slice(0, 30)))
              .filter(Boolean)
          )].slice(0, 3);

          if (uniqueExamples.length > 0) {
            const examplesStr = uniqueExamples.join(', ');
            const more = obj.instances.length > uniqueExamples.length ? ` +${obj.instances.length - uniqueExamples.length} more` : '';
            console.log(`    ${chalk.dim('Examples:')} ${examplesStr}${more}`);
          }

          if (obj.pageTypeRefs && obj.pageTypeRefs.length > 0) {
            const refNames = obj.pageTypeRefs.map(ref => {
              const pt = pageTypes.find(p => p.id === ref);
              return pt ? pt.name : ref;
            }).join(', ');
            console.log(`    ${chalk.dim('Referenced by:')} ${refNames}`);
          }
        });
      }

      if (aiAnalysis && aiAnalysis.detectedBlocks.length > 0) {
        console.log();
        logger.info('🤖 AI-Detected Blocks:');
        aiAnalysis.detectedBlocks.forEach(block => {
          console.log(`\n  ${chalk.bold(block.name)} ${chalk.dim(`(${block.occurrences} occurrence${block.occurrences > 1 ? 's' : ''})`)}`);
          console.log(`    ${chalk.dim('Description:')} ${block.description}`);

          // Show sample fields
          if (block.fields && block.fields.length > 0) {
            const fieldNames = block.fields.slice(0, 4).map(f => f.name).join(', ');
            const more = block.fields.length > 4 ? ` +${block.fields.length - 4} more` : '';
            console.log(`    ${chalk.dim('Fields:')} ${fieldNames}${more}`);
          }
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

      // Track all type names to prevent duplicates
      const usedTypeNames = new Set<string>();

      // Helper function to get unique type name
      const getUniqueTypeName = (baseName: string): string => {
        let uniqueName = baseName;
        let counter = 2;
        while (usedTypeNames.has(uniqueName)) {
          uniqueName = `${baseName}${counter}`;
          counter++;
        }
        usedTypeNames.add(uniqueName);
        return uniqueName;
      };

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

          // Ensure unique type name
          const uniqueDocName = getUniqueTypeName(typeAnswers.documentName);

          model.documents.push({
            name: uniqueDocName,
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

      // Recursively map ObjectField to Sanity field definition
      const mapFieldToSanity = (field: any): any => {
        const sanityField: any = {
          name: field.name,
          title: field.name.charAt(0).toUpperCase() + field.name.slice(1),
          type: mapToSanityType(field.type),
          validation: field.required ? 'required' : undefined,
        };

        // Handle nested objects
        if (field.type === 'object' && field.fields && field.fields.length > 0) {
          sanityField.fields = field.fields.map(mapFieldToSanity);
        }

        // Handle arrays
        if (field.type === 'array' && field.of && field.of.length > 0) {
          sanityField.of = field.of.map((ofType: any) => {
            if (ofType.type === 'object' && ofType.fields) {
              return {
                type: 'object',
                fields: ofType.fields.map(mapFieldToSanity)
              };
            }
            return { type: mapToSanityType(ofType.type) };
          });
        }

        return sanityField;
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
            // Get unique instance count for display
            const uniqueInstances = new Set(
              obj.instances.map(i => i.data.name || i.data.title || JSON.stringify(i.data).slice(0, 30))
            ).size;

            const objTypeAnswer = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'include',
                message: `Include ${obj.type} (${obj.instances.length} instances, ${uniqueInstances} unique)?`,
                default: true,
              },
            ]);

            if (objTypeAnswer.include) {
              // obj.name is already the generic type name (e.g., "author", "category")
              const camelCaseName = obj.name; // Already in correct format
              const titleCaseName = obj.name.charAt(0).toUpperCase() + obj.name.slice(1);

              // Create Sanity fields from detected fields (with nested object/array support)
              const sanityFields = obj.suggestedFields.map(mapFieldToSanity);

              // Ensure basic fields exist
              if (!sanityFields.find(f => f.name === 'name')) {
                sanityFields.unshift({
                  name: 'name',
                  title: 'Name',
                  type: 'string',
                  validation: 'required',
                });
              }

              // Ensure unique type name
              const uniqueObjName = getUniqueTypeName(camelCaseName);

              model.objects.push({
                name: uniqueObjName,
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
                default: true,
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

              const sanityFields = block.fields.map((field: any) => {
                const mappedField = mapFieldToSanity(field);
                // Add description if present
                if (field.description) {
                  mappedField.description = field.description;
                }
                return mappedField;
              });

              // Ensure unique type name
              const uniqueBlockName = getUniqueTypeName(camelCaseName);

              model.blocks.push({
                name: uniqueBlockName,
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
        // Ensure unique type name
        const uniqueSettingsName = getUniqueTypeName('siteSettings');

        model.singletons.push({
          name: uniqueSettingsName,
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
