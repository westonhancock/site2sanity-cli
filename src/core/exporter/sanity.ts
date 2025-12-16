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
   * Validate model before export
   */
  private validateModel(model: SanityModel): string[] {
    const errors: string[] = [];
    const nameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const allTypeNames = new Set<string>();

    // Helper to check duplicate names
    const checkDuplicate = (name: string, category: string): void => {
      if (allTypeNames.has(name)) {
        errors.push(`Duplicate type name "${name}" found in ${category}`);
      } else {
        allTypeNames.add(name);
      }
    };

    // Helper to validate field names
    const validateFields = (fields: SanityField[], typeName: string): void => {
      if (!fields || !Array.isArray(fields)) {
        errors.push(`Type "${typeName}" has invalid fields property (must be an array)`);
        return;
      }

      for (const field of fields) {
        if (!field.name || !nameRegex.test(field.name)) {
          errors.push(`Type "${typeName}" has invalid field name: "${field.name}"`);
        }

        // Recursively validate nested object fields
        if (field.type === 'object' && field.fields) {
          validateFields(field.fields as SanityField[], `${typeName}.${field.name}`);
        }

        // Validate array 'of' property
        if (field.type === 'array') {
          if (!field.of || !Array.isArray(field.of) || field.of.length === 0) {
            errors.push(`Type "${typeName}" field "${field.name}" is an array but missing required "of" property`);
          } else {
            // Validate nested array item types
            for (const ofType of field.of) {
              if (ofType.type === 'object' && ofType.fields) {
                validateFields(ofType.fields as SanityField[], `${typeName}.${field.name}[item]`);
              }
            }
          }
        }
      }
    };

    // Validate documents
    for (const doc of model.documents) {
      if (!doc.name || !nameRegex.test(doc.name)) {
        errors.push(`Invalid document type name: "${doc.name}"`);
      }
      checkDuplicate(doc.name, 'documents');
      validateFields(doc.fields, doc.name);
    }

    // Validate singletons
    for (const singleton of model.singletons || []) {
      if (!singleton.name || !nameRegex.test(singleton.name)) {
        errors.push(`Invalid singleton type name: "${singleton.name}"`);
      }
      checkDuplicate(singleton.name, 'singletons');
      validateFields(singleton.fields, singleton.name);
    }

    // Validate objects
    for (const obj of model.objects) {
      if (!obj.name || !nameRegex.test(obj.name)) {
        errors.push(`Invalid object type name: "${obj.name}"`);
      }
      checkDuplicate(obj.name, 'objects');
      validateFields(obj.fields, obj.name);
    }

    // Validate blocks
    for (const block of model.blocks) {
      if (!block.name || !nameRegex.test(block.name)) {
        errors.push(`Invalid block type name: "${block.name}"`);
      }
      checkDuplicate(block.name, 'blocks');
      validateFields(block.fields, block.name);
    }

    return errors;
  }

  /**
   * Export Sanity schema as TypeScript
   */
  async export(model: SanityModel): Promise<void> {
    // Validate model before export
    const validationErrors = this.validateModel(model);
    if (validationErrors.length > 0) {
      throw new Error(
        `Schema validation failed:\n${validationErrors.map(e => `  • ${e}`).join('\n')}`
      );
    }

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

    // Export detected objects
    for (const obj of model.objects) {
      const content = this.generateObjectType(obj);
      fs.writeFileSync(
        path.join(objDir, `${obj.name}.ts`),
        content
      );
    }

    // Export blocks
    for (const block of model.blocks) {
      const content = this.generateObjectType(block); // Blocks use same format as objects
      fs.writeFileSync(
        path.join(blockDir, `${block.name}.ts`),
        content
      );
    }

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
      const validation = this.generateValidation(field, indent);
      const description = field.description ? `,\n${indent}  description: '${field.description}'` : '';

      // Handle nested object fields
      let nestedFields = '';
      if (field.type === 'object' && field.fields && field.fields.length > 0) {
        const nestedFieldsStr = this.generateFields(field.fields, indent + '  ');
        nestedFields = `,\n${indent}  fields: [\n${nestedFieldsStr}\n${indent}  ]`;
      }

      // Handle array 'of' property (can contain nested objects)
      let of = '';
      if (field.of && field.of.length > 0) {
        const ofItems = field.of.map(ofItem => {
          if (ofItem.type === 'object' && ofItem.fields) {
            const ofFieldsStr = this.generateFields(ofItem.fields, indent + '    ');
            return `{\n${indent}    type: 'object',\n${indent}    fields: [\n${ofFieldsStr}\n${indent}    ]\n${indent}  }`;
          }
          return JSON.stringify(ofItem);
        }).join(',\n' + indent + '  ');
        of = `,\n${indent}  of: [\n${indent}  ${ofItems}\n${indent}  ]`;
      }

      const to = field.to ? `,\n${indent}  to: ${JSON.stringify(field.to, null, 2).split('\n').join(`\n${indent}  `)}` : '';

      return `${indent}defineField({
${indent}  name: '${field.name}',
${indent}  title: '${field.title}',
${indent}  type: '${field.type}'${options}${validation}${description}${nestedFields}${of}${to}
${indent}})`;
    }).join(',\n');
  }

  /**
   * Generate validation rules
   */
  private generateValidation(field: SanityField, indent: string): string {
    if (!field.validation) {
      return '';
    }

    // If validation is a string, use simple pattern
    if (typeof field.validation === 'string') {
      return `,\n${indent}  validation: (Rule) => Rule.${field.validation}()`;
    }

    // If validation is an object with rule properties
    if (typeof field.validation === 'object') {
      const rules: string[] = [];

      // Handle common validation rules
      if (field.validation.required) rules.push('required()');
      if (field.validation.min !== undefined) rules.push(`min(${field.validation.min})`);
      if (field.validation.max !== undefined) rules.push(`max(${field.validation.max})`);
      if (field.validation.email) rules.push('email()');
      if (field.validation.url) rules.push('url()');
      if (field.validation.length !== undefined) rules.push(`length(${field.validation.length})`);
      if (field.validation.custom) {
        rules.push(`custom((value) => ${field.validation.custom})`);
      }

      if (rules.length > 0) {
        return `,\n${indent}  validation: (Rule) => Rule.${rules.join('.')}`;
      }
    }

    return '';
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
   * Generate object type TypeScript
   */
  private generateObjectType(obj: any): string {
    const fields = this.generateFields(obj.fields);
    const description = obj.description ? `\n  description: '${obj.description}',` : '';

    return `import { defineType, defineField } from 'sanity'

export default defineType({
  name: '${obj.name}',
  title: '${obj.title}',
  type: 'object',${description}
  fields: [
${fields}
  ]
})
`;
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

    // Portable Text object (for rich content)
    const portableTextObject = `import { defineType, defineArrayMember } from 'sanity'

export default defineType({
  name: 'portableText',
  title: 'Rich Text',
  type: 'array',
  description: 'Rich text content with formatting, links, and embeds',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Normal', value: 'normal'},
        {title: 'H1', value: 'h1'},
        {title: 'H2', value: 'h2'},
        {title: 'H3', value: 'h3'},
        {title: 'H4', value: 'h4'},
        {title: 'Quote', value: 'blockquote'},
      ],
      lists: [
        {title: 'Bullet', value: 'bullet'},
        {title: 'Numbered', value: 'number'}
      ],
      marks: {
        decorators: [
          {title: 'Strong', value: 'strong'},
          {title: 'Emphasis', value: 'em'},
          {title: 'Code', value: 'code'}
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'External Link',
            fields: [
              {
                name: 'href',
                type: 'url',
                title: 'URL'
              }
            ]
          }
        ]
      }
    }),
    defineArrayMember({
      type: 'image',
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative text',
          description: 'Important for SEO and accessibility'
        }
      ]
    })
  ]
})
`;
    fs.writeFileSync(path.join(objDir, 'portableText.ts'), portableTextObject);
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

    // Detected objects
    for (const obj of model.objects) {
      imports.push(`import ${obj.name} from './objects/${obj.name}'`);
      exports.push(obj.name);
    }

    // Blocks
    for (const block of model.blocks) {
      imports.push(`import ${block.name} from './blocks/${block.name}'`);
      exports.push(block.name);
    }

    // Common objects
    imports.push(`import seo from './objects/seo'`);
    imports.push(`import link from './objects/link'`);
    imports.push(`import portableText from './objects/portableText'`);
    exports.push('seo', 'link', 'portableText');

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
