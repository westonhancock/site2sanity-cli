# Plan: Making site2sanity-cli AI-Agent Friendly

## Problem Statement

The current CLI tool is optimized for **human interactive use** with Inquirer.js prompts, spinners, colored output, and multi-step wizards. While excellent for developers, this creates barriers for AI agents like Claude Code that need:

1. **Non-blocking execution** - No interactive prompts waiting for input
2. **Structured output** - JSON responses instead of formatted terminal text
3. **Predictable workflows** - All configuration provided upfront
4. **Machine-readable errors** - Parseable error states
5. **Composable operations** - Ability to call individual steps programmatically

---

## Current Interactive Pain Points

| Location | Interactive Element | Blocking for AI? |
|----------|---------------------|------------------|
| `start.ts` | URL input prompt | Yes |
| `start.ts` | Workspace overwrite confirm | Yes |
| `start.ts` | Crawl config (max pages, depth, subdomains) | Yes |
| `start.ts` | Screenshot capture confirm | Yes |
| `start.ts` | AI analysis confirm + API key input | Yes |
| `start.ts` | Page type merge selection (checkbox) | Yes |
| `start.ts` | Document type customization loop | Yes |
| `start.ts` | Object types inclusion loop | Yes |
| `start.ts` | Block types inclusion loop | Yes |
| `start.ts` | Site settings confirm | Yes |
| `start.ts` | Export decision confirm | Yes |
| `start.ts` | Sanity Studio init + config | Yes |
| `map.ts` | Interactive mapping mode | Yes |
| `config.ts` | API key management menus | Yes |
| `project.ts` | Action selection menu | Yes |
| `cleanup.ts` | Deletion confirmation | Yes |

---

## Proposed Solution: Dual-Mode Architecture

### Design Philosophy

Rather than removing interactivity, we **add a parallel non-interactive mode** that:
- Preserves the excellent human UX
- Enables full programmatic control for AI agents
- Uses the same underlying logic for both modes

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Interface                            │
│  ┌─────────────────┐           ┌─────────────────────────────┐ │
│  │  Interactive    │           │  Non-Interactive (AI Mode)  │ │
│  │  (Default)      │           │  --json --non-interactive   │ │
│  │  - Inquirer.js  │           │  - All args via CLI/config  │ │
│  │  - Spinners     │           │  - JSON stdout              │ │
│  │  - Colored text │           │  - Structured errors        │ │
│  └────────┬────────┘           └─────────────┬───────────────┘ │
│           │                                   │                 │
│           └─────────────┬─────────────────────┘                 │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Core Logic Layer                         ││
│  │  - Crawler engine                                           ││
│  │  - Analyzer engine                                          ││
│  │  - Schema generator                                         ││
│  │  - Exporter                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Global Non-Interactive Flags

**Add two global flags to all commands:**

```typescript
// src/cli/index.ts
program
  .option('--json', 'Output results as JSON (implies --non-interactive)')
  .option('--non-interactive', 'Disable all interactive prompts, use defaults/args')
  .option('--config-file <path>', 'Load configuration from JSON file')
```

**Behavior:**
- `--json` → Suppresses spinners, colors, tables. Outputs only valid JSON to stdout.
- `--non-interactive` → All prompts use defaults or CLI args. Errors if required args missing.
- `--config-file` → Load all options from a JSON file (for complex configurations)

### Phase 2: Command-by-Command Non-Interactive Support

#### 2.1 `s2s start` - Full Pipeline Command

**New CLI Options:**
```bash
s2s start <url> \
  --non-interactive \
  --json \
  --max-pages 100 \
  --max-depth 5 \
  --follow-subdomains \
  --screenshot-mode fullPage|aboveFold|none \
  --ai-analysis \
  --api-key <key> \
  --include-page-types "blog,product,landing" \
  --exclude-page-types "404,search" \
  --merge-types '{"articles": ["blog", "news"]}' \
  --include-objects "author,category" \
  --include-blocks "hero,cta" \
  --include-site-settings \
  --export \
  --export-dir ./out \
  --sanity-init \
  --sanity-dir ./studio \
  --sanity-project-name "my-project"
```

