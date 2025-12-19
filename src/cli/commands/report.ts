/**
 * Report command - Generate analysis report
 */

import { Command } from 'commander';
import { Workspace } from '../../utils/workspace';
import { CrawlDatabase } from '../../utils/database';
import { logger } from '../../utils/logger';
import { PageType, NavigationStructure, Relationship } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

export const reportCommand = new Command('report')
  .description('Generate a comprehensive analysis report')
  .option('-d, --dir <directory>', 'Global workspace directory', '~/.s2s')
  .option('-f, --format <format>', 'Output format: md or json', 'md')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options: any) => {
    try {
      const workspace = new Workspace(options.dir);

      if (!workspace.exists()) {
        logger.error('Workspace not initialized. Run "s2s init <url>" first.');
        process.exit(1);
      }

      const config = await workspace.loadConfig();
      const db = new CrawlDatabase(workspace.getPath());
      const pages = db.getAllPages();

      const navigation = await workspace.loadJSON<NavigationStructure>('navigation.json');
      const pageTypes = await workspace.loadJSON<PageType[]>('pageTypes.json');
      const relationships = await workspace.loadJSON<Relationship[]>('relationships.json');

      logger.section('Generating Report');

      const report = {
        meta: {
          generatedAt: new Date().toISOString(),
          version: '0.1.0',
          baseUrl: config.baseUrl,
        },
        crawl: {
          totalPages: pages.length,
          successfulPages: pages.filter(p => p.status === 200).length,
          errors: pages.filter(p => p.status !== 200).length,
          duration: 0, // TODO: calculate from metadata
        },
        navigation: navigation ? {
          primaryNavItems: navigation.primaryNav.length,
          footerItems: navigation.footer.length,
          breadcrumbPatterns: navigation.breadcrumbs.length,
          hierarchy: 'detected',
        } : null,
        pageTypes: pageTypes ? pageTypes.map(pt => ({
          name: pt.name,
          count: pt.pageCount,
          confidence: pt.confidence,
          examples: pt.examples.slice(0, 3),
          proposedDocumentType: pt.name,
        })) : [],
        relationships: relationships || [],
        migration: {
          idStrategy: 'url-hash',
          slugStrategy: config.sanity.slugStrategy,
          referencesCount: (relationships?.length || 0),
          ndjsonReady: true,
          estimatedComplexity: (pageTypes?.length || 0) > 10 ? 'high' : 'medium',
          notes: [
            'Stable ID strategy based on URL hashing',
            'References require NDJSON import in correct order',
            'Review and customize generated schema before importing',
          ],
        },
      };

      if (options.format === 'json') {
        const output = JSON.stringify(report, null, 2);
        if (options.output) {
          fs.writeFileSync(options.output, output);
          logger.success(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        // Markdown format
        const markdown = generateMarkdownReport(report);
        if (options.output) {
          fs.writeFileSync(options.output, markdown);
          logger.success(`Report saved to ${options.output}`);
        } else {
          console.log(markdown);
        }
      }

      db.close();
    } catch (error) {
      logger.error(`Report generation failed: ${(error as Error).message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });

function generateMarkdownReport(report: any): string {
  return `# Site2Sanity Analysis Report

**Generated:** ${new Date(report.meta.generatedAt).toLocaleString()}
**Base URL:** ${report.meta.baseUrl}

## Crawl Summary

- **Total Pages:** ${report.crawl.totalPages}
- **Successful:** ${report.crawl.successfulPages}
- **Errors:** ${report.crawl.errors}

## Navigation Structure

${report.navigation ? `
- **Primary Navigation:** ${report.navigation.primaryNavItems} items
- **Footer Links:** ${report.navigation.footerItems} items
- **Breadcrumb Patterns:** ${report.navigation.breadcrumbPatterns} patterns
` : '_Not analyzed yet. Run \`site2sanity analyze\` first._'}

## Page Types

${report.pageTypes.length > 0 ? report.pageTypes.map((pt: any) => `
### ${pt.name}

- **Count:** ${pt.count} pages
- **Confidence:** ${(pt.confidence * 100).toFixed(0)}%
- **Proposed Document Type:** \`${pt.proposedDocumentType}\`
- **Examples:**
${pt.examples.map((ex: string) => `  - ${ex}`).join('\n')}
`).join('\n') : '_No page types detected. Run \`site2sanity analyze\` first._'}

## Relationships

${report.relationships.length > 0 ? report.relationships.map((rel: any) => `
- **${rel.type}:** ${rel.description}
`).join('\n') : '_No relationships detected._'}

## Migration Readiness

- **ID Strategy:** ${report.migration.idStrategy}
- **Slug Strategy:** ${report.migration.slugStrategy}
- **References:** ${report.migration.referencesCount}
- **NDJSON Ready:** ${report.migration.ndjsonReady ? 'Yes' : 'No'}
- **Estimated Complexity:** ${report.migration.estimatedComplexity}

### Notes

${report.migration.notes.map((note: string) => `- ${note}`).join('\n')}

---

*Generated by site2sanity-cli v${report.meta.version}*
`;
}
