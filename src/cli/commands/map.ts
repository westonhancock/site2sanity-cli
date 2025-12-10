/**
 * Map command - Interactive Sanity schema mapping
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';
import { PageType, SanityModel } from '../../types';

export const mapCommand = new Command('map')
  .description('Interactively map page types to Sanity schema')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--non-interactive', 'Run in non-interactive mode with defaults')
  .action(async (options: any) => {
    try {
      const workspace = new Workspace(options.dir);

      if (!workspace.exists()) {
        logger.error('Workspace not initialized. Run "s2s init <url>" first.');
        process.exit(1);
      }

      const pageTypes = await workspace.loadJSON<PageType[]>('pageTypes.json');

      if (!pageTypes || pageTypes.length === 0) {
        logger.error('No page types found. Run "s2s analyze" first.');
        process.exit(1);
      }

      logger.section('Interactive Sanity Schema Mapping');

      const model: SanityModel = {
        documents: [],
        objects: [],
        blocks: [],
        singletons: [],
      };

      if (!options.nonInteractive) {
        // Interactive flow
        logger.info(`Found ${pageTypes.length} page types. Let's map them to Sanity documents.`);
        console.log();

        for (const pageType of pageTypes) {
          console.log();
          logger.info(`Page Type: ${pageType.name}`);
          console.log(`  Pages: ${pageType.pageCount}`);
          console.log(`  Pattern: ${pageType.urlPattern}`);
          console.log(`  Confidence: ${(pageType.confidence * 100).toFixed(0)}%`);
          console.log();

          const answers = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'include',
              message: 'Include this page type in schema?',
              default: true,
            },
            {
              type: 'input',
              name: 'documentName',
              message: 'Sanity document type name:',
              default: pageType.name,
              when: (ans) => ans.include,
            },
            {
              type: 'list',
              name: 'mode',
              message: 'Modeling mode:',
              choices: [
                { name: 'Builder Mode (flexible content blocks)', value: 'builder' },
                { name: 'Template Mode (fixed fields)', value: 'template' },
              ],
              default: 'builder',
              when: (ans) => ans.include,
            },
          ]);

          if (answers.include) {
            model.documents.push({
              name: answers.documentName,
              title: answers.documentName.charAt(0).toUpperCase() + answers.documentName.slice(1),
              type: 'document',
              mode: answers.mode,
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

        // Add site settings singleton
        const addSettings = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addSettings',
            message: 'Add global site settings document?',
            default: true,
          },
        ]);

        if (addSettings.addSettings) {
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
      } else {
        // Non-interactive: use defaults
        logger.info('Running in non-interactive mode with defaults');

        for (const pageType of pageTypes) {
          model.documents.push({
            name: pageType.name,
            title: pageType.name.charAt(0).toUpperCase() + pageType.name.slice(1),
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

      // Save model
      await workspace.saveJSON('model.json', model);

      logger.success(`Created schema with ${model.documents.length} document types`);
      console.log();
      logger.info('Next steps:');
      console.log('  1. Run "s2s lint" to validate the schema');
      console.log('  2. Run "s2s export" to generate TypeScript files');
    } catch (error) {
      logger.error(`Mapping failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });
