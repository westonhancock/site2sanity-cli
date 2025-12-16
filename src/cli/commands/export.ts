/**
 * Export command - Generate Sanity artifacts
 *
 * Supports --json flag for AI-agent friendly output
 * Supports --types filter to export only specific document types
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';
import { SanityModel, MappingSpec } from '../../types';
import { SanityExporter } from '../../core/exporter/sanity';
import {
  createOutput,
  ErrorCode,
  ErrorResponses,
  ExportResponseData,
} from '../../utils/output';
import * as path from 'path';
import * as fs from 'fs';

export const exportCommand = new Command('export')
  .description('Export Sanity schema files (supports --json, --types, --exclude-types for AI agents)')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('-o, --out <directory>', 'Output directory', 'out')
  .option('--types <types>', 'Comma-separated list of document types to include')
  .option('--exclude-types <types>', 'Comma-separated list of document types to exclude')
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

      let model = await workspace.loadJSON<SanityModel>('model.json');

      if (!model) {
        if (output.isJsonMode()) {
          output.error(
            ErrorCode.NO_MODEL_FOUND,
            'No schema model found',
            ErrorResponses.noModelFound()
          );
          process.exit(1);
        }
        logger.error('No model found. Run "s2s map" first.');
        process.exit(1);
      }

      // Apply type filters
      if (options.types) {
        const includeTypes = options.types.split(',').map((t: string) => t.trim().toLowerCase());
        model = {
          ...model,
          documents: model.documents.filter(d =>
            includeTypes.includes(d.name.toLowerCase())
          ),
        };
        if (!output.isJsonMode()) {
          logger.info(`Filtering to types: ${includeTypes.join(', ')}`);
        }
      }

      if (options.excludeTypes) {
        const excludeTypes = options.excludeTypes.split(',').map((t: string) => t.trim().toLowerCase());
        model = {
          ...model,
          documents: model.documents.filter(d =>
            !excludeTypes.includes(d.name.toLowerCase())
          ),
        };
        if (!output.isJsonMode()) {
          logger.info(`Excluding types: ${excludeTypes.join(', ')}`);
        }
      }

      if (!output.isJsonMode()) {
        logger.section('Exporting Sanity Artifacts');
      }

      const outDir = path.resolve(options.out);

      // Export Sanity schema
      if (!output.isJsonMode()) {
        logger.startSpinner('Generating Sanity schema...');
      }
      const exporter = new SanityExporter(outDir);
      await exporter.export(model);
      if (!output.isJsonMode()) {
        logger.succeedSpinner('Sanity schema exported');
      }

      // Export mapping spec
      if (!output.isJsonMode()) {
        logger.startSpinner('Generating mapping spec...');
      }
      const config = await workspace.loadConfig();
      const mappingSpec: MappingSpec = {
        version: '1.0.0',
        source: {
          baseUrl: config.baseUrl,
          crawledAt: new Date(),
          pageCount: 0, // TODO: get from db
        },
        idStrategy: {
          type: 'url-hash',
        },
        mappings: [],
        globalMappings: [],
      };

      const mappingPath = path.join(outDir, 'mapping', 'mappingSpec.json');
      if (!fs.existsSync(path.dirname(mappingPath))) {
        fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
      }
      fs.writeFileSync(mappingPath, JSON.stringify(mappingSpec, null, 2));
      if (!output.isJsonMode()) {
        logger.succeedSpinner('Mapping spec exported');
      }

      // Collect exported files info
      const exportedFiles: Array<{ path: string; type: string }> = [];

      // Add document files
      model.documents.forEach(doc => {
        exportedFiles.push({
          path: path.join(outDir, 'sanity', 'schemaTypes', 'documents', `${doc.name}.ts`),
          type: 'document',
        });
      });

      // Add object files
      model.objects.forEach(obj => {
        exportedFiles.push({
          path: path.join(outDir, 'sanity', 'schemaTypes', 'objects', `${obj.name}.ts`),
          type: 'object',
        });
      });

      // Add block files
      model.blocks.forEach(block => {
        exportedFiles.push({
          path: path.join(outDir, 'sanity', 'schemaTypes', 'blocks', `${block.name}.ts`),
          type: 'block',
        });
      });

      // Add singleton files
      model.singletons.forEach(singleton => {
        exportedFiles.push({
          path: path.join(outDir, 'sanity', 'schemaTypes', 'singletons', `${singleton.name}.ts`),
          type: 'singleton',
        });
      });

      // Add config/readme files
      exportedFiles.push({
        path: path.join(outDir, 'sanity', 'schemaTypes', 'index.ts'),
        type: 'config',
      });
      exportedFiles.push({
        path: path.join(outDir, 'sanity', 'README.md'),
        type: 'readme',
      });
      exportedFiles.push({
        path: mappingPath,
        type: 'config',
      });

      // Output results
      if (output.isJsonMode()) {
        const responseData: ExportResponseData = {
          workspace: workspace.getPath(),
          outputDir: outDir,
          files: exportedFiles.map(f => ({
            path: f.path,
            type: f.type as any,
          })),
          stats: {
            documents: model.documents.length,
            objects: model.objects.length,
            blocks: model.blocks.length,
            singletons: model.singletons.length,
            totalFiles: exportedFiles.length,
          },
        };
        output.success(responseData);
      } else {
        logger.success('Export completed!');
        console.log();
        logger.info(`Output directory: ${outDir}`);
        console.log();
        logger.info('Generated files:');
        console.log(`  ${outDir}/sanity/schemaTypes/`);
        console.log(`  ${outDir}/sanity/README.md`);
        console.log(`  ${outDir}/mapping/mappingSpec.json`);
        console.log();
        logger.info('Stats:');
        console.log(`  Documents: ${model.documents.length}`);
        console.log(`  Objects: ${model.objects.length}`);
        console.log(`  Blocks: ${model.blocks.length}`);
        console.log(`  Singletons: ${model.singletons.length}`);
        console.log();
        logger.info('Next steps:');
        console.log('  1. Copy schemaTypes to your Sanity Studio project');
        console.log('  2. Follow instructions in README.md');
        console.log('  3. Use mappingSpec.json to implement content migration');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (output.isJsonMode()) {
        output.error(ErrorCode.EXPORT_FAILED, 'Export failed', {
          details: errorMessage,
          recoverable: true,
          suggestion: 'Check that model.json exists and is valid',
        });
      } else {
        logger.error(`Export failed: ${errorMessage}`);
        if (process.env.DEBUG) {
          console.error(error);
        }
      }
      process.exit(1);
    }
  });
