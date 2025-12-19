/**
 * Lint command - Validate Sanity schema
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { logger } from '../../utils/logger';
import { SanityModel, LintResult, LintIssue } from '../../types';

export const lintCommand = new Command('lint')
  .description('Validate Sanity schema for correctness and best practices')
  .option('-d, --dir <directory>', 'Global workspace directory', '~/.s2s')
  .action(async (options: any) => {
    try {
      const workspace = new Workspace(options.dir);

      if (!workspace.exists()) {
        logger.error('Workspace not initialized. Run "s2s init <url>" first.');
        process.exit(1);
      }

      const model = await workspace.loadJSON<SanityModel>('model.json');

      if (!model) {
        logger.error('No model found. Run "s2s map" first.');
        process.exit(1);
      }

      logger.section('Linting Sanity Schema');

      const result = lintModel(model);

      // Display errors
      if (result.errors.length > 0) {
        logger.warn(`Found ${result.errors.length} error(s):`);
        console.log();
        result.errors.forEach(issue => {
          logger.error(`[${issue.code}] ${issue.message}`);
          if (issue.location) {
            console.log(`  Location: ${issue.location}`);
          }
          if (issue.fix) {
            console.log(`  Fix: ${issue.fix}`);
          }
          console.log();
        });
      }

      // Display warnings
      if (result.warnings.length > 0) {
        logger.warn(`Found ${result.warnings.length} warning(s):`);
        console.log();
        result.warnings.forEach(issue => {
          logger.warn(`[${issue.code}] ${issue.message}`);
          if (issue.location) {
            console.log(`  Location: ${issue.location}`);
          }
          if (issue.fix) {
            console.log(`  Fix: ${issue.fix}`);
          }
          console.log();
        });
      }

      if (result.valid) {
        logger.success('Schema is valid!');
        console.log();
        logger.info('Next step:');
        console.log('  Run "s2s export" to generate TypeScript files');
      } else {
        logger.error('Schema has errors. Please fix them before exporting.');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Lint failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });

/**
 * Lint the model
 */
function lintModel(model: SanityModel): LintResult {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];

  // Check document types
  for (const doc of model.documents) {
    // Check name
    if (!doc.name || !/^[a-z][a-zA-Z0-9]*$/.test(doc.name)) {
      errors.push({
        code: 'INVALID_NAME',
        severity: 'error',
        message: `Document type "${doc.name}" has invalid name (must start with lowercase letter)`,
        location: `documents/${doc.name}`,
        fix: 'Rename to start with lowercase letter and use camelCase',
      });
    }

    // Check for required fields
    if (!doc.fields || doc.fields.length === 0) {
      warnings.push({
        code: 'NO_FIELDS',
        severity: 'warning',
        message: `Document type "${doc.name}" has no fields`,
        location: `documents/${doc.name}`,
        fix: 'Add at least one field',
      });
    }

    // Check for slug on routable types
    const hasSlug = doc.fields?.some(f => f.type === 'slug');
    if (!hasSlug && !doc.singleton) {
      warnings.push({
        code: 'MISSING_SLUG',
        severity: 'warning',
        message: `Document type "${doc.name}" is missing a slug field`,
        location: `documents/${doc.name}`,
        fix: 'Add a slug field for URL generation',
      });
    }

    // Check for preview
    if (!doc.preview) {
      warnings.push({
        code: 'MISSING_PREVIEW',
        severity: 'warning',
        message: `Document type "${doc.name}" is missing preview configuration`,
        location: `documents/${doc.name}`,
        fix: 'Add preview.select with at least a title field',
      });
    }

    // Check field types
    for (const field of doc.fields || []) {
      if (!field.name || !field.type) {
        errors.push({
          code: 'INVALID_FIELD',
          severity: 'error',
          message: `Field in "${doc.name}" is missing name or type`,
          location: `documents/${doc.name}`,
          fix: 'Ensure all fields have name and type',
        });
      }

      // Check reference fields
      if (field.type === 'reference' && !field.to) {
        errors.push({
          code: 'MISSING_REFERENCE_TO',
          severity: 'error',
          message: `Reference field "${field.name}" in "${doc.name}" is missing "to" property`,
          location: `documents/${doc.name}.${field.name}`,
          fix: 'Add "to" array specifying which document types can be referenced',
        });
      }
    }
  }

  return {
    errors,
    warnings,
    valid: errors.length === 0,
  };
}
