/**
 * List command - Query detected types, objects, and blocks
 *
 * Provides AI agents with detailed information about detected content
 * to make informed decisions about schema generation.
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';
import {
  createOutput,
  ErrorCode,
  ErrorResponses,
  ListResponseData,
} from '../../utils/output';
import { PageType, DetectedObject, SanityModel } from '../../types';
import { AIAnalysisResult } from '../../core/analyzer/aiAnalyzer';
import * as fs from 'fs';
import * as path from 'path';

export const listCommand = new Command('list')
  .description('List detected page types, objects, blocks, or documents')
  .argument('<type>', 'What to list: page-types, objects, blocks, documents')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('--json', 'Output results as JSON (for AI agents)')
  .option('--verbose', 'Include full details for each item')
  .action(async (type: string, options: any) => {
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

      const validTypes = ['page-types', 'objects', 'blocks', 'documents'];
      if (!validTypes.includes(type)) {
        if (output.isJsonMode()) {
          output.error(ErrorCode.CONFIG_ERROR, 'Invalid list type', {
            details: `"${type}" is not a valid type`,
            recoverable: true,
            suggestion: `Valid types: ${validTypes.join(', ')}`,
          });
          process.exit(1);
        }
        logger.error(`Invalid type: ${type}`);
        logger.info(`Valid types: ${validTypes.join(', ')}`);
        process.exit(1);
      }

      let items: any[] = [];
      let listType: ListResponseData['type'] = 'page-types';

      switch (type) {
        case 'page-types': {
          listType = 'page-types';
          const pageTypesPath = path.join(workspace.getPath(), 'data', 'pageTypes.json');
          if (!fs.existsSync(pageTypesPath)) {
            if (output.isJsonMode()) {
              output.error(ErrorCode.NO_PAGE_TYPES, 'No page types found', {
                recoverable: true,
                suggestion: 'Run "s2s analyze" first to detect page types',
              });
              process.exit(1);
            }
            logger.error('No page types found. Run "s2s analyze" first.');
            process.exit(1);
          }

          const pageTypes = JSON.parse(fs.readFileSync(pageTypesPath, 'utf-8')) as PageType[];

          if (options.verbose) {
            items = pageTypes;
          } else {
            items = pageTypes.map(pt => ({
              id: pt.id,
              name: pt.name,
              pageCount: pt.pageCount,
              confidence: pt.confidence,
              urlPattern: pt.urlPattern,
              examples: pt.examples.slice(0, 3),
              features: {
                hasDate: pt.features.hasDate,
                hasAuthor: pt.features.hasAuthor,
                hasPrice: pt.features.hasPrice,
                richContent: pt.features.richContent,
              },
            }));
          }
          break;
        }

        case 'objects': {
          listType = 'objects';
          const objectsPath = path.join(workspace.getPath(), 'data', 'objects.json');
          if (!fs.existsSync(objectsPath)) {
            if (output.isJsonMode()) {
              output.error(ErrorCode.ANALYSIS_FAILED, 'No objects found', {
                recoverable: true,
                suggestion: 'Run "s2s analyze" first to detect objects',
              });
              process.exit(1);
            }
            logger.error('No objects found. Run "s2s analyze" first.');
            process.exit(1);
          }

          const objects = JSON.parse(fs.readFileSync(objectsPath, 'utf-8')) as DetectedObject[];

          if (options.verbose) {
            items = objects;
          } else {
            items = objects.map(obj => ({
              id: obj.id,
              type: obj.type,
              name: obj.name,
              instanceCount: obj.instances.length,
              confidence: obj.confidence,
              fields: obj.suggestedFields.map(f => ({
                name: f.name,
                type: f.type,
                required: f.required,
              })),
              referencedBy: obj.pageTypeRefs,
            }));
          }
          break;
        }

        case 'blocks': {
          listType = 'blocks';
          const aiAnalysisPath = path.join(workspace.getPath(), 'data', 'aiAnalysis.json');
          if (!fs.existsSync(aiAnalysisPath)) {
            if (output.isJsonMode()) {
              // Return empty list instead of error - blocks are optional
              const responseData: ListResponseData = {
                workspace: workspace.getPath(),
                type: listType,
                items: [],
                count: 0,
              };
              output.success(responseData);
              return;
            }
            logger.warn('No AI analysis found. Run "s2s start" with AI enabled to detect blocks.');
            return;
          }

          const aiAnalysis = JSON.parse(fs.readFileSync(aiAnalysisPath, 'utf-8')) as AIAnalysisResult;

          if (options.verbose) {
            items = aiAnalysis.detectedBlocks;
          } else {
            items = aiAnalysis.detectedBlocks.map(block => ({
              name: block.name,
              description: block.description,
              occurrences: block.occurrences,
              fields: block.fields.map(f => ({
                name: f.name,
                type: f.type,
              })),
            }));
          }
          break;
        }

        case 'documents': {
          listType = 'documents';
          const modelPath = path.join(workspace.getPath(), 'data', 'model.json');
          if (!fs.existsSync(modelPath)) {
            if (output.isJsonMode()) {
              output.error(ErrorCode.NO_MODEL_FOUND, 'No model found', {
                recoverable: true,
                suggestion: 'Run "s2s map" first to create the schema model',
              });
              process.exit(1);
            }
            logger.error('No model found. Run "s2s map" first.');
            process.exit(1);
          }

          const model = JSON.parse(fs.readFileSync(modelPath, 'utf-8')) as SanityModel;

          if (options.verbose) {
            items = [
              ...model.documents,
              ...model.objects.map(o => ({ ...o, category: 'object' })),
              ...model.blocks.map(b => ({ ...b, category: 'block' })),
              ...model.singletons.map(s => ({ ...s, category: 'singleton' })),
            ];
          } else {
            items = [
              ...model.documents.map(d => ({
                name: d.name,
                title: d.title,
                category: 'document',
                fieldCount: d.fields.length,
                mode: d.mode,
              })),
              ...model.objects.map(o => ({
                name: o.name,
                title: o.title,
                category: 'object',
                fieldCount: o.fields.length,
              })),
              ...model.blocks.map(b => ({
                name: b.name,
                title: b.title,
                category: 'block',
                fieldCount: b.fields.length,
              })),
              ...model.singletons.map(s => ({
                name: s.name,
                title: s.title,
                category: 'singleton',
                fieldCount: s.fields.length,
              })),
            ];
          }
          break;
        }
      }

      // Output results
      if (output.isJsonMode()) {
        const responseData: ListResponseData = {
          workspace: workspace.getPath(),
          type: listType,
          items,
          count: items.length,
        };
        output.success(responseData);
      } else {
        logger.section(`${type.charAt(0).toUpperCase() + type.slice(1)}`);
        logger.info(`Found ${items.length} items\n`);

        items.forEach((item, index) => {
          switch (type) {
            case 'page-types':
              console.log(`  ${index + 1}. ${item.name}`);
              console.log(`     Pages: ${item.pageCount} | Confidence: ${(item.confidence * 100).toFixed(0)}%`);
              if (item.urlPattern) {
                console.log(`     Pattern: ${item.urlPattern}`);
              }
              if (item.examples?.length > 0) {
                console.log(`     Example: ${item.examples[0]}`);
              }
              console.log();
              break;

            case 'objects':
              console.log(`  ${index + 1}. ${item.name} (${item.type})`);
              console.log(`     Instances: ${item.instanceCount} | Confidence: ${(item.confidence * 100).toFixed(0)}%`);
              if (item.fields?.length > 0) {
                console.log(`     Fields: ${item.fields.map((f: any) => f.name).join(', ')}`);
              }
              console.log();
              break;

            case 'blocks':
              console.log(`  ${index + 1}. ${item.name}`);
              console.log(`     ${item.description}`);
              console.log(`     Occurrences: ${item.occurrences}`);
              if (item.fields?.length > 0) {
                console.log(`     Fields: ${item.fields.map((f: any) => f.name).join(', ')}`);
              }
              console.log();
              break;

            case 'documents':
              const categoryIcons: Record<string, string> = {
                document: '📄',
                object: '📦',
                block: '🧱',
                singleton: '⚙️',
              };
              const categoryIcon = categoryIcons[item.category as string] || '📄';
              console.log(`  ${categoryIcon} ${item.name} (${item.category})`);
              console.log(`     Title: ${item.title} | Fields: ${item.fieldCount}`);
              console.log();
              break;
          }
        });
      }
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (output.isJsonMode()) {
        output.error(ErrorCode.UNKNOWN_ERROR, 'Failed to list items', {
          details: errorMessage,
          recoverable: true,
        });
      } else {
        logger.error(`Failed to list items: ${errorMessage}`);
        if (process.env.DEBUG) {
          console.error(error);
        }
      }
      process.exit(1);
    }
  });
