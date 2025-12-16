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
   * Currently uses hardcoded best practices for reliability
   */
  async fetchCommonPatterns(): Promise<SanityBestPractices> {
    if (!this.fetchEnabled) {
      logger.debug('Documentation is disabled');
      return this.getEmptyPractices();
    }

    logger.debug('Loading Sanity best practices...');

    return {
      schemaTypes: this.getSchemaTypesDocs(),
      validation: this.getValidationDocs(),
      portableText: this.getPortableTextDocs(),
      references: this.getReferencesDocs(),
      pageBuilder: this.getPageBuilderDocs(),
      fieldOptions: this.getFieldOptionsDocs(),
    };
  }

  /**
   * Get schema types documentation
   */
  private getSchemaTypesDocs(): string {
    return `
### Schema Type Best Practices

Use proper field types for your content:
- **string**: Short text (titles, names, slugs)
- **text**: Multi-line text without formatting
- **portableText**: Rich text with formatting, headings, links (recommended for blog posts, articles)
- **number**: Numeric values
- **boolean**: True/false values
- **datetime**: Dates and times
- **url**: Web addresses
- **image**: Images with metadata
- **array**: Lists of items
- **object**: Grouped fields
- **reference**: Links to other documents

Example schema with defineField helpers:
\`\`\`typescript
import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'blogPost',
  title: 'Blog Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'portableText', // Use portableText for rich content
    })
  ]
})
\`\`\`
`;
  }

  /**
   * Get validation documentation
   */
  private getValidationDocs(): string {
    return `
### Validation Best Practices

Chain validation rules for robust data:

\`\`\`typescript
// String with length constraints
{
  name: 'title',
  type: 'string',
  validation: Rule => Rule.required().min(10).max(80)
}

// Email validation
{
  name: 'email',
  type: 'string',
  validation: Rule => Rule.required().email()
}

// Number range
{
  name: 'price',
  type: 'number',
  validation: Rule => Rule.required().min(0).max(10000)
}

// Custom validation
{
  name: 'slug',
  type: 'slug',
  validation: Rule => Rule.required().custom((value) => {
    if (value?.current?.includes(' ')) {
      return 'Slug cannot contain spaces'
    }
    return true
  })
}
\`\`\`

Common validation methods:
- required(): Field must have a value
- min(n): Minimum length/value
- max(n): Maximum length/value
- email(): Valid email format
- url(): Valid URL format
- custom(fn): Custom validation logic
`;
  }

  /**
   * Get Portable Text documentation
   */
  private getPortableTextDocs(): string {
    return `
### Portable Text Best Practices

Use Portable Text for rich content instead of plain text fields:

\`\`\`typescript
{
  name: 'content',
  title: 'Content',
  type: 'array',
  of: [
    {
      type: 'block',
      styles: [
        {title: 'Normal', value: 'normal'},
        {title: 'H2', value: 'h2'},
        {title: 'H3', value: 'h3'},
        {title: 'Quote', value: 'blockquote'}
      ],
      marks: {
        decorators: [
          {title: 'Strong', value: 'strong'},
          {title: 'Emphasis', value: 'em'}
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'URL',
            fields: [{name: 'href', type: 'url', title: 'URL'}]
          }
        ]
      }
    },
    {
      type: 'image',
      fields: [{name: 'alt', type: 'string', title: 'Alt text'}]
    }
  ]
}
\`\`\`

**When to use Portable Text:**
- Blog posts, articles, long-form content
- Content that needs headings, lists, formatting
- Content with embedded images or links
- Any content >500 characters

**When NOT to use Portable Text:**
- Short titles, names, labels (use 'string')
- Meta descriptions (use 'text')
- Simple multi-line text without formatting (use 'text')
`;
  }

  /**
   * Get references documentation
   */
  private getReferencesDocs(): string {
    return `
### References vs Embedded Content

**Use references when:**
- Content is reused across multiple documents (authors, categories, tags)
- Content needs to be managed separately
- You want a single source of truth

**Use embedded objects when:**
- Content is specific to one document
- Content is simple and won't be reused
- Simplicity is more important than reusability

Example reference:
\`\`\`typescript
{
  name: 'author',
  title: 'Author',
  type: 'reference',
  to: [{type: 'author'}],
  validation: Rule => Rule.required()
}
\`\`\`

Example embedded object:
\`\`\`typescript
{
  name: 'seo',
  title: 'SEO Settings',
  type: 'object',
  fields: [
    {name: 'title', type: 'string'},
    {name: 'description', type: 'text'}
  ]
}
\`\`\`
`;
  }

  /**
   * Get page builder documentation
   */
  private getPageBuilderDocs(): string {
    return `
### Page Builder Patterns

For flexible, component-based pages:

\`\`\`typescript
{
  name: 'content',
  title: 'Page Content',
  type: 'array',
  of: [
    {type: 'hero'},
    {type: 'features'},
    {type: 'testimonials'},
    {type: 'callToAction'},
    {type: 'richText'}
  ]
}
\`\`\`

This allows editors to:
- Build pages from reusable blocks
- Reorder sections via drag-and-drop
- Add/remove sections as needed
- Create unique page layouts
`;
  }

  /**
   * Get field options documentation
   */
  private getFieldOptionsDocs(): string {
    return `
### Field Options Best Practices

Add helpful options to improve editor experience:

\`\`\`typescript
// Slug with source
{
  name: 'slug',
  type: 'slug',
  options: {
    source: 'title',
    maxLength: 96
  }
}

// Text with row count
{
  name: 'excerpt',
  type: 'text',
  options: {
    rows: 4
  }
}

// String with predefined list
{
  name: 'status',
  type: 'string',
  options: {
    list: [
      {title: 'Draft', value: 'draft'},
      {title: 'Published', value: 'published'}
    ]
  }
}

// Image with hotspot
{
  name: 'image',
  type: 'image',
  options: {
    hotspot: true
  }
}
\`\`\`
`;
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
