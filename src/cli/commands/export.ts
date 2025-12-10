/**
 * Export command - Generate Sanity artifacts
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';
import { SanityModel, MappingSpec } from '../../types';
import { SanityExporter } from '../../core/exporter/sanity';
import * as path from 'path';

export const exportCommand = new Command('export')
  .description('Export Sanity schema and migration artifacts')
  .option('-d, --dir <directory>', 'Workspace directory', '.site2sanity')
  .option('-o, --out <directory>', 'Output directory', 'out')
  .action(async (options: any) => {
    try {
      const workspace = new Workspace(options.dir);

      if (!workspace.exists()) {
        logger.error('Workspace not initialized. Run "site2sanity init <url>" first.');
        process.exit(1);
      }

      const model = await workspace.loadJSON<SanityModel>('model.json');

      if (!model) {
        logger.error('No model found. Run "site2sanity map" first.');
        process.exit(1);
      }

      logger.section('Exporting Sanity Artifacts');

      const outDir = path.resolve(options.out);

      // Export Sanity schema
      logger.startSpinner('Generating Sanity schema...');
      const exporter = new SanityExporter(outDir);
      await exporter.export(model);
      logger.succeedSpinner('Sanity schema exported');

      // Export mapping spec
      logger.startSpinner('Generating mapping spec...');
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

      const fs = require('fs');
      const mappingPath = path.join(outDir, 'mapping', 'mappingSpec.json');
      if (!fs.existsSync(path.dirname(mappingPath))) {
        fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
      }
      fs.writeFileSync(mappingPath, JSON.stringify(mappingSpec, null, 2));
      logger.succeedSpinner('Mapping spec exported');

      logger.success('Export completed!');
      console.log();
      logger.info(`Output directory: ${outDir}`);
      console.log();
      logger.info('Generated files:');
      console.log(`  ${outDir}/sanity/schemaTypes/`);
      console.log(`  ${outDir}/sanity/README.md`);
      console.log(`  ${outDir}/mapping/mappingSpec.json`);
      console.log();
      logger.info('Next steps:');
      console.log('  1. Copy schemaTypes to your Sanity Studio project');
      console.log('  2. Follow instructions in README.md');
      console.log('  3. Use mappingSpec.json to implement content migration');
    } catch (error) {
      logger.error(`Export failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });
