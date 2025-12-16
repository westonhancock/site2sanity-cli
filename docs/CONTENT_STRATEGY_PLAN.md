# Content Strategy Plan: Website Content to Sanity Datalake

## Executive Summary

This plan outlines the architecture and implementation strategy for extracting, storing, and seeding website content into Sanity CMS. The goal is to transform the current CLI from a **schema-generation tool** into a **complete content migration platform**.

---

## Current State Analysis

### What Exists Today

| Component | Current State | Gap |
|-----------|--------------|-----|
| **Crawling** | Extracts HTML, headings, meta, JSON-LD, mainContent (text) | No structured content blocks, no media extraction |
| **Storage** | SQLite with page-level data | No content-to-schema mapping, no rich content storage |
| **Analysis** | Detects page types, objects, relationships | Content not mapped to detected schemas |
| **Export** | Generates Sanity TypeScript schemas | No content export, no data seeding |
| **Sanity Integration** | Schema files only | No dataset population, no asset handling |

### Key Insight

The CLI currently answers: *"What schema should I build?"*
We need it to also answer: *"What content should populate that schema?"*

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENHANCED CONTENT PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   PHASE 1: CRAWL          PHASE 2: ANALYZE       PHASE 3: TRANSFORM         │
│   ┌──────────────┐       ┌──────────────┐       ┌──────────────────┐        │
│   │ HTML Fetch   │──────▶│ Page Types   │──────▶│ Content Mapper   │        │
│   │ Media Fetch  │       │ Objects      │       │ Block Segmenter  │        │
│   │ Asset Download│       │ Relationships│       │ Reference Linker │        │
│   └──────────────┘       └──────────────┘       └──────────────────┘        │
│          │                      │                        │                   │
│          ▼                      ▼                        ▼                   │
│   ┌──────────────┐       ┌──────────────┐       ┌──────────────────┐        │
│   │ Content Store │       │ Schema Model │       │ Sanity Documents │        │
│   │ (SQLite)     │       │              │       │ (NDJSON)         │        │
│   └──────────────┘       └──────────────┘       └──────────────────┘        │
│                                                          │                   │
│                                                          ▼                   │
│                          PHASE 4: SEED                                       │
│                         ┌──────────────────────────────────────┐            │
│                         │         Sanity Import Service         │            │
│                         │  ┌────────────┐  ┌────────────────┐  │            │
│                         │  │Asset Upload│  │Document Import │  │            │
│                         │  │   (CDN)    │  │   (Mutations)  │  │            │
│                         │  └────────────┘  └────────────────┘  │            │
│                         └──────────────────────────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Enhanced Content Extraction

### 1.1 Rich Content Extraction

**File**: `src/core/crawler/contentExtractor.ts` (new)

```typescript
interface ExtractedContent {
  // Structured content blocks (in page order)
  blocks: ContentBlock[];

  // Media assets discovered
  assets: Asset[];

  // Inline links for reference building
  internalLinks: InternalLink[];

  // Raw portable text representation
  portableText: PortableTextBlock[];

  // Metadata
  extractedAt: Date;
  confidence: number;
}

interface ContentBlock {
  id: string;
  type: 'hero' | 'text' | 'image' | 'gallery' | 'cta' | 'testimonial' |
        'features' | 'pricing' | 'faq' | 'form' | 'video' | 'embed' | 'custom';
  selector: string;           // CSS selector for re-extraction
  position: number;           // Order on page
  content: BlockContent;      // Type-specific content
  screenshot?: string;        // Block-level screenshot path
  confidence: number;
}

interface Asset {
  id: string;
  type: 'image' | 'video' | 'document' | 'file';
  originalUrl: string;
  localPath?: string;         // Downloaded location
  mimeType: string;
  dimensions?: { width: number; height: number };
  alt?: string;
  caption?: string;
  context: 'content' | 'hero' | 'gallery' | 'og' | 'favicon';
}
```

### 1.2 Block Detection Strategy

**Approach**: Combine DOM analysis with AI vision for block segmentation.

