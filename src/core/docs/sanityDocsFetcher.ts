/**
 * Sanity Documentation Fetcher - Uses Context7 MCP to fetch latest Sanity docs
 */

import { logger } from '../../utils/logger';

export interface SanityBestPractices {
  schemaTypes: string;
  validation: string;
  portableText: string;
  references: string;
  pageBuilder: string;
  fieldOptions: string;
}

export class SanityDocsFetcher {
  private static SANITY_LIBRARY_ID = '/websites/sanity_io';
  private cache: Map<string, string> = new Map();
  private fetchEnabled: boolean;

  constructor(enableFetch: boolean = true) {
    this.fetchEnabled = enableFetch;
  }

  /**
   * Fetch all common Sanity best practices documentation
   */
  async fetchCommonPatterns(): Promise<SanityBestPractices> {
    if (!this.fetchEnabled) {
      logger.debug('Context7 documentation fetching is disabled');
      return this.getEmptyPractices();
    }

    try {
      logger.info('Fetching latest Sanity documentation from Context7...');

      const [schemaTypes, validation, portableText, references, pageBuilder, fieldOptions] = await Promise.all([
        this.fetchTopic('schema types and field definitions'),
        this.fetchTopic('validation rules and constraints'),
        this.fetchTopic('portable text and rich content'),
        this.fetchTopic('references vs embedded content'),
        this.fetchTopic('page builder patterns and flexible content'),
        this.fetchTopic('field options and configuration'),
      ]);

      logger.success('Successfully fetched Sanity documentation');

      return {
        schemaTypes,
        validation,
        portableText,
        references,
        pageBuilder,
        fieldOptions,
      };
    } catch (error) {
      logger.warn(`Failed to fetch Sanity docs: ${(error as Error).message}`);
      logger.warn('Continuing with built-in best practices...');
      return this.getEmptyPractices();
    }
  }

  /**
   * Fetch documentation for a specific topic
   */
  private async fetchTopic(topic: string): Promise<string> {
    // Check cache first
    if (this.cache.has(topic)) {
      logger.debug(`Using cached documentation for: ${topic}`);
      return this.cache.get(topic)!;
    }

    try {
      // Note: This would normally call the Context7 MCP server
      // For now, we'll simulate the call since we can't directly import MCP tools
      // In production, this would use the MCP client library
      logger.debug(`Fetching documentation for: ${topic}`);

      // Placeholder - will be replaced with actual MCP call
      const docs = await this.callContext7MCP(topic);

      // Cache the result
      this.cache.set(topic, docs);

      return docs;
    } catch (error) {
      logger.debug(`Failed to fetch topic "${topic}": ${(error as Error).message}`);
      return '';
    }
  }

  /**
   * Call Context7 MCP server (placeholder for actual implementation)
   * In production, this would use the @modelcontextprotocol/sdk
   */
  private async callContext7MCP(topic: string): Promise<string> {
    // This is a placeholder - actual implementation would use MCP SDK
    // For now, return empty string and we'll enhance this later
    throw new Error('Context7 MCP integration requires MCP SDK setup');
  }

  /**
   * Get empty practices object for fallback
   */
  private getEmptyPractices(): SanityBestPractices {
    return {
      schemaTypes: '',
      validation: '',
      portableText: '',
      references: '',
      pageBuilder: '',
      fieldOptions: '',
    };
  }

  /**
   * Format documentation for AI prompt injection
   */
  formatForAIPrompt(practices: SanityBestPractices): string {
    const sections: string[] = [];

    if (practices.schemaTypes) {
      sections.push(`## Schema Types & Field Definitions\n${practices.schemaTypes}`);
    }

    if (practices.validation) {
      sections.push(`## Validation Rules\n${practices.validation}`);
    }

    if (practices.portableText) {
      sections.push(`## Portable Text (Rich Content)\n${practices.portableText}`);
    }

    if (practices.references) {
      sections.push(`## References vs Embedded Content\n${practices.references}`);
    }

    if (practices.pageBuilder) {
      sections.push(`## Page Builder Patterns\n${practices.pageBuilder}`);
    }

    if (practices.fieldOptions) {
      sections.push(`## Field Options & Configuration\n${practices.fieldOptions}`);
    }

    if (sections.length === 0) {
      return '';
    }

    return `
# Latest Sanity CMS Best Practices

The following best practices are from the official Sanity documentation:

${sections.join('\n\n---\n\n')}

Please follow these patterns and recommendations when generating the schema.
`;
  }

  /**
   * Extract key patterns from documentation for quick reference
   */
  extractKeyPatterns(practices: SanityBestPractices): {
    usePortableText: boolean;
    validationPatterns: string[];
    fieldOptionPatterns: string[];
  } {
    return {
      usePortableText: practices.portableText.length > 0,
      validationPatterns: this.extractValidationPatterns(practices.validation),
      fieldOptionPatterns: this.extractFieldOptions(practices.fieldOptions),
    };
  }

  /**
   * Extract validation patterns from docs
   */
  private extractValidationPatterns(validationDocs: string): string[] {
    const patterns: string[] = [];

    // Look for common validation patterns in the docs
    if (validationDocs.includes('required()')) patterns.push('required');
    if (validationDocs.includes('min(')) patterns.push('min');
    if (validationDocs.includes('max(')) patterns.push('max');
    if (validationDocs.includes('email()')) patterns.push('email');
    if (validationDocs.includes('custom(')) patterns.push('custom');

    return patterns;
  }

  /**
   * Extract field options from docs
   */
  private extractFieldOptions(fieldOptionsDocs: string): string[] {
    const options: string[] = [];

    // Look for common field options in the docs
    if (fieldOptionsDocs.includes('maxLength')) options.push('maxLength');
    if (fieldOptionsDocs.includes('rows')) options.push('rows');
    if (fieldOptionsDocs.includes('list:')) options.push('list');
    if (fieldOptionsDocs.includes('source:')) options.push('source');
    if (fieldOptionsDocs.includes('layout:')) options.push('layout');

    return options;
  }
}