**JSON Configuration File Alternative:**
```json
{
  "url": "https://example.com",
  "crawl": {
    "maxPages": 100,
    "maxDepth": 5,
    "followSubdomains": true,
    "screenshotMode": "fullPage"
  },
  "analysis": {
    "useAi": true,
    "apiKey": "sk-ant-..."
  },
  "schema": {
    "includePageTypes": ["blog", "product", "landing"],
    "excludePageTypes": ["404", "search"],
    "mergeTypes": {
      "articles": ["blog", "news"]
    },
    "includeObjects": ["author", "category"],
    "includeBlocks": ["hero", "cta"],
    "includeSiteSettings": true
  },
  "export": {
    "enabled": true,
    "directory": "./out"
  },
  "sanityInit": {
    "enabled": false,
    "directory": "./studio",
    "projectName": "my-project"
  }
}
```

**Usage:**
```bash
s2s start --config-file ./s2s-config.json --json
```

#### 2.2 `s2s crawl` - Crawling Phase

**Existing options are mostly sufficient. Add:**
```bash
--json                    # JSON output
--non-interactive         # No prompts
--overwrite              # Overwrite existing workspace without asking
```

**JSON Output Structure:**
```json
{
  "success": true,
  "stats": {
    "pagesDiscovered": 150,
    "pagesCrawled": 100,
    "pagesSkipped": 50,
    "screenshotsCaptured": 30,
    "duration": 45000
  },
  "workspace": ".site2sanity",
  "errors": []
}
```

#### 2.3 `s2s analyze` - Analysis Phase

**Add:**
```bash
--json                    # JSON output
--non-interactive         # No prompts
--ai-analysis             # Enable AI (default based on config)
--api-key <key>           # API key for AI
```

**JSON Output Structure:**
```json
{
  "success": true,
  "pageTypes": [
    {
      "id": "blog",
      "name": "Blog Post",
      "count": 45,
      "pattern": "/blog/*",
      "features": ["date", "author", "content"],
      "examples": ["https://example.com/blog/post-1"]
    }
  ],
  "objects": [
    {
      "type": "author",
      "instances": 5,
      "fields": ["name", "bio", "image"]
    }
  ],
  "blocks": [
    {
      "type": "hero",
      "occurrences": 12,
      "fields": ["heading", "subheading", "cta", "image"]
    }
  ],
  "navigation": {
    "primaryNav": [...],
    "footerNav": [...],
    "breadcrumbs": true
  }
}
```

#### 2.4 `s2s map` - Schema Mapping

**Add:**
```bash
--json                              # JSON output
--non-interactive                   # Already exists, enhance it
--include-types "blog,product"      # Whitelist page types
--exclude-types "404"               # Blacklist page types
--rename-types '{"blog": "article"}'  # Rename mappings
--include-objects "author"          # Object types to include
--include-blocks "hero,cta"         # Block types to include
--include-site-settings             # Add site settings singleton
--model-type builder|template       # Default schema model
```

**JSON Output Structure:**
```json
{
  "success": true,
  "model": {
    "documents": [
      {
        "name": "article",
        "sourceType": "blog",
        "fields": [...]
      }
    ],
    "objects": [...],
    "blocks": [...],
    "siteSettings": {...}
  },
  "modelPath": ".site2sanity/data/model.json"
}
```

#### 2.5 `s2s export` - Schema Export

**Add:**
```bash
--json                    # JSON output
--non-interactive         # No prompts
--format ts|js            # Output format (default: ts)
--overwrite               # Overwrite existing files
```

**JSON Output Structure:**
```json
{
  "success": true,
  "files": [
    {
      "path": "out/schemaTypes/documents/article.ts",
      "type": "document"
    },
    {
      "path": "out/schemaTypes/objects/author.ts",
      "type": "object"
    }
  ],
  "totalFiles": 8,
  "outputDir": "./out"
}
```