```typescript
// src/core/crawler/blockDetector.ts

class BlockDetector {
  // Rule-based detection patterns
  private patterns = {
    hero: ['[class*="hero"]', '[class*="banner"]', 'section:first-child > .container'],
    cta: ['[class*="cta"]', '[class*="call-to-action"]', 'a.button + p'],
    testimonial: ['[class*="testimonial"]', '[class*="review"]', 'blockquote + cite'],
    features: ['[class*="feature"]', '.grid > [class*="card"]'],
    faq: ['[class*="faq"]', '[class*="accordion"]', 'details > summary'],
    pricing: ['[class*="pricing"]', '[class*="plan"]'],
    gallery: ['[class*="gallery"]', '[class*="carousel"]', '.swiper'],
  };

  async detectBlocks(html: string, screenshot?: Buffer): Promise<ContentBlock[]> {
    // 1. DOM-based detection
    const domBlocks = this.detectFromDOM(html);

    // 2. AI vision enhancement (if screenshot available)
    if (screenshot) {
      const aiBlocks = await this.detectFromVision(screenshot);
      return this.mergeBlocks(domBlocks, aiBlocks);
    }

    return domBlocks;
  }
}
```

### 1.3 Asset Downloading

**File**: `src/core/crawler/assetDownloader.ts` (new)

```typescript
class AssetDownloader {
  private queue: PQueue;
  private downloadDir: string;

  async downloadAssets(assets: Asset[], options: DownloadOptions): Promise<Asset[]> {
    // Parallel download with rate limiting
    // Deduplicate by URL
    // Store in .site2sanity/assets/
    // Update asset records with local paths
  }

  private async downloadImage(asset: Asset): Promise<Asset> {
    // Download with retry logic
    // Validate image (dimensions, format)
    // Generate optimized versions if needed
    // Return updated asset with localPath
  }
}
```

---

## Phase 2: Enhanced Storage Schema

### 2.1 Database Schema Extensions

**File**: `src/utils/database.ts` (extend)

```sql
-- Content blocks extracted from pages
CREATE TABLE content_blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  type TEXT NOT NULL,
  position INTEGER NOT NULL,
  selector TEXT,
  content TEXT NOT NULL,        -- JSON: type-specific content
  raw_html TEXT,                -- Original HTML
  portable_text TEXT,           -- Sanity portable text format
  screenshot TEXT,              -- Block screenshot path
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

-- Assets discovered during crawl
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  original_url TEXT UNIQUE NOT NULL,
  local_path TEXT,
  mime_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  caption TEXT,
  context TEXT,                 -- 'content', 'hero', 'og', etc.
  sanity_asset_id TEXT,         -- After upload to Sanity
  downloaded_at DATETIME,
  uploaded_at DATETIME
);

-- Link between pages/blocks and assets
CREATE TABLE content_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT,
  block_id TEXT,
  asset_id TEXT NOT NULL,
  usage_type TEXT,              -- 'inline', 'featured', 'background'
  FOREIGN KEY (page_id) REFERENCES pages(id),
  FOREIGN KEY (block_id) REFERENCES content_blocks(id),
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Content objects instances (authors, categories, etc.)
CREATE TABLE object_instances (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'author', 'category', 'tag', etc.
  name TEXT NOT NULL,
  slug TEXT,
  data TEXT NOT NULL,           -- JSON: full object data
  source_pages TEXT,            -- JSON: array of page IDs
  sanity_doc_id TEXT,           -- After import to Sanity
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mapping: detected schema field -> extracted content
CREATE TABLE content_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  schema_type TEXT NOT NULL,    -- 'blogPost', 'product', etc.
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,     -- 'string', 'reference', 'portableText', etc.
  source_type TEXT NOT NULL,    -- 'meta', 'jsonld', 'dom', 'block', 'inferred'
  source_selector TEXT,         -- CSS selector or JSON path
  extracted_value TEXT,         -- The actual extracted value
  confidence REAL,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE INDEX idx_blocks_page ON content_blocks(page_id);
CREATE INDEX idx_blocks_type ON content_blocks(type);
CREATE INDEX idx_assets_url ON assets(original_url);
CREATE INDEX idx_objects_type ON object_instances(type);
CREATE INDEX idx_mappings_page ON content_mappings(page_id);
CREATE INDEX idx_mappings_schema ON content_mappings(schema_type);
```

