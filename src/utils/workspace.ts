/**
 * Workspace management utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';

export class Workspace {
  private workspaceDir: string;

  constructor(workspaceDir: string = '.site2sanity') {
    this.workspaceDir = workspaceDir;
  }

  /**
   * Initialize workspace structure
   */
  async init(baseUrl: string, config?: Partial<Config>): Promise<void> {
    const dirs = [
      this.workspaceDir,
      path.join(this.workspaceDir, 'runs'),
      path.join(this.workspaceDir, 'artifacts'),
      path.join(this.workspaceDir, 'data'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const defaultConfig = this.getDefaultConfig(baseUrl);
    const finalConfig = { ...defaultConfig, ...config };

    await this.saveConfig(finalConfig);
    await this.initDatabase();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(baseUrl: string): Config {
    return {
      baseUrl,
      workspaceDir: this.workspaceDir,
      crawl: {
        maxPages: 1000000, // Effectively unlimited for migration use case
        maxDepth: 100, // Effectively unlimited depth
        include: [],
        exclude: [],
        excludePaths: [], // Glob patterns for paths to exclude (e.g., '/admin/*', '/api/*')
        followSubdomains: false,
        allowedSubdomains: [], // Specific subdomains to follow (empty = all)
        render: false,
        screenshot: 'none',
        screenshotSamplesPerType: 3, // Take 3 representative screenshots per page type
        throttle: 100,
        concurrency: 5,
        respectRobots: true,
      },
      analyze: {
        clusteringThreshold: 0.7,
        maxClusters: 20,
        minClusterSize: 3,
        relationshipConfidenceThreshold: 0.6,
      },
      sanity: {
        defaultMode: 'builder',
        seoDefaults: true,
        slugStrategy: 'canonical',
        portableTextConfig: 'standard',
      },
      export: {
        outDir: 'out',
        includeStructure: true,
        typescriptStyle: 'defineType',
      },
    };
  }

  /**
   * Save configuration
   */
  async saveConfig(config: Config): Promise<void> {
    const configPath = path.join(this.workspaceDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Load configuration
   */
  async loadConfig(): Promise<Config> {
    const configPath = path.join(this.workspaceDir, 'config.json');

    if (!fs.existsSync(configPath)) {
      throw new Error('Workspace not initialized. Run "site2sanity init <url>" first.');
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as Config;
  }

  /**
   * Initialize database
   */
  private async initDatabase(): Promise<void> {
    const dbPath = path.join(this.workspaceDir, 'db.sqlite');

    // Database will be initialized by the database module
    // This is just a placeholder to ensure the file is created
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '');
    }
  }

  /**
   * Create a new run directory
   */
  createRun(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const runDir = path.join(this.workspaceDir, 'runs', timestamp);

    fs.mkdirSync(runDir, { recursive: true });
    fs.mkdirSync(path.join(runDir, 'screenshots'), { recursive: true });
    fs.mkdirSync(path.join(runDir, 'logs'), { recursive: true });

    return runDir;
  }

  /**
   * Get path within workspace
   */
  getPath(...segments: string[]): string {
    return path.join(this.workspaceDir, ...segments);
  }

  /**
   * Check if workspace exists
   */
  exists(): boolean {
    return fs.existsSync(path.join(this.workspaceDir, 'config.json'));
  }

  /**
   * Save JSON data
   */
  async saveJSON(filename: string, data: any): Promise<void> {
    const filepath = path.join(this.workspaceDir, 'data', filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * Load JSON data
   */
  async loadJSON<T>(filename: string): Promise<T | null> {
    const filepath = path.join(this.workspaceDir, 'data', filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * Get the latest run directory
   */
  getLatestRun(): string | null {
    const runsDir = path.join(this.workspaceDir, 'runs');

    if (!fs.existsSync(runsDir)) {
      return null;
    }

    const runs = fs.readdirSync(runsDir)
      .filter(f => fs.statSync(path.join(runsDir, f)).isDirectory())
      .sort()
      .reverse();

    return runs.length > 0 ? path.join(runsDir, runs[0]) : null;
  }
}
