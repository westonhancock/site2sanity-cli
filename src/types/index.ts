/**
 * Core types for site2sanity-cli
 */

export interface Config {
  baseUrl: string;
  workspaceDir: string;
  crawl: CrawlConfig;
  analyze: AnalyzeConfig;
  sanity: SanityConfig;
  export: ExportConfig;
  ai?: AIConfig;
}

export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  include?: string[];
  exclude?: string[];
  render: boolean;
  screenshot: 'none' | 'aboveFold' | 'fullPage';
  throttle: number;
  concurrency: number;
  respectRobots: boolean;
  userAgent?: string;
}

export interface AnalyzeConfig {
  clusteringThreshold: number;
  maxClusters: number;
  minClusterSize: number;
  relationshipConfidenceThreshold: number;
}

export interface SanityConfig {
  defaultMode: 'builder' | 'template';
  seoDefaults: boolean;
  slugStrategy: 'canonical' | 'path' | 'hash';
  portableTextConfig: 'minimal' | 'standard' | 'full';
}

export interface ExportConfig {
  outDir: string;
  includeStructure: boolean;
  typescriptStyle: 'defineType' | 'plain';
}

export interface AIConfig {
  mode: 'off' | 'label' | 'full';
  provider: 'openai' | 'anthropic';
  model: string;
  samplesPerCluster: number;
  apiKey?: string;
}

// Crawl data structures
export interface Page {
  id: string;
  url: string;
  canonical?: string;
  status: number;
  redirectChain?: string[];
  title?: string;
  meta: PageMeta;
  headings: Heading[];
  lang?: string;
  jsonLd?: any[];
  links: Link[];
  mainContent?: string;
  contentHash: string;
  screenshot?: string;
  crawledAt: Date;
}

export interface PageMeta {
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

export interface Heading {
  level: number;
  text: string;
  id?: string;
}

export interface Link {
  href: string;
  text: string;
  context: 'header' | 'nav' | 'footer' | 'main' | 'aside' | 'breadcrumb';
  rel?: string;
  title?: string;
}

// Analysis structures
export interface NavigationStructure {
  primaryNav: NavItem[];
  footer: NavItem[];
  breadcrumbs: BreadcrumbPattern[];
  siteGraph: SiteGraph;
}

export interface NavItem {
  text: string;
  url: string;
  children?: NavItem[];
  frequency: number;
}

export interface BreadcrumbPattern {
  url: string;
  breadcrumbs: Array<{ text: string; url: string }>;
  source: 'html' | 'jsonld';
}

export interface SiteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  url: string;
  type?: string;
  depth: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  context: string;
  confidence: number;
}

export interface PageType {
  id: string;
  name: string;
  confidence: number;
  examples: string[];
  urlPattern?: string;
  domSignature: string;
  jsonLdTypes?: string[];
  features: PageFeatures;
  pageCount: number;
  rationale: string;
}

export interface PageFeatures {
  hasDate: boolean;
  hasAuthor: boolean;
  hasPrice: boolean;
  hasForm: boolean;
  hasGallery: boolean;
  hasBreadcrumbs: boolean;
  hasRelatedContent: boolean;
  richContent: boolean;
}

export interface Relationship {
  type: 'index-detail' | 'taxonomy' | 'author' | 'pagination' | 'related';
  from: PageType | string;
  to: PageType | string;
  confidence: number;
  evidence: RelationshipEvidence[];
  description: string;
}

export interface RelationshipEvidence {
  fromUrl: string;
  toUrl: string;
  context: string;
}

// Sanity model structures
export interface SanityModel {
  documents: SanityDocumentType[];
  objects: SanityObjectType[];
  blocks: SanityBlockType[];
  singletons: SanitySingletonType[];
}

export interface SanityDocumentType {
  name: string;
  title: string;
  type: 'document';
  mode: 'builder' | 'template';
  fields: SanityField[];
  preview?: SanityPreview;
  fieldsets?: SanityFieldset[];
  icon?: string;
  description?: string;
  __source?: {
    pageType: string;
    confidence: number;
  };
}

export interface SanityObjectType {
  name: string;
  title: string;
  type: 'object';
  fields: SanityField[];
  preview?: SanityPreview;
  description?: string;
}

export interface SanityBlockType {
  name: string;
  title: string;
  type: 'object';
  fields: SanityField[];
  preview?: SanityPreview;
  icon?: string;
  description?: string;
}

export interface SanitySingletonType extends SanityDocumentType {
  singleton: true;
}

export interface SanityField {
  name: string;
  title: string;
  type: string;
  description?: string;
  validation?: any;
  of?: SanityField[];
  to?: Array<{ type: string }>;
  options?: any;
  fieldset?: string;
  hidden?: boolean | ((context: any) => boolean);
}

export interface SanityPreview {
  select: {
    title?: string;
    subtitle?: string;
    media?: string;
    [key: string]: string | undefined;
  };
  prepare?: string;
}

export interface SanityFieldset {
  name: string;
  title: string;
  options?: {
    collapsible?: boolean;
    collapsed?: boolean;
  };
}

// Mapping structures
export interface MappingSpec {
  version: string;
  source: {
    baseUrl: string;
    crawledAt: Date;
    pageCount: number;
  };
  idStrategy: {
    type: 'url-hash' | 'slug' | 'incremental';
    prefix?: string;
  };
  mappings: TypeMapping[];
  globalMappings: GlobalMapping[];
}

export interface TypeMapping {
  sourcePageType: string;
  targetDocumentType: string;
  urlPattern?: string;
  fieldMappings: FieldMapping[];
  extractionStrategy: string;
}

export interface FieldMapping {
  targetField: string;
  source: string;
  transform?: string;
  selector?: string;
  fallback?: any;
}

export interface GlobalMapping {
  type: 'navigation' | 'footer' | 'settings';
  targetDocument: string;
  extractionStrategy: string;
}

// Lint results
export interface LintResult {
  errors: LintIssue[];
  warnings: LintIssue[];
  valid: boolean;
}

export interface LintIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  location?: string;
  fix?: string;
}

// Report structures
export interface Report {
  meta: {
    generatedAt: Date;
    version: string;
    baseUrl: string;
  };
  crawl: CrawlSummary;
  navigation: NavigationSummary;
  pageTypes: PageTypeSummary[];
  model: ModelSummary;
  migration: MigrationReadiness;
  gaps: Gap[];
}

export interface CrawlSummary {
  totalPages: number;
  successfulPages: number;
  errors: number;
  depth: number;
  duration: number;
}

export interface NavigationSummary {
  primaryNavItems: number;
  footerItems: number;
  breadcrumbPatterns: number;
  hierarchy: string;
}

export interface PageTypeSummary {
  name: string;
  count: number;
  confidence: number;
  examples: string[];
  proposedDocumentType: string;
}

export interface ModelSummary {
  documents: number;
  objects: number;
  blocks: number;
  references: number;
  builderMode: number;
  templateMode: number;
}

export interface MigrationReadiness {
  idStrategy: string;
  slugStrategy: string;
  referencesCount: number;
  ndjsonReady: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
  notes: string[];
}

export interface Gap {
  type: 'low-confidence' | 'missing-pattern' | 'complex-feature' | 'unknown';
  description: string;
  affectedPages?: string[];
  recommendation?: string;
}