### 2.2 Content Store Service

**File**: `src/core/content/contentStore.ts` (new)

```typescript
class ContentStore {
  constructor(private db: Database) {}

  // Block operations
  async saveBlocks(pageId: string, blocks: ContentBlock[]): Promise<void>;
  async getBlocksByPage(pageId: string): Promise<ContentBlock[]>;
  async getBlocksByType(type: string): Promise<ContentBlock[]>;

  // Asset operations
  async saveAsset(asset: Asset): Promise<Asset>;
  async getAssetByUrl(url: string): Promise<Asset | null>;
  async getUndownloadedAssets(): Promise<Asset[]>;
  async getUnuploadedAssets(): Promise<Asset[]>;
  async updateAssetSanityId(assetId: string, sanityId: string): Promise<void>;

  // Object instance operations
  async saveObjectInstance(instance: ObjectInstance): Promise<void>;
  async getObjectsByType(type: string): Promise<ObjectInstance[]>;
  async updateObjectSanityId(objectId: string, sanityDocId: string): Promise<void>;

  // Content mapping operations
  async saveMapping(mapping: ContentMapping): Promise<void>;
  async getMappingsByPage(pageId: string): Promise<ContentMapping[]>;
  async getMappingsBySchema(schemaType: string): Promise<ContentMapping[]>;
}
```

---

## Phase 3: Content Transformation

### 3.1 Content Mapper

**File**: `src/core/transformer/contentMapper.ts` (new)

Maps extracted content to generated Sanity schemas.

```typescript
class ContentMapper {
  constructor(
    private model: SanityModel,
    private contentStore: ContentStore
  ) {}

  async mapPageToDocument(page: Page): Promise<MappedDocument> {
    // 1. Determine document type from page type
    const docType = this.findDocumentType(page);

    // 2. Extract field values based on schema
    const fields = await this.extractFields(page, docType);

    // 3. Build portable text from content blocks
    const portableText = await this.buildPortableText(page);

    // 4. Resolve references (authors, categories, etc.)
    const references = await this.resolveReferences(page, docType);

    return {
      _type: docType.name,
      _id: this.generateDocumentId(page),
      ...fields,
      content: portableText,
      ...references
    };
  }

  private async extractFields(page: Page, docType: DocumentType): Promise<Record<string, any>> {
    const fields: Record<string, any> = {};

    for (const field of docType.fields) {
      const value = await this.extractFieldValue(page, field);
      if (value !== undefined) {
        fields[field.name] = value;
      }
    }

    return fields;
  }

  private async extractFieldValue(page: Page, field: SchemaField): Promise<any> {
    // Priority order for field extraction:
    // 1. JSON-LD structured data
    // 2. Meta tags (og:*, twitter:*, etc.)
    // 3. DOM elements (by selector patterns)
    // 4. AI inference from content

    const extractors = [
      () => this.extractFromJsonLd(page, field),
      () => this.extractFromMeta(page, field),
      () => this.extractFromDOM(page, field),
      () => this.inferFromContent(page, field)
    ];

    for (const extractor of extractors) {
      const value = await extractor();
      if (value !== undefined) return value;
    }

    return undefined;
  }
}
```

### 3.2 Portable Text Builder

**File**: `src/core/transformer/portableTextBuilder.ts` (new)

Converts HTML content to Sanity's Portable Text format.

```typescript
class PortableTextBuilder {
  private turndown: TurndownService;

  async buildFromHTML(html: string): Promise<PortableTextBlock[]> {
    // Parse HTML
    const $ = cheerio.load(html);

    // Convert to portable text blocks
    const blocks: PortableTextBlock[] = [];

    $('body').children().each((_, el) => {
      const block = this.elementToBlock($(el));
      if (block) blocks.push(block);
    });

    return blocks;
  }

  private elementToBlock(el: Cheerio): PortableTextBlock | null {
    const tagName = el.prop('tagName')?.toLowerCase();

    switch (tagName) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        return this.createHeadingBlock(el, tagName);

      case 'p':
        return this.createParagraphBlock(el);

      case 'ul': case 'ol':
        return this.createListBlock(el, tagName === 'ol');

      case 'blockquote':
        return this.createQuoteBlock(el);

      case 'img':
        return this.createImageBlock(el);

      case 'figure':
        return this.createFigureBlock(el);

      default:
        return this.createParagraphBlock(el);
    }
  }

  private createParagraphBlock(el: Cheerio): PortableTextBlock {
    return {
      _type: 'block',
      _key: generateKey(),
      style: 'normal',
      markDefs: this.extractMarkDefs(el),
      children: this.extractChildren(el)
    };
  }
}
```

