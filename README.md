# site2sanity-cli

An interactive CLI tool that crawls websites, derives information architecture and page types, and generates **Sanity-idiomatic** Studio schema (TypeScript using `defineType`) plus optional Structure scaffolding and a migration-ready mapping spec.

## Features

- 🕷️ **Smart Crawling**: HTML and headless browser modes with robots.txt support
- 🗺️ **IA Discovery**: Automatic navigation structure and breadcrumb detection
- 📄 **Page Type Detection**: Intelligent clustering based on URL patterns and content structure
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

```bash
# 1. Initialize a new project
site2sanity init https://example.com

# 2. Crawl the website
site2sanity crawl

# 3. Analyze the crawl data
site2sanity analyze

# 4. Interactively create Sanity schema
site2sanity map

# 5. Validate the schema
site2sanity lint

# 6. Export TypeScript schema files
site2sanity export

# 7. View detailed report
site2sanity report
```

## Commands

### `init <url>`

Initialize a new site2sanity project.

```bash
site2sanity init https://example.com [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  --max-pages <number>        Maximum pages to crawl (default: 1000)
  --max-depth <number>        Maximum crawl depth (default: 10)
```

### `crawl`

Crawl the website and collect page data.

```bash
site2sanity crawl [options]

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
site2sanity analyze [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

### `map`

Interactively map page types to Sanity schema.

```bash
site2sanity map [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  --non-interactive           Run in non-interactive mode with defaults
```

### `lint`

Validate Sanity schema for correctness and best practices.

```bash
site2sanity lint [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

### `export`

Export Sanity schema and migration artifacts.

```bash
site2sanity export [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  -o, --out <directory>       Output directory (default: out)
```

### `report`

Generate a comprehensive analysis report.

```bash
site2sanity report [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
  -f, --format <format>       Output format: md or json (default: md)
  -o, --output <file>         Output file path
```

### `doctor`

Diagnose workspace and environment issues.

```bash
site2sanity doctor [options]

Options:
  -d, --dir <directory>       Workspace directory (default: .site2sanity)
```

## Configuration

The `config.json` file in your workspace directory controls crawling and analysis behavior:

```json
{
  "baseUrl": "https://example.com",
  "crawl": {
    "maxPages": 1000,
    "maxDepth": 10,
    "render": false,
    "screenshot": "none",
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
  }
}
```

## Sanity Best Practices

site2sanity-cli follows Sanity best practices:

- **Portable Text**: Rich content fields use Portable Text by default
- **References**: Reusable entities are modeled as documents with references
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

- [ ] AI-powered field naming and description generation
- [ ] Component detection from DOM structure
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
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Ora](https://github.com/sindresorhus/ora) - Spinners

Inspired by the needs of real-world Sanity migration projects.
