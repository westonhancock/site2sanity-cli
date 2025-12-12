# site2sanity-cli

An interactive CLI tool that crawls websites, derives information architecture and page types, and generates **Sanity-idiomatic** Studio schema (TypeScript using `defineType`) plus optional Structure scaffolding and a migration-ready mapping spec.

## Features

- 🕷️ **Smart Two-Phase Crawling**: Fast HTML crawl of entire site, followed by selective browser screenshots for AI analysis
- 🗺️ **IA Discovery**: Automatic navigation structure and breadcrumb detection
- 📄 **Page Type Detection**: Intelligent clustering based on URL patterns and content structure
- 🤖 **AI-Powered Analysis**: Optional Claude AI integration with vision capabilities for enhanced schema generation
- 📸 **Vision-Based Block Detection**: Uses full-page screenshots to visually identify UI patterns (hero sections, CTAs, testimonials, feature grids, etc.)
- 🧩 **Smart Block Detection**: Automatically identifies reusable UI components from visual layout
- 🔍 **Object Detection**: Finds reusable content objects (authors, categories, tags, locations, etc.)
- 🔗 **Relationship Detection**: Finds index-detail, taxonomy, and other content relationships
- 🏗️ **Sanity-Native Schema**: Generates TypeScript schema with `defineType` following best practices
- ✅ **Schema Validation**: Built-in linting for Sanity-specific requirements
- 📦 **Migration Ready**: Exports mapping specs for NDJSON import workflows
- 🎨 **Interactive Mapping**: CLI prompts to refine and customize the generated schema

## Installation

```bash
npm install -g site2sanity-cli
```

Or use with npx:

```bash
npx site2sanity-cli init https://example.com
```

## Quick Start

The easiest way to use s2s is with the interactive workflow:

```bash
# Start the interactive workflow (analyzes site and generates schema)
s2s https://example.com

# Or just run s2s and it will prompt you for the URL
s2s
```

That's it! The CLI will guide you through:
1. Configuring the crawl (pages, depth, subdomain following)
2. **Phase 1**: Fast HTML crawl of entire site to detect page types
3. **Phase 2**: Selective screenshot capture of representative pages (3 per page type)
4. (Optional) AI-powered visual analysis with Claude to detect blocks and enhance schema
5. Creating Sanity schema from detected page types
6. Exporting TypeScript schema files

### Two-Phase Crawling

The tool uses an intelligent two-phase approach:
- **Phase 1 (HTML Crawl)**: Quickly crawls the entire site as HTML to detect all pages and cluster them into types (10-100x faster than browser crawling)
- **Phase 2 (Screenshots)**: Optionally captures full-page screenshots of representative pages from each type (typically 3 per type) for AI visual analysis

This approach provides comprehensive coverage while keeping crawl times fast and costs low.

### AI-Powered Analysis

For best results, enable AI analysis when prompted. You'll need an [Anthropic API key](https://console.anthropic.com/) (starts with `sk-ant-`). The AI will:
- **Visual block detection**: Uses full-page screenshots to identify UI patterns (hero sections, CTAs, testimonials, feature grids, card layouts, forms, etc.)
- **Detect reusable blocks**: Identifies repeating visual components across pages
- **Enhance object detection**: Find authors, categories, tags, and other reusable content
- **Suggest better field structures**: More accurate field types and descriptions based on visual and semantic analysis
- **Semantic understanding**: Analyzes content meaning and visual layout, not just patterns

AI analysis is optional and uses **Claude Sonnet 4.5 with vision capabilities** (the latest model). It analyzes up to 20 representative pages with their screenshots to keep costs low while providing comprehensive visual analysis.

**Vision Features:**
When screenshots are captured, Claude can:
- Visually identify UI blocks that may not be obvious from HTML alone
- Detect visual layout patterns (grids, columns, hero sections)
- Identify image-heavy sections that should be represented as blocks
- Better understand visual hierarchy and content structure

### Advanced: Individual Commands

For more control, you can run each step separately:

```bash
s2s init https://example.com    # Initialize project
s2s crawl                        # Crawl the website
s2s analyze                      # Analyze structure
s2s map                          # Create schema
s2s export                       # Export files
s2s report                       # View report
```

## Commands

### `start [url]` (Default)

Interactive workflow that guides you through the entire process.

```bash
s2s [url] [options]
# or
s2s start [url] [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

This is the recommended way to use s2s. It will:
- Prompt for URL if not provided
- Guide you through crawl configuration
- Automatically crawl, analyze, and generate schema
- (Optional) Run AI-powered analysis to detect blocks and enhance object detection
- Allow merging page types (e.g., combine singleton pages like "about" and "contact" into a single "page" type)
- Display detected objects (authors, categories, tags, etc.) and blocks (hero sections, CTAs, etc.)
- Let you customize document type names
- Export ready-to-use TypeScript files with documents, objects, and blocks

**AI Features:**
When AI analysis is enabled, the tool will:
- Analyze up to 20 representative pages from your site
- Detect repeating UI patterns as reusable blocks
- Enhance object detection beyond simple pattern matching
- Suggest more accurate field types and descriptions
- Provide better page type suggestions

### `init <url>`

Initialize a new s2s project.

```bash
s2s init https://example.com [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  --max-pages <number>        Maximum pages to crawl (default: 1000)
  --max-depth <number>        Maximum crawl depth (default: 10)
```

### `crawl`

Crawl the website and collect page data.

```bash
s2s crawl [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  --render                    Use headless browser for JS-heavy sites
  --screenshot <mode>         Capture screenshots: none, aboveFold, fullPage
  --max-pages <number>        Override max pages from config
  --max-depth <number>        Override max depth from config
  --resume                    Resume previous crawl
```

### `analyze`

Analyze crawl data to detect IA, page types, and relationships.

```bash
s2s analyze [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

### `map`

Interactively map page types to Sanity schema.

```bash
s2s map [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  --non-interactive           Run in non-interactive mode with defaults
```

### `lint`

Validate Sanity schema for correctness and best practices.

```bash
s2s lint [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

### `export`

Export Sanity schema and migration artifacts.

```bash
s2s export [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  -o, --out <directory>       Output directory (default: out)
```

### `report`

Generate a comprehensive analysis report.

```bash
s2s report [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  -f, --format <format>       Output format: md or json (default: md)
  -o, --output <file>         Output file path
```

### `doctor`

Diagnose workspace and environment issues.

```bash
s2s doctor [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

### `project`

Open and edit an existing workspace. Allows re-analyzing, viewing page types, or exporting without re-crawling.

```bash
s2s project [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

This command lets you:
- Re-analyze crawled data with different settings
- View detected page types
- Regenerate and export schema
- View project configuration

### `cleanup`

Remove workspace and export directories to start fresh.

```bash
s2s cleanup [options]

Options:
  -d, --dir <directory>       Workspace directory to remove (default: .site2sanity)
  -o, --out <directory>       Output directory to remove (default: out)
  -y, --yes                   Skip confirmation prompt
```

### `config`

Manage API keys and configuration. Store your Anthropic or OpenAI API keys securely for AI-powered analysis.

```bash
s2s config
```

This interactive command lets you:
- **Set API key**: Store your Anthropic (Claude) or OpenAI (GPT) API key
- **View stored API keys**: See which keys are configured (masked for security)
- **Delete API key**: Remove a stored API key
- **Clear all secrets**: Remove all stored API keys

API keys are stored securely in `~/.site2sanity/secrets.json` with restricted file permissions (600). You can also use environment variables:
- `ANTHROPIC_API_KEY` - For Claude AI analysis
- `OPENAI_API_KEY` - For GPT analysis (future support)

When you run AI analysis, the tool will:
1. Check for environment variables first
2. Check for stored API keys
3. Prompt you to enter a key if none is found
4. Offer to save the key for future use

## Configuration

The `config.json` file in your workspace directory controls crawling and analysis behavior:

```json
{
  "baseUrl": "https://example.com",
  "crawl": {
    "maxPages": 1000,
    "maxDepth": 10,
    "followSubdomains": false,
    "render": false,
    "screenshot": "none",
    "screenshotSamplesPerType": 3,
    "throttle": 100,
    "concurrency": 5,
    "respectRobots": true
  },
  "analyze": {
    "clusteringThreshold": 0.7,
    "maxClusters": 20,
    "minClusterSize": 3
  },
  "sanity": {
    "defaultMode": "builder",
    "seoDefaults": true,
    "slugStrategy": "canonical",
    "portableTextConfig": "standard"
  },
  "export": {
    "outDir": "out",
    "includeStructure": true,
    "typescriptStyle": "defineType"
  },
  "ai": {
    "enabled": false,
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929",
    "maxPagesPerAnalysis": 20,
    "useVision": true
  }
}
```

### Crawl Configuration

The `crawl` section controls how pages are discovered and captured:

- **maxPages**: Maximum number of pages to crawl
- **maxDepth**: Maximum crawl depth from the base URL
- **followSubdomains**: Whether to follow subdomains (e.g., follow `blog.example.com` when crawling `example.com`)
- **render**: Whether to use headless browser (usually not needed with two-phase crawling)
- **screenshot**: Screenshot mode for manual crawling (`"none"`, `"aboveFold"`, `"fullPage"`)
- **screenshotSamplesPerType**: Number of representative screenshots to capture per page type (default: 3)
- **throttle**: Milliseconds to wait between requests
- **concurrency**: Number of parallel requests
- **respectRobots**: Honor robots.txt rules

### AI Configuration

The `ai` section controls AI-powered analysis:

- **enabled**: Whether to use AI analysis (set interactively, or configure here)
- **provider**: AI provider (`"anthropic"` or `"openai"`)
- **model**: Model to use (default: `claude-sonnet-4-5-20250929` - latest Claude Sonnet 4.5)
- **maxPagesPerAnalysis**: Maximum pages to send for AI analysis (default: 20, controls costs)
- **useVision**: Whether to use screenshots for visual analysis (default: `true`, requires screenshots to be captured)

**Vision Analysis**: When `useVision` is enabled and screenshots are captured, Claude will receive full-page screenshots along with HTML/text data. This enables:
- Visual identification of UI blocks and patterns
- Better understanding of layout and visual hierarchy
- Detection of image-heavy sections
- More accurate block field suggestions based on visual structure

**Note**: The API key is not stored in config.json for security. You'll be prompted to enter it when AI analysis is enabled, or you can use the `s2s config` command to store it securely.

## Sanity Best Practices

site2sanity-cli follows Sanity best practices:

- **Portable Text**: Rich content fields use Portable Text by default
- **References**: Reusable entities are modeled as documents with references
- **Objects**: Reusable content patterns (authors, categories, tags) become reference documents
- **Blocks**: Repeating UI components (hero, CTA, testimonials) become reusable block types
- **Singletons**: Global settings use singleton patterns
- **Slugs**: Routable documents include slug fields
- **Previews**: All document types have preview configurations
- **Fieldsets**: Fields are organized into logical groups
- **SEO**: Common SEO object included by default

## Generated Schema Example

```typescript
// schemaTypes/documents/article.ts
import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' }
    }),
    // ... more fields
  ],
  preview: {
    select: {
      title: 'title'
    }
  }
})
```

## Use Cases

### Agency Migration Projects

Quickly understand a client's existing site structure and generate a starting point for Sanity schema development.

### Content Audits

Analyze site IA, page types, and content relationships to inform CMS design decisions.

### Documentation

Generate detailed reports about site structure and content patterns.

## Requirements

- Node.js >= 18.0.0
- For `--render` mode: Puppeteer (installs Chromium automatically)

## Development

```bash
# Clone the repository
git clone https://github.com/westonhancock/site2sanity-cli.git
cd site2sanity-cli

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start -- init https://example.com

# Watch mode
npm run dev
```

## Roadmap

- [x] AI-powered field naming and description generation
- [x] Component detection from DOM structure (blocks)
- [x] Reusable object detection (authors, categories, tags, etc.)
- [ ] Advanced relationship mapping (many-to-many, nested)
- [ ] Content migration script generation
- [ ] Structure tool scaffolding
- [ ] Custom block library generation
- [ ] Authentication support for protected sites
- [ ] Incremental crawling and updates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Weston Hancock (weston.e.hancock@gmail.com)

## Acknowledgments

Built with:
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) - Interactive prompts
- [Cheerio](https://cheerio.js.org/) - HTML parsing
- [Puppeteer](https://pptr.dev/) - Headless browser
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite database
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) - AI-powered analysis with Claude
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Ora](https://github.com/sindresorhus/ora) - Spinners

Inspired by the needs of real-world Sanity migration projects.