### 3.3 Reference Resolver

**File**: `src/core/transformer/referenceResolver.ts` (new)

Links content to object instances (authors, categories, etc.)

```typescript
class ReferenceResolver {
  constructor(private contentStore: ContentStore) {}

  async resolveReferences(page: Page, docType: DocumentType): Promise<Record<string, any>> {
    const refs: Record<string, any> = {};

    for (const field of docType.fields) {
      if (field.type === 'reference') {
        const refValue = await this.resolveReference(page, field);
        if (refValue) refs[field.name] = refValue;
      }
    }

    return refs;
  }

  private async resolveReference(page: Page, field: SchemaField): Promise<SanityReference | null> {
    // Find referenced object instance
    // Match by: JSON-LD data, meta author, URL patterns, content analysis

    const refType = field.to; // e.g., 'author', 'category'
    const instances = await this.contentStore.getObjectsByType(refType);

    // Try different matching strategies
    const match = await this.findMatch(page, instances, refType);

    if (match) {
      return {
        _type: 'reference',
        _ref: match.sanity_doc_id || this.generateTempId(match)
      };
    }

    return null;
  }
}
```

---

## Phase 4: Sanity Seeding

### 4.1 Export Format

**File**: `src/core/exporter/ndjsonExporter.ts` (new)

Exports content as NDJSON for Sanity import.

```typescript
class NDJSONExporter {
  async export(documents: SanityDocument[], outputPath: string): Promise<void> {
    const stream = fs.createWriteStream(outputPath);

    for (const doc of documents) {
      stream.write(JSON.stringify(doc) + '\n');
    }

    stream.end();
  }

  async exportWithAssets(
    documents: SanityDocument[],
    assets: Asset[],
    outputDir: string
  ): Promise<ExportManifest> {
    // Export documents
    await this.export(documents, path.join(outputDir, 'documents.ndjson'));

    // Copy assets to export directory
    await this.copyAssets(assets, path.join(outputDir, 'assets'));

    // Generate manifest
    return this.generateManifest(documents, assets, outputDir);
  }
}
```

### 4.2 Sanity Import Service

**File**: `src/core/sanity/importService.ts` (new)

Handles the actual seeding to Sanity.

```typescript
import { createClient } from '@sanity/client';

class SanityImportService {
  private client: SanityClient;

  constructor(config: SanityConfig) {
    this.client = createClient({
      projectId: config.projectId,
      dataset: config.dataset,
      token: config.token,
      apiVersion: '2024-01-01',
      useCdn: false
    });
  }

  async importAll(data: ImportData): Promise<ImportResult> {
    const result: ImportResult = {
      assets: { uploaded: 0, failed: 0, skipped: 0 },
      documents: { created: 0, updated: 0, failed: 0 }
    };

    // Phase 1: Upload assets first (documents may reference them)
    console.log('Uploading assets...');
    const assetIdMap = await this.uploadAssets(data.assets, result);

    // Phase 2: Update document references with actual asset IDs
    const documents = this.updateAssetReferences(data.documents, assetIdMap);

    // Phase 3: Import documents in dependency order
    console.log('Importing documents...');
    await this.importDocuments(documents, result);

    return result;
  }

  private async uploadAssets(
    assets: Asset[],
    result: ImportResult
  ): Promise<Map<string, string>> {
    const idMap = new Map<string, string>();

    for (const asset of assets) {
      try {
        // Skip if already uploaded
        if (asset.sanity_asset_id) {
          idMap.set(asset.id, asset.sanity_asset_id);
          result.assets.skipped++;
          continue;
        }

        // Upload to Sanity
        const uploaded = await this.client.assets.upload(
          asset.type === 'image' ? 'image' : 'file',
          fs.createReadStream(asset.localPath!),
          {
            filename: path.basename(asset.originalUrl),
            contentType: asset.mimeType
          }
        );

        idMap.set(asset.id, uploaded._id);
        result.assets.uploaded++;

      } catch (error) {
        console.error(`Failed to upload asset ${asset.originalUrl}:`, error);
        result.assets.failed++;
      }
    }

    return idMap;
  }

  private async importDocuments(
    documents: SanityDocument[],
    result: ImportResult
  ): Promise<void> {
    // Sort documents by dependency (objects first, then documents)
    const sorted = this.sortByDependency(documents);

    // Batch import using transactions
    const batchSize = 100;

    for (let i = 0; i < sorted.length; i += batchSize) {
      const batch = sorted.slice(i, i + batchSize);

      try {
        const transaction = this.client.transaction();

        for (const doc of batch) {
          transaction.createOrReplace(doc);
        }

        await transaction.commit();
        result.documents.created += batch.length;

      } catch (error) {
        console.error(`Batch import failed:`, error);
        result.documents.failed += batch.length;
      }
    }
  }
}
```

