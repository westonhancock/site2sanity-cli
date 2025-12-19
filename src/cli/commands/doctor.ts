/**
 * Doctor command - Diagnose workspace and environment
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export const doctorCommand = new Command('doctor')
  .description('Diagnose workspace and environment issues')
  .option('-d, --dir <directory>', 'Global workspace directory', '~/.s2s')
  .action(async (options: any) => {
    logger.section('Running Diagnostics');

    const workspace = new Workspace(options.dir);
    let issuesFound = 0;

    // Check if workspace exists
    logger.info('Checking workspace...');
    if (!workspace.exists()) {
      logger.error('Workspace not initialized');
      console.log('  Run: site2sanity init <url>');
      issuesFound++;
    } else {
      logger.success('Workspace exists');

      // Check config
      try {
        const config = await workspace.loadConfig();
        logger.success('Configuration is valid');
        console.log(`  Base URL: ${config.baseUrl}`);
      } catch (error) {
        logger.error('Configuration is invalid or corrupted');
        issuesFound++;
      }

      // Check database
      const dbPath = workspace.getPath('db.sqlite');
      if (fs.existsSync(dbPath)) {
        logger.success('Database exists');
        try {
          const { CrawlDatabase } = require('../../utils/database');
          const db = new CrawlDatabase(workspace.getPath());
          const pageCount = db.getPageCount();
          console.log(`  Pages crawled: ${pageCount}`);
          db.close();
        } catch (error) {
          logger.warn('Database exists but may be corrupted');
        }
      } else {
        logger.warn('Database not found');
        console.log('  This is normal for a new workspace');
      }

      // Check for analysis data
      logger.info('Checking analysis data...');
      const hasPageTypes = await workspace.loadJSON('pageTypes.json');
      const hasNavigation = await workspace.loadJSON('navigation.json');
      const hasRelationships = await workspace.loadJSON('relationships.json');

      if (hasPageTypes) {
        logger.success(`Page types detected: ${(hasPageTypes as any[]).length}`);
      } else {
        logger.warn('No page types found');
        console.log('  Run: site2sanity analyze');
      }

      if (hasNavigation) {
        logger.success('Navigation structure analyzed');
      } else {
        logger.warn('No navigation data found');
      }

      if (hasRelationships) {
        logger.success(`Relationships detected: ${(hasRelationships as any[]).length}`);
      } else {
        logger.warn('No relationships found');
      }

      // Check for model
      logger.info('Checking Sanity model...');
      const hasModel = await workspace.loadJSON('model.json');
      if (hasModel) {
        logger.success('Sanity model exists');
        const model = hasModel as any;
        console.log(`  Documents: ${model.documents?.length || 0}`);
        console.log(`  Objects: ${model.objects?.length || 0}`);
        console.log(`  Singletons: ${model.singletons?.length || 0}`);
      } else {
        logger.warn('No Sanity model found');
        console.log('  Run: site2sanity map');
      }
    }

    // Check Node.js version
    logger.info('Checking environment...');
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 18) {
      logger.success(`Node.js version: ${nodeVersion}`);
    } else {
      logger.error(`Node.js version ${nodeVersion} is too old (requires >= 18)`);
      issuesFound++;
    }

    // Check dependencies
    try {
      require('puppeteer');
      logger.success('Puppeteer is installed');
    } catch {
      logger.warn('Puppeteer not installed (required for --render mode)');
      console.log('  Run: npm install puppeteer');
    }

    console.log();
    if (issuesFound === 0) {
      logger.success('All checks passed!');
    } else {
      logger.warn(`Found ${issuesFound} issue(s)`);
      console.log();
      logger.info('For help, visit: https://github.com/westonhancock/site2sanity-cli');
    }
  });
