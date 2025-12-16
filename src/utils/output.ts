/**
 * JSON output utilities for AI-agent friendly CLI mode
 */

/**
 * Error codes for structured error handling
 */
export enum ErrorCode {
  // Workspace errors
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  WORKSPACE_EXISTS = 'WORKSPACE_EXISTS',

  // Crawl errors
  CRAWL_FAILED = 'CRAWL_FAILED',
  INVALID_URL = 'INVALID_URL',
  NO_PAGES_FOUND = 'NO_PAGES_FOUND',

  // Analysis errors
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  NO_PAGE_TYPES = 'NO_PAGE_TYPES',

  // AI errors
  AI_ERROR = 'AI_ERROR',
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_KEY_INVALID = 'API_KEY_INVALID',

  // Export errors
  EXPORT_FAILED = 'EXPORT_FAILED',
  NO_MODEL_FOUND = 'NO_MODEL_FOUND',

  // General errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error for JSON output
 */
export interface OutputError {
  code: ErrorCode;
  message: string;
  details?: string;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * Base response structure for JSON output
 */
export interface JsonResponse<T = any> {
  success: boolean;
  data?: T;
  error?: OutputError;
}

/**
 * Crawl command response data
 */
export interface CrawlResponseData {
  workspace: string;
  baseUrl: string;
  stats: {
    totalPages: number;
    successfulPages: number;
    errorPages: number;
    duration?: number;
  };
}

/**
 * Analyze command response data
 */
export interface AnalyzeResponseData {
  workspace: string;
  stats: {
    pagesAnalyzed: number;
    pageTypesDetected: number;
    objectsDetected: number;
    relationshipsFound: number;
  };
  pageTypes: Array<{
    id: string;
    name: string;
    pageCount: number;
    confidence: number;
    urlPattern?: string;
    examples: string[];
  }>;
  objects: Array<{
    id: string;
    type: string;
    name: string;
    instanceCount: number;
    confidence: number;
  }>;
  relationships: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
}

/**
 * Export command response data
 */
export interface ExportResponseData {
  workspace: string;
  outputDir: string;
  files: Array<{
    path: string;
    type: 'document' | 'object' | 'block' | 'singleton' | 'config' | 'readme';
  }>;
  stats: {
    documents: number;
    objects: number;
    blocks: number;
    singletons: number;
    totalFiles: number;
  };
}

/**
 * Status command response data
 */
export interface StatusResponseData {
  workspace: string;
  initialized: boolean;
  baseUrl?: string;
  phases: {
    crawl: {
      complete: boolean;
      pageCount?: number;
      lastRun?: string;
    };
    analysis: {
      complete: boolean;
      pageTypesCount?: number;
      objectsCount?: number;
    };
    mapping: {
      complete: boolean;
      documentsCount?: number;
    };
    export: {
      complete: boolean;
      outputDir?: string;
    };
  };
}

/**
 * List command response data
 */
export interface ListResponseData {
  workspace: string;
  type: 'page-types' | 'objects' | 'blocks' | 'documents';
  items: any[];
  count: number;
}

/**
 * Output helper class for consistent JSON/human output
 */
export class Output {
  private jsonMode: boolean;

  constructor(jsonMode: boolean = false) {
    this.jsonMode = jsonMode;
  }

  /**
   * Output success response
   */
  success<T>(data: T): void {
    if (this.jsonMode) {
      const response: JsonResponse<T> = {
        success: true,
        data,
      };
      console.log(JSON.stringify(response, null, 2));
    }
  }

  /**
   * Output error response
   */
  error(
    code: ErrorCode,
    message: string,
    options: {
      details?: string;
      recoverable?: boolean;
      suggestion?: string;
    } = {}
  ): void {
    if (this.jsonMode) {
      const response: JsonResponse = {
        success: false,
        error: {
          code,
          message,
          details: options.details,
          recoverable: options.recoverable ?? false,
          suggestion: options.suggestion,
        },
      };
      console.log(JSON.stringify(response, null, 2));
    }
  }

  /**
   * Check if in JSON mode
   */
  isJsonMode(): boolean {
    return this.jsonMode;
  }
}

/**
 * Create output helper from command options
 */
export function createOutput(options: { json?: boolean }): Output {
  return new Output(options.json ?? false);
}

/**
 * Standard error responses with suggestions
 */
export const ErrorResponses = {
  workspaceNotFound: (workspace: string) => ({
    code: ErrorCode.WORKSPACE_NOT_FOUND,
    message: 'Workspace not initialized',
    details: `No workspace found at ${workspace}`,
    recoverable: true,
    suggestion: 'Run "s2s init <url>" to initialize a workspace',
  }),

  noPagesFound: () => ({
    code: ErrorCode.NO_PAGES_FOUND,
    message: 'No pages found in workspace',
    recoverable: true,
    suggestion: 'Run "s2s crawl" to crawl the website first',
  }),

  noModelFound: () => ({
    code: ErrorCode.NO_MODEL_FOUND,
    message: 'No schema model found',
    recoverable: true,
    suggestion: 'Run "s2s map" to create a schema model first',
  }),

  invalidUrl: (url: string) => ({
    code: ErrorCode.INVALID_URL,
    message: 'Invalid URL provided',
    details: `"${url}" is not a valid URL`,
    recoverable: true,
    suggestion: 'Provide a valid URL starting with http:// or https://',
  }),

  apiKeyMissing: () => ({
    code: ErrorCode.API_KEY_MISSING,
    message: 'API key not provided',
    recoverable: true,
    suggestion: 'Provide API key via --api-key flag or run "s2s config set"',
  }),
};