### 4.3 Import Command

**File**: `src/cli/commands/seed.ts` (new)

CLI command for seeding content.

```typescript
import { Command } from 'commander';

export function seedCommand(program: Command): void {
  program
    .command('seed')
    .description('Seed crawled content into Sanity dataset')
    .option('--project-id <id>', 'Sanity project ID')
    .option('--dataset <name>', 'Sanity dataset name', 'production')
    .option('--token <token>', 'Sanity write token')
    .option('--dry-run', 'Preview import without making changes')
    .option('--assets-only', 'Only upload assets')
    .option('--documents-only', 'Only import documents (skip assets)')
    .option('--batch-size <n>', 'Documents per batch', '100')
    .action(async (options) => {
      const workspace = await Workspace.load();

      // Validate workspace has content
      if (!workspace.hasContent()) {
        console.error('No content found. Run crawl and analyze first.');
        process.exit(1);
      }

      // Get Sanity credentials
      const config = await getSanityConfig(options);

      // Build import data
      const transformer = new ContentTransformer(workspace);
      const importData = await transformer.buildImportData();

      if (options.dryRun) {
        console.log('Dry run - would import:');
        console.log(`  ${importData.assets.length} assets`);
        console.log(`  ${importData.documents.length} documents`);
        return;
      }

      // Execute import
      const importer = new SanityImportService(config);
      const result = await importer.importAll(importData);

      // Report results
      console.log('\nImport complete:');
      console.log(`  Assets: ${result.assets.uploaded} uploaded, ${result.assets.skipped} skipped, ${result.assets.failed} failed`);
      console.log(`  Documents: ${result.documents.created} created, ${result.documents.failed} failed`);
    });
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Enhanced content extraction infrastructure

- [ ] Create `ContentExtractor` class with rich block detection
- [ ] Implement `AssetDownloader` with parallel downloading
- [ ] Extend database schema with new tables
- [ ] Create `ContentStore` service layer
- [ ] Add asset download CLI option to crawl command

**Files to create/modify**:
```
src/core/crawler/contentExtractor.ts (new)
src/core/crawler/blockDetector.ts (new)
src/core/crawler/assetDownloader.ts (new)
src/core/content/contentStore.ts (new)
src/utils/database.ts (extend)
src/cli/commands/crawl.ts (extend)
```

### Phase 2: Transformation (Week 3-4)
**Goal**: Content-to-schema mapping pipeline

- [ ] Implement `ContentMapper` for schema-aware extraction
- [ ] Create `PortableTextBuilder` for HTML conversion
- [ ] Build `ReferenceResolver` for object linking
- [ ] Add content mapping CLI commands
- [ ] Implement AI-assisted field mapping

**Files to create/modify**:
```
src/core/transformer/contentMapper.ts (new)
src/core/transformer/portableTextBuilder.ts (new)
src/core/transformer/referenceResolver.ts (new)
src/core/transformer/index.ts (new)
src/cli/commands/transform.ts (new)
```

### Phase 3: Export & Seeding (Week 5-6)
**Goal**: Sanity import pipeline

- [ ] Create `NDJSONExporter` for portable export format
- [ ] Implement `SanityImportService` with asset upload
- [ ] Add `seed` CLI command with progress reporting
- [ ] Implement dry-run and incremental import modes
- [ ] Add import validation and rollback support

**Files to create/modify**:
```
src/core/exporter/ndjsonExporter.ts (new)
src/core/sanity/importService.ts (new)
src/core/sanity/index.ts (new)
src/cli/commands/seed.ts (new)
```

### Phase 4: Integration & Polish (Week 7-8)
**Goal**: Seamless end-to-end workflow

- [ ] Integrate content extraction into `start` command
- [ ] Add content preview/review step before seeding
- [ ] Implement progress tracking and reporting
- [ ] Add content validation against schema
- [ ] Create comprehensive error handling and recovery

**Files to create/modify**:
```
src/cli/commands/start.ts (extend)
src/core/validator/contentValidator.ts (new)
src/utils/progress.ts (new)
```

---

## Enhanced CLI Workflow

### Updated `start` Command Flow

```
site2sanity start https://example.com