#### 2.6 `s2s report` - Report Generation

**Already supports `--format json`. Enhance:**
```bash
--json                    # Wrapper JSON (not just report format)
--output <file>           # Already exists
```

#### 2.7 `s2s lint` - Schema Validation

**Add:**
```bash
--json                    # JSON output
```

**JSON Output Structure:**
```json
{
  "success": true,
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "type": "document",
      "name": "article",
      "field": "author",
      "message": "Consider using a reference instead of inline object"
    }
  ]
}
```

#### 2.8 `s2s config` - API Key Management

**Add non-interactive variants:**
```bash
s2s config set --provider anthropic --key sk-ant-... --json
s2s config get --provider anthropic --json
s2s config delete --provider anthropic --json --yes
s2s config list --json
```

#### 2.9 `s2s doctor` - Diagnostics

**Add:**
```bash
--json                    # JSON output
```

**JSON Output Structure:**
```json
{
  "success": true,
  "checks": {
    "node": { "status": "ok", "version": "20.10.0" },
    "workspace": { "status": "ok", "path": ".site2sanity" },
    "database": { "status": "ok", "pages": 100 },
    "apiKey": { "status": "ok", "provider": "anthropic" },
    "puppeteer": { "status": "ok", "chromium": "installed" }
  },
  "issues": []
}
```

#### 2.10 `s2s cleanup` - Workspace Cleanup

**Add:**
```bash
--json                    # JSON output
--yes                     # Already exists
```

### Phase 3: Structured Error Handling

**Create consistent error format for `--json` mode:**

```json
{
  "success": false,
  "error": {
    "code": "CRAWL_FAILED",
    "message": "Failed to crawl website",
    "details": "Connection timeout after 30000ms",
    "recoverable": true,
    "suggestion": "Check network connectivity or increase timeout with --timeout"
  }
}
```

**Error Codes:**
- `INVALID_URL` - Malformed URL provided
- `WORKSPACE_NOT_FOUND` - No workspace initialized
- `WORKSPACE_EXISTS` - Workspace already exists (use --overwrite)
- `CRAWL_FAILED` - Crawl operation failed
- `ANALYSIS_FAILED` - Analysis operation failed
- `AI_ERROR` - AI API call failed
- `API_KEY_MISSING` - API key required but not provided
- `API_KEY_INVALID` - API key validation failed
- `EXPORT_FAILED` - Schema export failed
- `VALIDATION_ERROR` - Schema validation failed
- `CONFIG_ERROR` - Configuration error
- `PERMISSION_DENIED` - File system permission error
- `MISSING_REQUIRED_ARG` - Required argument not provided in non-interactive mode

### Phase 4: AI-Optimized Workflows

#### 4.1 Single-Command Full Pipeline

```bash
# AI can run entire workflow with one command
s2s start https://example.com \
  --non-interactive \
  --json \
  --max-pages 50 \
  --screenshot-mode aboveFold \
  --ai-analysis \
  --include-site-settings \
  --export
```

**Output:**
```json
{
  "success": true,
  "phases": {
    "crawl": { "success": true, "pagesCrawled": 50 },
    "analyze": { "success": true, "pageTypesDetected": 5 },
    "map": { "success": true, "documentsCreated": 5 },
    "export": { "success": true, "filesGenerated": 8 }
  },
  "results": {
    "pageTypes": [...],
    "objects": [...],
    "blocks": [...],
    "exportedFiles": [...]
  },
  "workspace": ".site2sanity"
}
```

#### 4.2 Step-by-Step Pipeline for AI Control

```bash
# Step 1: Initialize and crawl
s2s init https://example.com --max-pages 50 --json

# Step 2: Run crawl with screenshots
s2s crawl --screenshot fullPage --json

# Step 3: Analyze (AI can inspect results before proceeding)
s2s analyze --ai-analysis --json

# Step 4: AI inspects pageTypes.json and makes decisions
# Step 5: Map with specific choices
s2s map --non-interactive --json \
  --include-types "blog,product" \
  --rename-types '{"blog": "article"}' \
  --include-objects "author"

# Step 6: Export
s2s export --json
```

