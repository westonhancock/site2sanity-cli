/**
 * CrawlDatabase unit tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CrawlDatabase } from '../../src/utils/database';
import { Page } from '../../src/types';
import { createMockPage } from '../fixtures/pages';

describe('CrawlDatabase', () => {
  let tempDir: string;
  let db: CrawlDatabase;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-db-test-'));
    db = new CrawlDatabase(tempDir);
  });

  afterEach(() => {
    // Close database and clean up
    db.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('initialization', () => {
    it('should create database file', () => {
      expect(fs.existsSync(path.join(tempDir, 'db.sqlite'))).toBe(true);
    });

    it('should create pages table', () => {
      // Saving a page should work, meaning table exists
      const page = createMockPage();
      expect(() => db.savePage(page)).not.toThrow();
    });

    it('should create crawl_metadata table', () => {
      // Setting metadata should work, meaning table exists
      expect(() => db.setMetadata('test', 'value')).not.toThrow();
    });
  });

  describe('savePage', () => {
    it('should save a page', () => {
      const page = createMockPage();
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.url).toBe(page.url);
    });

    it('should update existing page with same URL', () => {
      const page1 = createMockPage({ title: 'Original Title' });
      db.savePage(page1);

      const page2 = createMockPage({ title: 'Updated Title' });
      db.savePage(page2);

      const retrieved = db.getPageByUrl(page1.url);
      expect(retrieved!.title).toBe('Updated Title');
    });

    it('should serialize JSON fields correctly', () => {
      const page = createMockPage({
        meta: { description: 'Test', keywords: 'a,b,c' },
        headings: [{ level: 1, text: 'H1' }, { level: 2, text: 'H2' }],
        links: [{ href: '/link', text: 'Link', context: 'main' }],
        jsonLd: [{ '@type': 'Article', headline: 'Test' }],
      });
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved!.meta).toEqual(page.meta);
      expect(retrieved!.headings).toEqual(page.headings);
      expect(retrieved!.links).toEqual(page.links);
      expect(retrieved!.jsonLd).toEqual(page.jsonLd);
    });

    it('should handle optional fields', () => {
      const page = createMockPage({
        canonical: undefined,
        redirectChain: undefined,
        title: undefined,
        lang: undefined,
        jsonLd: undefined,
        mainContent: undefined,
        screenshot: undefined,
      });
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved!.canonical).toBeUndefined();
      expect(retrieved!.redirectChain).toBeUndefined();
      expect(retrieved!.title).toBeUndefined();
      expect(retrieved!.jsonLd).toBeUndefined();
    });

    it('should preserve crawledAt date', () => {
      const crawledAt = new Date('2024-06-15T10:30:00Z');
      const page = createMockPage({ crawledAt });
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved!.crawledAt).toEqual(crawledAt);
    });
  });

  describe('getPageByUrl', () => {
    it('should return page for existing URL', () => {
      const page = createMockPage({ url: 'https://example.com/test' });
      db.savePage(page);

      const retrieved = db.getPageByUrl('https://example.com/test');
      expect(retrieved).not.toBeNull();
    });

    it('should return null for non-existent URL', () => {
      const retrieved = db.getPageByUrl('https://example.com/nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getPageById', () => {
    it('should return page for existing ID', () => {
      const page = createMockPage({ id: 'unique-id-123' });
      db.savePage(page);

      const retrieved = db.getPageById('unique-id-123');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('unique-id-123');
    });

    it('should return null for non-existent ID', () => {
      const retrieved = db.getPageById('nonexistent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllPages', () => {
    it('should return all pages', () => {
      db.savePage(createMockPage({ id: 'page-1', url: 'https://example.com/1' }));
      db.savePage(createMockPage({ id: 'page-2', url: 'https://example.com/2' }));
      db.savePage(createMockPage({ id: 'page-3', url: 'https://example.com/3' }));

      const pages = db.getAllPages();
      expect(pages.length).toBe(3);
    });

    it('should return empty array when no pages', () => {
      const pages = db.getAllPages();
      expect(pages).toEqual([]);
    });

    it('should order by crawledAt', () => {
      db.savePage(createMockPage({
        id: 'page-1',
        url: 'https://example.com/1',
        crawledAt: new Date('2024-01-03'),
      }));
      db.savePage(createMockPage({
        id: 'page-2',
        url: 'https://example.com/2',
        crawledAt: new Date('2024-01-01'),
      }));
      db.savePage(createMockPage({
        id: 'page-3',
        url: 'https://example.com/3',
        crawledAt: new Date('2024-01-02'),
      }));

      const pages = db.getAllPages();
      expect(pages[0].id).toBe('page-2'); // Oldest first
      expect(pages[1].id).toBe('page-3');
      expect(pages[2].id).toBe('page-1'); // Newest last
    });
  });

  describe('getPagesByStatus', () => {
    it('should return pages with matching status', () => {
      db.savePage(createMockPage({ id: 'ok-1', url: 'https://example.com/1', status: 200 }));
      db.savePage(createMockPage({ id: 'ok-2', url: 'https://example.com/2', status: 200 }));
      db.savePage(createMockPage({ id: 'error', url: 'https://example.com/3', status: 404 }));

      const okPages = db.getPagesByStatus(200);
      const errorPages = db.getPagesByStatus(404);

      expect(okPages.length).toBe(2);
      expect(errorPages.length).toBe(1);
    });

    it('should return empty array for no matching status', () => {
      db.savePage(createMockPage({ status: 200 }));

      const pages = db.getPagesByStatus(500);
      expect(pages).toEqual([]);
    });
  });

  describe('urlExists', () => {
    it('should return true for existing URL', () => {
      db.savePage(createMockPage({ url: 'https://example.com/test' }));
      expect(db.urlExists('https://example.com/test')).toBe(true);
    });

    it('should return true for existing canonical URL', () => {
      db.savePage(createMockPage({
        url: 'https://example.com/original',
        canonical: 'https://example.com/canonical',
      }));
      expect(db.urlExists('https://example.com/canonical')).toBe(true);
    });

    it('should return false for non-existent URL', () => {
      expect(db.urlExists('https://example.com/nonexistent')).toBe(false);
    });
  });

  describe('getPageCount', () => {
    it('should return 0 for empty database', () => {
      expect(db.getPageCount()).toBe(0);
    });

    it('should return correct count', () => {
      db.savePage(createMockPage({ id: '1', url: 'https://example.com/1' }));
      db.savePage(createMockPage({ id: '2', url: 'https://example.com/2' }));
      db.savePage(createMockPage({ id: '3', url: 'https://example.com/3' }));

      expect(db.getPageCount()).toBe(3);
    });
  });

  describe('metadata', () => {
    it('should set and get string metadata', () => {
      db.setMetadata('key', 'value');
      expect(db.getMetadata('key')).toBe('value');
    });

    it('should set and get object metadata', () => {
      db.setMetadata('config', { setting: true, count: 42 });
      expect(db.getMetadata('config')).toEqual({ setting: true, count: 42 });
    });

    it('should set and get array metadata', () => {
      db.setMetadata('list', [1, 2, 3]);
      expect(db.getMetadata('list')).toEqual([1, 2, 3]);
    });

    it('should return null for non-existent key', () => {
      expect(db.getMetadata('nonexistent')).toBeNull();
    });

    it('should update existing metadata', () => {
      db.setMetadata('key', 'original');
      db.setMetadata('key', 'updated');
      expect(db.getMetadata('key')).toBe('updated');
    });
  });

  describe('clear', () => {
    it('should remove all pages', () => {
      db.savePage(createMockPage({ id: '1', url: 'https://example.com/1' }));
      db.savePage(createMockPage({ id: '2', url: 'https://example.com/2' }));

      db.clear();

      expect(db.getPageCount()).toBe(0);
      expect(db.getAllPages()).toEqual([]);
    });

    it('should remove all metadata', () => {
      db.setMetadata('key1', 'value1');
      db.setMetadata('key2', 'value2');

      db.clear();

      expect(db.getMetadata('key1')).toBeNull();
      expect(db.getMetadata('key2')).toBeNull();
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      db.close();
      // After closing, operations should throw
      expect(() => db.getPageCount()).toThrow();
    });
  });

  describe('data integrity', () => {
    it('should handle special characters in content', () => {
      const page = createMockPage({
        title: "Test's \"Title\" & <special> chars",
        mainContent: 'Content with émojis 🎉 and unicode: 日本語',
      });
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved!.title).toBe(page.title);
      expect(retrieved!.mainContent).toBe(page.mainContent);
    });

    it('should handle large content', () => {
      const largeContent = 'x'.repeat(100000); // 100KB
      const page = createMockPage({ mainContent: largeContent });
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved!.mainContent).toBe(largeContent);
    });

    it('should handle complex JSON-LD', () => {
      const complexJsonLd = [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Test Article',
          author: {
            '@type': 'Person',
            name: 'John Doe',
            sameAs: ['https://twitter.com/johndoe', 'https://linkedin.com/in/johndoe'],
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': 'https://example.com/article',
          },
          datePublished: '2024-01-15T10:00:00+00:00',
          dateModified: '2024-01-16T14:30:00+00:00',
        },
      ];
      const page = createMockPage({ jsonLd: complexJsonLd });
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved!.jsonLd).toEqual(complexJsonLd);
    });

    it('should handle redirect chains', () => {
      const redirectChain = [
        'https://example.com/old',
        'https://example.com/redirect',
        'https://example.com/final',
      ];
      const page = createMockPage({ redirectChain });
      db.savePage(page);

      const retrieved = db.getPageByUrl(page.url);
      expect(retrieved!.redirectChain).toEqual(redirectChain);
    });
  });
});
