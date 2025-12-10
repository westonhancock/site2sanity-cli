/**
 * Sanity schema exporter - generates TypeScript schema files
 */

import * as fs from 'fs';
import * as path from 'path';
import { SanityModel, SanityDocumentType, SanityField } from '../../types';

export class SanityExporter {
  private outDir: string;

  constructor(outDir: string) {
    this.outDir = outDir;
  }

  /**
   * Export Sanity schema as TypeScript
   */
  async export(model: SanityModel): Promise<void> {
    // Create directory structure
    const schemaDir = path.join(this.outDir, 'sanity', 'schemaTypes');
    const docDir = path.join(schemaDir, 'documents');
    const objDir = path.join(schemaDir, 'objects');
    const blockDir = path.join(schemaDir, 'blocks');

    for (const dir of [schemaDir, docDir, objDir, blockDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Export documents
    for (const doc of [...model.documents, ...model.singletons]) {
      const content = this.generateDocumentType(doc);
      fs.writeFileSync(
        path.join(docDir, `${doc.name}.ts`),
        content
      );
    }

    // Export common objects
    this.exportCommonObjects(objDir);

    // Export index file
    const indexContent = this.generateIndexFile(model);
    fs.writeFileSync(path.join(schemaDir, 'index.ts'), indexContent);

    // Export README
    const readmeContent = this.generateReadme();
    fs.writeFileSync(path.join(this.outDir, 'sanity', 'README.md'), readmeContent);
  }

  /**
   * Generate document type TypeScript
   */
  private generateDocumentType(doc: SanityDocumentType): string {
    const fields = this.generateFields(doc.fields);
    const preview = doc.preview ? this.generatePreview(doc.preview) : '';

    return `import { defineType, defineField } from 'sanity'

export default defineType({
  name: '${doc.name}',
  title: '${doc.title}',
  type: 'document',
  fields: [
${fields}
  ],${preview}
})
`;
  }

  /**
   * Generate fields array
   */
  private generateFields(fields: SanityField[], indent: string = '    '): string {
    return fields.map(field => {
      const options = field.options ? `,\n${indent}  options: ${JSON.stringify(field.options, null, 2).split('\n').join(`\n${indent}  `)}` : '';
      const validation = field.validation ? `,\n${indent}  validation: (Rule) => Rule.${field.validation}()` : '';
      const description = field.description ? `,\n${indent}  description: '${field.description}'` : '';
      const of = field.of ? `,\n${indent}  of: ${JSON.stringify(field.of, null, 2).split('\n').join(`\n${indent}  `)}` : '';
      const to = field.to ? `,\n${indent}  to: ${JSON.stringify(field.to, null, 2).split('\n').join(`\n${indent}  `)}` : '';

      return `${indent}defineField({
${indent}  name: '${field.name}',
${indent}  title: '${field.title}',
${indent}  type: '${field.type}'${options}${validation}${description}${of}${to}
${indent}})`;
    }).join(',\n');
  }

  /**
   * Generate preview configuration
   */
  private generatePreview(preview: any): string {
    return `
  preview: {
    select: ${JSON.stringify(preview.select, null, 4).split('\n').join('\n    ')}
  }`;
  }

  /**
   * Export common reusable objects
   */
  private exportCommonObjects(objDir: string): void {
    // SEO object
    const seoObject = `import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'SEO Title',
      type: 'string',
      description: 'Overrides the default page title for search engines'
    }),
    defineField({
      name: 'description',
      title: 'SEO Description',
      type: 'text',
      rows: 3,
      description: 'Brief description for search engines (150-160 characters)'
    }),
    defineField({
      name: 'image',
      title: 'Social Share Image',
      type: 'image',
      description: 'Image displayed when sharing on social media'
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from Search Engines',
      type: 'boolean',
      description: 'Prevent search engines from indexing this page'
    })
  ]
})
`;
    fs.writeFileSync(path.join(objDir, 'seo.ts'), seoObject);

    // Link object
    const linkObject = `import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'link',
  title: 'Link',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Link Text',
      type: 'string'
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url'
    }),
    defineField({
      name: 'external',
      title: 'Open in New Tab',
      type: 'boolean',
      initialValue: false
    })
  ]
})
`;
    fs.writeFileSync(path.join(objDir, 'link.ts'), linkObject);
  }

  /**
   * Generate index file that exports all schema types
   */
  private generateIndexFile(model: SanityModel): string {
    const imports: string[] = [];
    const exports: string[] = [];

    // Documents
    for (const doc of [...model.documents, ...model.singletons]) {
      imports.push(`import ${doc.name} from './documents/${doc.name}'`);
      exports.push(doc.name);
    }

    // Common objects
    imports.push(`import seo from './objects/seo'`);
    imports.push(`import link from './objects/link'`);
    exports.push('seo', 'link');

    return `${imports.join('\n')}

export const schemaTypes = [
  ${exports.join(',\n  ')}
]
`;
  }

  /**
   * Generate README with integration instructions
   */
  private generateReadme(): string {
    return `# Sanity Schema

This schema was generated by site2sanity-cli.

## Integration

1. Copy the \`schemaTypes\` directory to your Sanity Studio project.

2. Update your \`sanity.config.ts\` to import and use the schema:

\`\`\`typescript
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'My Site',

  projectId: 'your-project-id',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
})
\`\`\`

3. Start your Sanity Studio:

\`\`\`bash
npm run dev
\`\`\`

## Schema Types

This schema includes:

- **Document Types**: Content types that can be created and managed
- **Object Types**: Reusable field groups (seo, link, etc.)
- **Singleton Types**: Global settings documents (only one instance)

## Next Steps

- Customize field validations and descriptions
- Add custom input components
- Configure document actions
- Set up previews for reference fields
- Add initial value templates
`;
  }
}