#### 4.3 Introspection Commands

**New commands for AI to query state:**

```bash
# Get workspace status
s2s status --json

# Output:
{
  "workspace": ".site2sanity",
  "initialized": true,
  "crawlComplete": true,
  "analysisComplete": true,
  "mappingComplete": false,
  "exportComplete": false,
  "stats": {
    "pagesCrawled": 50,
    "pageTypesDetected": 5,
    "objectsDetected": 3
  }
}

# List detected page types (for AI decision-making)
s2s list page-types --json

# List detected objects
s2s list objects --json

# List AI-detected blocks
s2s list blocks --json

# Get specific page type details
s2s show page-type blog --json
```

### Phase 5: Environment Variable Support

**Allow AI to set configuration via environment:**

```bash
export S2S_API_KEY="sk-ant-..."
export S2S_NON_INTERACTIVE=1
export S2S_JSON_OUTPUT=1
export S2S_WORKSPACE=".site2sanity"
export S2S_MAX_PAGES=100
export S2S_SCREENSHOT_MODE="fullPage"
```

**Precedence:** CLI args > Environment vars > Config file > Defaults

### Phase 6: MCP Server Integration (Future)

**Consider creating an MCP (Model Context Protocol) server for deeper integration:**

```typescript
// src/mcp/server.ts
export const site2sanityMcpServer = {
  tools: [
    {
      name: "site2sanity_init",
      description: "Initialize a site2sanity workspace for a URL",
      parameters: {
        url: { type: "string", required: true },
        maxPages: { type: "number", default: 50 }
      }
    },
    {
      name: "site2sanity_crawl",
      description: "Crawl a website and capture page data",
      parameters: {...}
    },
    {
      name: "site2sanity_analyze",
      description: "Analyze crawled pages to detect page types",
      parameters: {...}
    },
    // ... more tools
  ]
}
```

This would allow Claude to invoke site2sanity as native tools rather than shell commands.

---

## Implementation Order

### Priority 1: Core Non-Interactive Mode (Essential)
1. Add global `--json` and `--non-interactive` flags
2. Implement JSON output wrapper for all commands
3. Add structured error handling
4. Make `start` command fully non-interactive

### Priority 2: Individual Command Enhancement
5. Enhance `crawl` with all non-interactive options
6. Enhance `analyze` with all non-interactive options
7. Enhance `map` with type selection options
8. Enhance `export` with all non-interactive options

### Priority 3: AI Convenience Features
9. Add `status` introspection command
10. Add `list` subcommands for querying state
11. Add `--config-file` support
12. Add environment variable support

### Priority 4: Advanced Integration (Future)
13. MCP server implementation
14. Programmatic API export (npm package)
15. GitHub Action for CI/CD pipelines

---

## Example AI Agent Workflows

### Workflow 1: Quick Site Analysis

```bash
# AI receives: "Analyze example.com and tell me what content types it has"

s2s start https://example.com \
  --non-interactive \
  --json \
  --max-pages 30 \
  --no-export

# AI parses JSON, reports: "Found 4 page types: blog (12 pages),
# product (8 pages), landing (5 pages), about (5 pages)"
```

### Workflow 2: Full Migration Setup

```bash
# AI receives: "Set up Sanity schemas for example.com"

# Step 1: Full pipeline
s2s start https://example.com \
  --non-interactive \
  --json \
  --max-pages 100 \
  --screenshot-mode aboveFold \
  --ai-analysis \
  --export \
  --export-dir ./sanity-schemas

# AI reports results and provides file locations
```

### Workflow 3: Iterative Refinement

