/**
 * SanityExporter unit tests with snapshot testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SanityExporter } from '../../src/core/exporter/sanity';
import { SanityModel, SanityDocumentType, SanityObjectType, SanityBlockType } from '../../src/types';

describe('SanityExporter', () => {
  let tempDir: string;
  let exporter: SanityExporter;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanity-exporter-test-'));
    exporter = new SanityExporter(tempDir);
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  /**
   * Helper to create a minimal valid model
   */
  function createModel(overrides: Partial<SanityModel> = {}): SanityModel {
    return {
      documents: [],
      objects: [],
      blocks: [],
      singletons: [],
      ...overrides,
    };
  }

  /**
   * Helper to create a document type
   */
  function createDocumentType(overrides: Partial<SanityDocumentType> = {}): SanityDocumentType {
    return {
      name: 'testDocument',
      title: 'Test Document',
      type: 'document',
      mode: 'builder',
      fields: [],
      ...overrides,
    };
  }

  /**
   * Helper to create an object type
   */
  function createObjectType(overrides: Partial<SanityObjectType> = {}): SanityObjectType {
    return {
      name: 'testObject',
      title: 'Test Object',
      type: 'object',
      fields: [],
      ...overrides,
    };
  }

  describe('directory structure', () => {
    it('should create correct directory structure', async () => {
      const model = createModel();
      await exporter.export(model);

      expect(fs.existsSync(path.join(tempDir, 'sanity'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'sanity', 'schemaTypes'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'sanity', 'schemaTypes', 'documents'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'sanity', 'schemaTypes', 'objects'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'sanity', 'schemaTypes', 'blocks'))).toBe(true);
    });

    it('should create common objects (seo, link)', async () => {
      const model = createModel();
      await exporter.export(model);

      const objDir = path.join(tempDir, 'sanity', 'schemaTypes', 'objects');
      expect(fs.existsSync(path.join(objDir, 'seo.ts'))).toBe(true);
      expect(fs.existsSync(path.join(objDir, 'link.ts'))).toBe(true);
    });

    it('should create README', async () => {
      const model = createModel();
      await exporter.export(model);

      expect(fs.existsSync(path.join(tempDir, 'sanity', 'README.md'))).toBe(true);
    });

    it('should create index file', async () => {
      const model = createModel();
      await exporter.export(model);

      expect(fs.existsSync(path.join(tempDir, 'sanity', 'schemaTypes', 'index.ts'))).toBe(true);
    });
  });

  describe('document generation', () => {
    it('should generate document type file', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'article',
            title: 'Article',
            fields: [
              { name: 'title', title: 'Title', type: 'string' },
              { name: 'body', title: 'Body', type: 'text' },
            ],
          }),
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'article.ts');
      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toMatchSnapshot();
    });

    it('should generate singleton type file', async () => {
      const model = createModel({
        singletons: [
          {
            ...createDocumentType({
              name: 'settings',
              title: 'Site Settings',
              fields: [
                { name: 'siteName', title: 'Site Name', type: 'string' },
              ],
            }),
            singleton: true as const,
          },
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'settings.ts');
      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain("type: 'document'");
    });

    it('should include field validation', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'post',
            title: 'Post',
            fields: [
              { name: 'title', title: 'Title', type: 'string', validation: 'required' },
            ],
          }),
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'post.ts');
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('validation: (Rule) => Rule.required()');
    });

    it('should include field description', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'post',
            title: 'Post',
            fields: [
              { name: 'title', title: 'Title', type: 'string', description: 'The post title' },
            ],
          }),
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'post.ts');
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain("description: 'The post title'");
    });

    it('should include field options', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'post',
            title: 'Post',
            fields: [
              {
                name: 'status',
                title: 'Status',
                type: 'string',
                options: { list: ['draft', 'published'] },
              },
            ],
          }),
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'post.ts');
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('options:');
      expect(content).toContain('"draft"');
      expect(content).toContain('"published"');
    });

    it('should include preview configuration', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'post',
            title: 'Post',
            fields: [{ name: 'title', title: 'Title', type: 'string' }],
            preview: {
              select: { title: 'title', subtitle: 'author' },
            },
          }),
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'post.ts');
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('preview:');
      expect(content).toContain('select:');
    });

    it('should handle array fields with "of" property', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'post',
            title: 'Post',
            fields: [
              {
                name: 'tags',
                title: 'Tags',
                type: 'array',
                of: [{ type: 'string' }] as any,
              },
            ],
          }),
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'post.ts');
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('of:');
    });

    it('should handle reference fields with "to" property', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'post',
            title: 'Post',
            fields: [
              {
                name: 'author',
                title: 'Author',
                type: 'reference',
                to: [{ type: 'author' }],
              },
            ],
          }),
        ],
      });

      await exporter.export(model);

      const docPath = path.join(tempDir, 'sanity', 'schemaTypes', 'documents', 'post.ts');
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('to:');
      expect(content).toContain('"author"');
    });
  });

  describe('object generation', () => {
    it('should generate object type file', async () => {
      const model = createModel({
        objects: [
          createObjectType({
            name: 'address',
            title: 'Address',
            fields: [
              { name: 'street', title: 'Street', type: 'string' },
              { name: 'city', title: 'City', type: 'string' },
              { name: 'zip', title: 'ZIP Code', type: 'string' },
            ],
          }),
        ],
      });

      await exporter.export(model);

      const objPath = path.join(tempDir, 'sanity', 'schemaTypes', 'objects', 'address.ts');
      expect(fs.existsSync(objPath)).toBe(true);

      const content = fs.readFileSync(objPath, 'utf-8');
      expect(content).toMatchSnapshot();
    });

    it('should include description for objects', async () => {
      const model = createModel({
        objects: [
          {
            ...createObjectType({
              name: 'address',
              title: 'Address',
            }),
            description: 'Physical address information',
          },
        ],
      });

      await exporter.export(model);

      const objPath = path.join(tempDir, 'sanity', 'schemaTypes', 'objects', 'address.ts');
      const content = fs.readFileSync(objPath, 'utf-8');
      expect(content).toContain("description: 'Physical address information'");
    });
  });

  describe('block generation', () => {
    it('should generate block type file', async () => {
      const model = createModel({
        blocks: [
          {
            name: 'hero',
            title: 'Hero Section',
            type: 'object' as const,
            fields: [
              { name: 'heading', title: 'Heading', type: 'string' },
              { name: 'image', title: 'Image', type: 'image' },
              { name: 'cta', title: 'Call to Action', type: 'string' },
            ],
          },
        ],
      });

      await exporter.export(model);

      const blockPath = path.join(tempDir, 'sanity', 'schemaTypes', 'blocks', 'hero.ts');
      expect(fs.existsSync(blockPath)).toBe(true);

      const content = fs.readFileSync(blockPath, 'utf-8');
      expect(content).toMatchSnapshot();
    });
  });

  describe('index file generation', () => {
    it('should export all types in index file', async () => {
      const model = createModel({
        documents: [
          createDocumentType({ name: 'article', title: 'Article' }),
          createDocumentType({ name: 'author', title: 'Author' }),
        ],
        objects: [
          createObjectType({ name: 'address', title: 'Address' }),
        ],
        blocks: [
          { name: 'hero', title: 'Hero', type: 'object' as const, fields: [] },
        ],
        singletons: [
          {
            ...createDocumentType({ name: 'settings', title: 'Settings' }),
            singleton: true as const,
          },
        ],
      });

      await exporter.export(model);

      const indexPath = path.join(tempDir, 'sanity', 'schemaTypes', 'index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');

      expect(content).toContain("import article from './documents/article'");
      expect(content).toContain("import author from './documents/author'");
      expect(content).toContain("import settings from './documents/settings'");
      expect(content).toContain("import address from './objects/address'");
      expect(content).toContain("import hero from './blocks/hero'");
      expect(content).toContain("import seo from './objects/seo'");
      expect(content).toContain("import link from './objects/link'");

      expect(content).toContain('export const schemaTypes = [');
      expect(content).toContain('article');
      expect(content).toContain('author');
      expect(content).toContain('settings');
      expect(content).toContain('address');
      expect(content).toContain('hero');
      expect(content).toContain('seo');
      expect(content).toContain('link');
    });
  });

  describe('common objects', () => {
    it('should generate SEO object correctly', async () => {
      const model = createModel();
      await exporter.export(model);

      const seoPath = path.join(tempDir, 'sanity', 'schemaTypes', 'objects', 'seo.ts');
      const content = fs.readFileSync(seoPath, 'utf-8');

      expect(content).toMatchSnapshot();
    });

    it('should generate link object correctly', async () => {
      const model = createModel();
      await exporter.export(model);

      const linkPath = path.join(tempDir, 'sanity', 'schemaTypes', 'objects', 'link.ts');
      const content = fs.readFileSync(linkPath, 'utf-8');

      expect(content).toMatchSnapshot();
    });
  });

  describe('README generation', () => {
    it('should generate README with integration instructions', async () => {
      const model = createModel();
      await exporter.export(model);

      const readmePath = path.join(tempDir, 'sanity', 'README.md');
      const content = fs.readFileSync(readmePath, 'utf-8');

      expect(content).toContain('# Sanity Schema');
      expect(content).toContain('sanity.config.ts');
      expect(content).toContain('schemaTypes');
      expect(content).toContain('npm run dev');
    });
  });

  describe('complex schema', () => {
    it('should generate complete blog schema', async () => {
      const model = createModel({
        documents: [
          createDocumentType({
            name: 'post',
            title: 'Blog Post',
            fields: [
              { name: 'title', title: 'Title', type: 'string', validation: 'required' },
              { name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } },
              { name: 'author', title: 'Author', type: 'reference', to: [{ type: 'author' }] },
              { name: 'publishedAt', title: 'Published At', type: 'datetime' },
              { name: 'body', title: 'Body', type: 'array', of: [{ type: 'block' }] as any },
              { name: 'seo', title: 'SEO', type: 'seo' },
            ],
            preview: {
              select: { title: 'title', author: 'author.name', media: 'mainImage' },
            },
          }),
          createDocumentType({
            name: 'author',
            title: 'Author',
            fields: [
              { name: 'name', title: 'Name', type: 'string', validation: 'required' },
              { name: 'image', title: 'Image', type: 'image' },
              { name: 'bio', title: 'Bio', type: 'text' },
            ],
          }),
        ],
        objects: [
          createObjectType({
            name: 'socialLink',
            title: 'Social Link',
            fields: [
              { name: 'platform', title: 'Platform', type: 'string' },
              { name: 'url', title: 'URL', type: 'url' },
            ],
          }),
        ],
        singletons: [
          {
            ...createDocumentType({
              name: 'siteSettings',
              title: 'Site Settings',
              fields: [
                { name: 'title', title: 'Site Title', type: 'string' },
                { name: 'description', title: 'Site Description', type: 'text' },
              ],
            }),
            singleton: true as const,
          },
        ],
      });

      await exporter.export(model);

      // Verify all files created
      const schemaDir = path.join(tempDir, 'sanity', 'schemaTypes');
      expect(fs.existsSync(path.join(schemaDir, 'documents', 'post.ts'))).toBe(true);
      expect(fs.existsSync(path.join(schemaDir, 'documents', 'author.ts'))).toBe(true);
      expect(fs.existsSync(path.join(schemaDir, 'documents', 'siteSettings.ts'))).toBe(true);
      expect(fs.existsSync(path.join(schemaDir, 'objects', 'socialLink.ts'))).toBe(true);

      // Verify post content
      const postContent = fs.readFileSync(path.join(schemaDir, 'documents', 'post.ts'), 'utf-8');
      expect(postContent).toMatchSnapshot();
    });
  });
});