1. [CRAWL] Fetching pages...
   ├── Discovered 150 pages
   ├── Downloaded 423 assets (12.4 MB)
   └── Extracted 892 content blocks

2. [ANALYZE] Analyzing content structure...
   ├── Detected 5 page types
   ├── Found 12 reusable blocks
   └── Identified 8 content objects

3. [SCHEMA] Generating Sanity schemas...
   ├── Created 5 document types
   ├── Created 15 object types
   └── Exported to ./sanity/schemaTypes/

4. [TRANSFORM] Mapping content to schemas...
   ├── Mapped 150 documents
   ├── Resolved 234 references
   └── Built 892 portable text blocks

5. [REVIEW] Content preview:
   ┌──────────────┬───────┬─────────┐
   │ Type         │ Count │ Status  │
   ├──────────────┼───────┼─────────┤
   │ blogPost     │ 45    │ Ready   │
   │ product      │ 32    │ Ready   │
   │ page         │ 28    │ Ready   │
   │ author       │ 8     │ Ready   │
   │ category     │ 12    │ Ready   │
   └──────────────┴───────┴─────────┘

   ? Ready to seed content to Sanity? (Y/n)

6. [SEED] Importing to Sanity...
   ├── Uploading 423 assets... ████████████████ 100%
   ├── Importing 125 documents... ████████████████ 100%
   └── Complete! View at https://example.sanity.studio
```

### New CLI Commands

```bash
# Full workflow with content seeding
site2sanity start https://example.com --seed

# Crawl with asset downloading
site2sanity crawl https://example.com --download-assets

# Transform crawled content to Sanity format
site2sanity transform --schema-dir ./sanity/schemaTypes

# Preview content before seeding
site2sanity preview

# Seed content to Sanity
site2sanity seed --project-id abc123 --dataset production

# Export content as NDJSON (for manual import)
site2sanity export --format ndjson --output ./export
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

Website HTML                 Extracted Data                   Sanity Format
─────────────                ──────────────                   ─────────────

<article>                    ContentBlock {                   {
  <h1>Title</h1>      ───▶     type: 'text',           ───▶    _type: 'block',
  <p>Content...</p>            content: {...}                   style: 'normal',
</article>                   }                                  children: [...]
                                                              }

<img src="..." alt="">       Asset {                         {
                      ───▶     originalUrl: '...',     ───▶    _type: 'image',
                               localPath: '...',               asset: {
                               alt: '...'                        _ref: 'image-xxx'
                             }                                 }
                                                              }

JSON-LD author data          ObjectInstance {                {
                      ───▶     type: 'author',         ───▶    _type: 'author',
                               name: 'John Doe',               _id: 'author-xxx',
                               data: {...}                     name: 'John Doe',
                             }                                 ...
                                                              }

<a href="/category/tech">    ContentMapping {                {
                      ───▶     field: 'category',      ───▶    _type: 'reference',
                               source: 'breadcrumb',           _ref: 'category-tech'
                               value: 'tech'                 }
                             }
```

---

## Configuration Extensions

### Extended `config.json`

```typescript
interface Config {
  // ... existing config

