/**
 * SQLite database for storing crawl data
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { Page } from '../types';

export class CrawlDatabase {
  private db: Database.Database;

  constructor(workspaceDir: string) {
    const dbPath = path.join(workspaceDir, 'db.sqlite');
    this.db = new Database(dbPath);
    this.init();
  }

  /**
   * Initialize database schema
   */
  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        canonical TEXT,
        status INTEGER,
        redirectChain TEXT,
        title TEXT,
        meta TEXT,
        headings TEXT,
        lang TEXT,
        jsonLd TEXT,
        links TEXT,
        mainContent TEXT,
        contentHash TEXT,
        screenshot TEXT,
        crawledAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS crawl_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);
      CREATE INDEX IF NOT EXISTS idx_pages_canonical ON pages(canonical);
      CREATE INDEX IF NOT EXISTS idx_pages_contentHash ON pages(contentHash);
    `);
  }

  /**
   * Save a page
   */
  savePage(page: Page): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pages (
        id, url, canonical, status, redirectChain, title, meta, headings,
        lang, jsonLd, links, mainContent, contentHash, screenshot, crawledAt
      ) VALUES (
        @id, @url, @canonical, @status, @redirectChain, @title, @meta, @headings,
        @lang, @jsonLd, @links, @mainContent, @contentHash, @screenshot, @crawledAt
      )
    `);

    stmt.run({
      id: page.id,
      url: page.url,
      canonical: page.canonical || null,
      status: page.status,
      redirectChain: page.redirectChain ? JSON.stringify(page.redirectChain) : null,
      title: page.title || null,
      meta: JSON.stringify(page.meta),
      headings: JSON.stringify(page.headings),
      lang: page.lang || null,
      jsonLd: page.jsonLd ? JSON.stringify(page.jsonLd) : null,
      links: JSON.stringify(page.links),
      mainContent: page.mainContent || null,
      contentHash: page.contentHash,
      screenshot: page.screenshot || null,
      crawledAt: page.crawledAt.toISOString(),
    });
  }

  /**
   * Get a page by URL
   */
  getPageByUrl(url: string): Page | null {
    const stmt = this.db.prepare('SELECT * FROM pages WHERE url = ?');
    const row = stmt.get(url) as any;

    return row ? this.rowToPage(row) : null;
  }

  /**
   * Get a page by ID
   */
  getPageById(id: string): Page | null {
    const stmt = this.db.prepare('SELECT * FROM pages WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.rowToPage(row) : null;
  }

  /**
   * Get all pages
   */
  getAllPages(): Page[] {
    const stmt = this.db.prepare('SELECT * FROM pages ORDER BY crawledAt');
    const rows = stmt.all() as any[];

    return rows.map(row => this.rowToPage(row));
  }

  /**
   * Get pages by status
   */
  getPagesByStatus(status: number): Page[] {
    const stmt = this.db.prepare('SELECT * FROM pages WHERE status = ?');
    const rows = stmt.all(status) as any[];

    return rows.map(row => this.rowToPage(row));
  }

  /**
   * Check if URL exists
   */
  urlExists(url: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM pages WHERE url = ? OR canonical = ?');
    return stmt.get(url, url) !== undefined;
  }

  /**
   * Get total page count
   */
  getPageCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM pages');
    const row = stmt.get() as any;
    return row.count;
  }

  /**
   * Set metadata value
   */
  setMetadata(key: string, value: any): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO crawl_metadata (key, value)
      VALUES (?, ?)
    `);
    stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  /**
   * Get metadata value
   */
  getMetadata(key: string): any {
    const stmt = this.db.prepare('SELECT value FROM crawl_metadata WHERE key = ?');
    const row = stmt.get(key) as any;

    if (!row) return null;

    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  /**
   * Convert database row to Page object
   */
  private rowToPage(row: any): Page {
    return {
      id: row.id,
      url: row.url,
      canonical: row.canonical || undefined,
      status: row.status,
      redirectChain: row.redirectChain ? JSON.parse(row.redirectChain) : undefined,
      title: row.title || undefined,
      meta: JSON.parse(row.meta),
      headings: JSON.parse(row.headings),
      lang: row.lang || undefined,
      jsonLd: row.jsonLd ? JSON.parse(row.jsonLd) : undefined,
      links: JSON.parse(row.links),
      mainContent: row.mainContent || undefined,
      contentHash: row.contentHash,
      screenshot: row.screenshot || undefined,
      crawledAt: new Date(row.crawledAt),
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.db.exec('DELETE FROM pages; DELETE FROM crawl_metadata;');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