```bash
# AI receives: "Analyze example.com but only create schemas for blog and product"

# Step 1: Crawl and analyze
s2s init https://example.com --json
s2s crawl --json
s2s analyze --ai-analysis --json

# Step 2: AI inspects results, makes decisions
s2s map --non-interactive --json \
  --include-types "blog,product" \
  --exclude-types "landing,about,404"

# Step 3: Export
s2s export --json
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/cli/index.ts` | Add global flags, JSON output mode |
| `src/cli/commands/start.ts` | Add all non-interactive options |
| `src/cli/commands/crawl.ts` | Add JSON output, enhance options |
| `src/cli/commands/analyze.ts` | Add JSON output, API key option |
| `src/cli/commands/map.ts` | Add type selection options |
| `src/cli/commands/export.ts` | Add JSON output, format options |
| `src/cli/commands/lint.ts` | Add JSON output |
| `src/cli/commands/report.ts` | Enhance JSON wrapper |
| `src/cli/commands/config.ts` | Add non-interactive subcommands |
| `src/cli/commands/doctor.ts` | Add JSON output |
| `src/cli/commands/cleanup.ts` | Add JSON output |
| `src/cli/commands/status.ts` | **NEW** - Status introspection |
| `src/cli/commands/list.ts` | **NEW** - List subcommands |
| `src/utils/output.ts` | **NEW** - JSON output helpers |
| `src/utils/errors.ts` | **NEW** - Structured error types |
| `src/types/index.ts` | Add output/error types |

---

## Success Criteria

1. **AI can run full pipeline** with single command, no prompts
2. **All output is parseable JSON** when `--json` flag used
3. **Errors are structured** with codes and recovery suggestions
4. **AI can make incremental decisions** by querying state between steps
5. **Configuration is flexible** via args, files, or environment
6. **Human UX unchanged** when flags not used

---

## Implementation Status

### Phase 1: Core Non-Interactive Mode ✅ COMPLETED

The following has been implemented:

#### New Files Created:
- `src/utils/output.ts` - JSON output helpers with structured error codes
- `src/cli/commands/status.ts` - Workspace status introspection
- `src/cli/commands/list.ts` - Query page-types, objects, blocks, documents

#### Commands Updated with `--json` Support:
- `s2s crawl --json` - Returns structured crawl results
- `s2s analyze --json` - Returns page types, objects, relationships
- `s2s export --json --types <filter> --exclude-types <filter>` - Returns exported files list

#### New Commands:
```bash
# Check workspace status
s2s status --json

# List detected content
s2s list page-types --json
s2s list objects --json
s2s list blocks --json
s2s list documents --json
```

### Example AI Agent Workflow (Now Working)

```bash
# Step 1: Initialize workspace (existing command)
s2s init https://example.com

# Step 2: Crawl with JSON output
s2s crawl --max-pages 50 --json
# Returns: {"success": true, "data": {"stats": {"totalPages": 50, ...}}}

# Step 3: Analyze with JSON output
s2s analyze --json
# Returns: {"success": true, "data": {"pageTypes": [...], "objects": [...]}}

# Step 4: Check status
s2s status --json
# Returns: {"success": true, "data": {"phases": {"crawl": {"complete": true}, ...}}}

# Step 5: List detected page types to make decisions
s2s list page-types --json
# Returns: {"success": true, "data": {"items": [...], "count": 5}}

# Step 6: Export specific types
s2s export --types blog,product --json
# Returns: {"success": true, "data": {"files": [...], "stats": {...}}}
```

### Remaining Work (Future Phases)

- [ ] Add `--json` to remaining commands (lint, doctor, config, cleanup)
- [ ] Add `--config-file` support for complex configurations
- [ ] Environment variable support (S2S_API_KEY, etc.)
- [ ] Non-interactive mode for `start` command
- [ ] MCP server integration

---

## Testing Plan

1. **Unit tests** for JSON output formatting
2. **Integration tests** for non-interactive workflows
3. **E2E tests** simulating AI agent usage patterns
4. **Snapshot tests** for JSON output structure stability