  content: {
    // Asset handling
    downloadAssets: boolean;        // Download images/files locally
    assetTypes: string[];           // ['image', 'video', 'document']
    maxAssetSize: number;           // Max file size in bytes

    // Block detection
    detectBlocks: boolean;          // Enable block segmentation
    blockScreenshots: boolean;      // Capture block-level screenshots
    customBlockPatterns: Record<string, string[]>;  // Custom CSS selectors

    // Content mapping
    fieldMappingMode: 'auto' | 'manual' | 'ai';
    customFieldMappings: FieldMapping[];

    // Quality settings
    minConfidence: number;          // Minimum confidence for auto-mapping
    validateContent: boolean;       // Validate before seeding
  };

  seed: {
    // Import settings
    batchSize: number;              // Documents per transaction
    retryAttempts: number;          // Retries on failure
    skipExisting: boolean;          // Skip if document exists

    // Asset settings
    uploadAssets: boolean;          // Upload to Sanity CDN
    assetDeduplication: boolean;    // Skip duplicate assets

    // Safety settings
    dryRun: boolean;                // Preview mode
    createBackup: boolean;          // Backup before import
  };
}
```

---

## Error Handling & Recovery

### Checkpoint System

```typescript
interface ImportCheckpoint {
  phase: 'assets' | 'documents';
  completed: string[];              // IDs of completed items
  failed: Array<{
    id: string;
    error: string;
    retries: number;
  }>;
  lastUpdated: Date;
}

class CheckpointManager {
  async save(checkpoint: ImportCheckpoint): Promise<void>;
  async load(): Promise<ImportCheckpoint | null>;
  async resume(checkpoint: ImportCheckpoint): Promise<void>;
}
```

### Rollback Support

```typescript
class ImportRollback {
  private mutations: SanityMutation[] = [];

  async createRollbackPoint(): Promise<string>;
  async rollback(pointId: string): Promise<void>;

  // Tracks created documents for potential rollback
  trackCreation(docId: string): void;
  trackAssetUpload(assetId: string): void;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// Content extraction
describe('ContentExtractor', () => {
  it('extracts hero blocks from common patterns');
  it('converts HTML to portable text correctly');
  it('handles nested block structures');
  it('extracts inline images with metadata');
});

// Content mapping
describe('ContentMapper', () => {
  it('maps JSON-LD data to schema fields');
  it('resolves author references from meta tags');
  it('handles missing fields gracefully');
  it('validates field types against schema');
});

// Sanity import
describe('SanityImportService', () => {
  it('uploads assets before documents');
  it('handles batch failures with retry');
  it('respects dependency order');
  it('supports incremental imports');
});
```

### Integration Tests

```typescript
describe('End-to-end content migration', () => {
  it('migrates a blog site with authors and categories');
  it('migrates an e-commerce site with products');
  it('handles sites with complex block structures');
  it('recovers from partial import failures');
});
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Content extraction accuracy | > 90% fields correctly mapped |
| Asset download success rate | > 99% for valid URLs |
| Portable text conversion quality | No data loss from HTML |
| Import success rate | > 99% documents imported |
| Reference resolution accuracy | > 95% correctly linked |
| End-to-end migration time | < 5 min for 500 pages |

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@sanity/client": "^6.x",
    "@sanity/image-url": "^1.x",
    "@portabletext/toolkit": "^2.x",
    "p-limit": "^5.x",
    "file-type": "^19.x",
    "sharp": "^0.33.x"
  }
}
```

---

## Open Questions

1. **Asset hosting**: Should we always upload to Sanity CDN, or support external URLs?
2. **Content versioning**: How to handle re-crawls and content updates?
3. **Incremental migration**: How to sync only changed content?
4. **Multi-language**: How to handle translated content across languages?
5. **Draft vs Published**: Should imported content be drafts or published?

---

## Next Steps

1. Review and approve this plan
2. Create feature branch for Phase 1
3. Implement database schema extensions
4. Build content extraction infrastructure
5. Test with sample websites
6. Iterate on mapping accuracy

---

*Document Version: 1.0*
*Last Updated: 2024-01-XX*
*Author: Claude Code*
