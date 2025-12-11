/**
 * ObjectDetector unit tests
 */

import { ObjectDetector } from '../../src/core/analyzer/objectDetector';
import {
  pagesWithAuthors,
  pagesWithCategories,
  pagesWithTags,
  pagesWithLocations,
  pagesWithEvents,
  createMockPage,
  productPages,
} from '../fixtures/pages';

describe('ObjectDetector', () => {
  describe('detectObjects', () => {
    it('should return empty array for pages without objects', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/page-1' }),
        createMockPage({ url: 'https://example.com/page-2' }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      expect(objects).toEqual([]);
    });

    it('should only return objects with 2+ instances', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/post-1',
          jsonLd: [{ '@type': 'Article', author: 'Single Author' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      // Single author won't appear because detectObjects filters to 2+ instances
      const authors = objects.filter(o => o.type === 'author');
      expect(authors.length).toBe(0);
    });
  });

  describe('detectAuthors', () => {
    it('should detect authors from JSON-LD', () => {
      // Create pages with authors appearing 2+ times
      const pages = [
        createMockPage({
          id: 'post-1',
          url: 'https://example.com/post-1',
          jsonLd: [{ '@type': 'Article', author: { '@type': 'Person', name: 'John Doe' } }],
        }),
        createMockPage({
          id: 'post-2',
          url: 'https://example.com/post-2',
          jsonLd: [{ '@type': 'Article', author: { '@type': 'Person', name: 'John Doe' } }],
        }),
        createMockPage({
          id: 'post-3',
          url: 'https://example.com/post-3',
          jsonLd: [{ '@type': 'Article', author: { '@type': 'Person', name: 'Jane Smith' } }],
        }),
        createMockPage({
          id: 'post-4',
          url: 'https://example.com/post-4',
          jsonLd: [{ '@type': 'Article', author: { '@type': 'Person', name: 'Jane Smith' } }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const authors = objects.filter(o => o.type === 'author');

      expect(authors.length).toBeGreaterThan(0);

      // Check John Doe is detected (appears in 2 pages)
      const johnDoe = authors.find(a => a.name === 'John Doe');
      expect(johnDoe).toBeDefined();
      expect(johnDoe!.instances.length).toBe(2);
    });

    it('should detect authors from meta tags', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/post-1',
          meta: { author: 'Meta Author' } as any,
        }),
        createMockPage({
          url: 'https://example.com/post-2',
          meta: { author: 'Meta Author' } as any,
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const authors = objects.filter(o => o.type === 'author');

      const metaAuthor = authors.find(a => a.name === 'Meta Author');
      expect(metaAuthor).toBeDefined();
    });

    it('should handle author as string in JSON-LD', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/post-1',
          jsonLd: [{ '@type': 'Article', author: 'String Author' }],
        }),
        createMockPage({
          url: 'https://example.com/post-2',
          jsonLd: [{ '@type': 'Article', author: 'String Author' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const authors = objects.filter(o => o.type === 'author');

      expect(authors.some(a => a.name === 'String Author')).toBe(true);
    });

    it('should handle multiple authors per page', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/post-1',
          jsonLd: [{ '@type': 'Article', author: ['Author A', 'Author B'] }],
        }),
        createMockPage({
          url: 'https://example.com/post-2',
          jsonLd: [{ '@type': 'Article', author: ['Author A', 'Author C'] }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const authors = objects.filter(o => o.type === 'author');

      // Author A appears on both pages
      const authorA = authors.find(a => a.name === 'Author A');
      expect(authorA).toBeDefined();
      expect(authorA!.instances.length).toBe(2);
    });

    it('should set correct confidence based on instance count', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/1', jsonLd: [{ author: 'Popular Author' }] }),
        createMockPage({ url: 'https://example.com/2', jsonLd: [{ author: 'Popular Author' }] }),
        createMockPage({ url: 'https://example.com/3', jsonLd: [{ author: 'Popular Author' }] }),
        createMockPage({ url: 'https://example.com/4', jsonLd: [{ author: 'Popular Author' }] }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const author = objects.find(o => o.name === 'Popular Author');

      expect(author).toBeDefined();
      expect(author!.confidence).toBe(0.9); // > 3 instances = 0.9
    });
  });

  describe('detectCategories', () => {
    it('should detect categories from JSON-LD articleSection', () => {
      // Create pages with category appearing 2+ times
      const pages = [
        createMockPage({
          id: 'cat-1',
          url: 'https://example.com/post-1',
          jsonLd: [{ '@type': 'Article', articleSection: 'Technology' }],
        }),
        createMockPage({
          id: 'cat-2',
          url: 'https://example.com/post-2',
          jsonLd: [{ '@type': 'Article', articleSection: 'Technology' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const categories = objects.filter(o => o.type === 'category');

      const tech = categories.find(c => c.name === 'Technology');
      expect(tech).toBeDefined();
      expect(tech!.instances.length).toBe(2);
    });

    it('should detect categories from breadcrumbs', () => {
      // Create pages with breadcrumb category appearing 2+ times
      const pages = [
        createMockPage({
          id: 'bc-1',
          url: 'https://example.com/category/tech/post-1',
          links: [
            { href: 'https://example.com/', text: 'Home', context: 'breadcrumb' },
            { href: 'https://example.com/category/tech', text: 'Technology', context: 'breadcrumb' },
          ],
        }),
        createMockPage({
          id: 'bc-2',
          url: 'https://example.com/category/tech/post-2',
          links: [
            { href: 'https://example.com/', text: 'Home', context: 'breadcrumb' },
            { href: 'https://example.com/category/tech', text: 'Technology', context: 'breadcrumb' },
          ],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const categories = objects.filter(o => o.type === 'category');

      // Technology appears in breadcrumbs
      expect(categories.some(c => c.name === 'Technology')).toBe(true);
    });

    it('should detect categories from URL patterns', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/category/news/article-1' }),
        createMockPage({ url: 'https://example.com/category/news/article-2' }),
        createMockPage({ url: 'https://example.com/category/news/article-3' }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const categories = objects.filter(o => o.type === 'category');

      const news = categories.find(c => c.name === 'News');
      expect(news).toBeDefined();
    });

    it('should not include Home from breadcrumbs', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/page-1',
          links: [{ href: '/', text: 'Home', context: 'breadcrumb' }],
        }),
        createMockPage({
          url: 'https://example.com/page-2',
          links: [{ href: '/', text: 'Home', context: 'breadcrumb' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const categories = objects.filter(o => o.type === 'category');

      expect(categories.some(c => c.name === 'Home')).toBe(false);
    });
  });

  describe('detectTags', () => {
    it('should detect tags from JSON-LD keywords', () => {
      // Tags require 3+ instances, so create 3 pages with 'javascript'
      const pages = [
        createMockPage({
          id: 'tag-1',
          url: 'https://example.com/post-1',
          jsonLd: [{ '@type': 'Article', keywords: 'javascript, typescript' }],
        }),
        createMockPage({
          id: 'tag-2',
          url: 'https://example.com/post-2',
          jsonLd: [{ '@type': 'Article', keywords: 'javascript, react' }],
        }),
        createMockPage({
          id: 'tag-3',
          url: 'https://example.com/post-3',
          jsonLd: [{ '@type': 'Article', keywords: 'javascript, node' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const tags = objects.filter(o => o.type === 'tag');

      // javascript appears in multiple pages
      const jsTag = tags.find(t => t.name === 'javascript');
      expect(jsTag).toBeDefined();
    });

    it('should detect tags from meta keywords', () => {
      // Tags require 3+ instances
      const pages = [
        createMockPage({
          id: 'meta-1',
          url: 'https://example.com/post-1',
          meta: { keywords: 'node, express' },
        }),
        createMockPage({
          id: 'meta-2',
          url: 'https://example.com/post-2',
          meta: { keywords: 'node, mongodb' },
        }),
        createMockPage({
          id: 'meta-3',
          url: 'https://example.com/post-3',
          meta: { keywords: 'node, typescript' },
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const tags = objects.filter(o => o.type === 'tag');

      // node appears in meta keywords
      const nodeTag = tags.find(t => t.name === 'node');
      expect(nodeTag).toBeDefined();
    });

    it('should handle keywords as array', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/1',
          jsonLd: [{ keywords: ['react', 'vue', 'angular'] }],
        }),
        createMockPage({
          url: 'https://example.com/2',
          jsonLd: [{ keywords: ['react', 'svelte'] }],
        }),
        createMockPage({
          url: 'https://example.com/3',
          jsonLd: [{ keywords: ['react', 'next'] }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const tags = objects.filter(o => o.type === 'tag');

      const reactTag = tags.find(t => t.name === 'react');
      expect(reactTag).toBeDefined();
      expect(reactTag!.instances.length).toBe(3);
    });

    it('should require 3+ instances for tags', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/1', meta: { keywords: 'rare-tag' } }),
        createMockPage({ url: 'https://example.com/2', meta: { keywords: 'rare-tag' } }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const tags = objects.filter(o => o.type === 'tag');

      // rare-tag only appears twice, should not be detected
      expect(tags.some(t => t.name === 'rare-tag')).toBe(false);
    });
  });

  describe('detectLocations', () => {
    it('should detect locations from Place JSON-LD', () => {
      // Same location appearing 2+ times
      const pages = [
        createMockPage({
          id: 'loc-1',
          url: 'https://example.com/about',
          jsonLd: [{
            '@type': 'Place',
            name: 'New York Office',
            address: { streetAddress: '123 Main St' },
          }],
        }),
        createMockPage({
          id: 'loc-2',
          url: 'https://example.com/contact',
          jsonLd: [{
            '@type': 'Place',
            name: 'New York Office',
            address: { streetAddress: '123 Main St' },
          }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const locations = objects.filter(o => o.type === 'location');

      expect(locations.some(l => l.name === 'New York Office')).toBe(true);
    });

    it('should detect locations from LocalBusiness JSON-LD', () => {
      // Same business appearing 2+ times
      const pages = [
        createMockPage({
          id: 'biz-1',
          url: 'https://example.com/locations/sf',
          jsonLd: [{
            '@type': 'LocalBusiness',
            name: 'SF Office',
            address: { streetAddress: '456 Market St' },
          }],
        }),
        createMockPage({
          id: 'biz-2',
          url: 'https://example.com/careers',
          jsonLd: [{
            '@type': 'LocalBusiness',
            name: 'SF Office',
            address: { streetAddress: '456 Market St' },
          }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const locations = objects.filter(o => o.type === 'location');

      expect(locations.some(l => l.name === 'SF Office')).toBe(true);
    });
  });

  describe('detectEvents', () => {
    it('should detect events from Event JSON-LD', () => {
      // Same event appearing 2+ times (e.g., on event page and related pages)
      const pages = [
        createMockPage({
          id: 'event-1',
          url: 'https://example.com/events/conference',
          jsonLd: [{
            '@type': 'Event',
            name: 'Tech Conference 2024',
            startDate: '2024-06-15',
          }],
        }),
        createMockPage({
          id: 'event-2',
          url: 'https://example.com/events/conference/register',
          jsonLd: [{
            '@type': 'Event',
            name: 'Tech Conference 2024',
            startDate: '2024-06-15',
          }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const events = objects.filter(o => o.type === 'event');

      expect(events.some(e => e.name === 'Tech Conference 2024')).toBe(true);
    });

    it('should set high confidence for events', () => {
      const pages = [
        createMockPage({
          id: 'event-1',
          url: 'https://example.com/events/workshop',
          jsonLd: [{ '@type': 'Event', name: 'React Workshop', startDate: '2024-07-01' }],
        }),
        createMockPage({
          id: 'event-2',
          url: 'https://example.com/events/workshop/info',
          jsonLd: [{ '@type': 'Event', name: 'React Workshop', startDate: '2024-07-01' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const events = objects.filter(o => o.type === 'event');

      events.forEach(event => {
        expect(event.confidence).toBe(0.9);
      });
    });
  });

  describe('detectProducts', () => {
    it('should detect products from Product JSON-LD', () => {
      // Same product appearing 2+ times
      const pages = [
        createMockPage({
          id: 'prod-1',
          url: 'https://example.com/products/widget-pro',
          jsonLd: [{ '@type': 'Product', name: 'Widget Pro', offers: { price: 99.99 } }],
        }),
        createMockPage({
          id: 'prod-2',
          url: 'https://example.com/products/widget-pro/reviews',
          jsonLd: [{ '@type': 'Product', name: 'Widget Pro', offers: { price: 99.99 } }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const products = objects.filter(o => o.type === 'product');

      expect(products.some(p => p.name === 'Widget Pro')).toBe(true);
    });

    it('should set high confidence for products', () => {
      const pages = [
        createMockPage({
          id: 'prod-1',
          url: 'https://example.com/shop/gadget',
          jsonLd: [{ '@type': 'Product', name: 'Super Gadget' }],
        }),
        createMockPage({
          id: 'prod-2',
          url: 'https://example.com/shop/gadget/specs',
          jsonLd: [{ '@type': 'Product', name: 'Super Gadget' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const products = objects.filter(o => o.type === 'product');

      products.forEach(product => {
        expect(product.confidence).toBe(0.9);
      });
    });
  });

  describe('field inference', () => {
    it('should infer fields from object instances', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/1',
          jsonLd: [{
            '@type': 'Article',
            author: {
              name: 'John Doe',
              url: 'https://example.com/john',
              email: 'john@example.com',
            },
          }],
        }),
        createMockPage({
          url: 'https://example.com/2',
          jsonLd: [{
            '@type': 'Article',
            author: {
              name: 'John Doe',
              url: 'https://example.com/john',
            },
          }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const author = objects.find(o => o.name === 'John Doe');

      expect(author).toBeDefined();
      expect(author!.suggestedFields).toBeDefined();

      // name and url should be present in both, email in one
      const nameField = author!.suggestedFields.find(f => f.name === 'name');
      const urlField = author!.suggestedFields.find(f => f.name === 'url');

      expect(nameField).toBeDefined();
      expect(urlField).toBeDefined();
      expect(urlField!.type).toBe('url');
    });

    it('should detect datetime fields', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/1',
          jsonLd: [{ '@type': 'Event', name: 'Event 1', startDate: '2024-01-15T10:00:00' }],
        }),
        createMockPage({
          url: 'https://example.com/2',
          jsonLd: [{ '@type': 'Event', name: 'Event 1', startDate: '2024-02-20T14:00:00' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const event = objects.find(o => o.type === 'event');

      expect(event).toBeDefined();
      const dateField = event!.suggestedFields.find(f => f.name === 'startDate');
      expect(dateField).toBeDefined();
      expect(dateField!.type).toBe('datetime');
    });

    it('should mark fields as required based on 80% threshold', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/1',
          jsonLd: [{ author: { name: 'Author', bio: 'Bio 1' } }],
        }),
        createMockPage({
          url: 'https://example.com/2',
          jsonLd: [{ author: { name: 'Author', bio: 'Bio 2' } }],
        }),
        createMockPage({
          url: 'https://example.com/3',
          jsonLd: [{ author: { name: 'Author' } }], // No bio
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const author = objects.find(o => o.name === 'Author');

      expect(author).toBeDefined();
      const nameField = author!.suggestedFields.find(f => f.name === 'name');
      const bioField = author!.suggestedFields.find(f => f.name === 'bio');

      expect(nameField!.required).toBe(true);  // 100% presence
      expect(bioField!.required).toBe(false);  // ~67% presence
    });
  });

  describe('slugify', () => {
    it('should generate valid slug IDs', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/1',
          jsonLd: [{ author: 'John "The Developer" Doe!' }],
        }),
        createMockPage({
          url: 'https://example.com/2',
          jsonLd: [{ author: 'John "The Developer" Doe!' }],
        }),
      ];
      const detector = new ObjectDetector(pages);
      const objects = detector.detectObjects();
      const author = objects.find(o => o.type === 'author');

      expect(author).toBeDefined();
      expect(author!.id).toMatch(/^author-[a-z0-9-]+$/);
    });
  });
});
