/**
 * Analyzer unit tests
 */

import { Analyzer } from '../../src/core/analyzer';
import {
  blogPages,
  navigationPages,
  createMockPage,
  pagesWithCategories,
} from '../fixtures/pages';

describe('Analyzer', () => {
  describe('constructor', () => {
    it('should filter out non-200 pages', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/good', status: 200 }),
        createMockPage({ url: 'https://example.com/not-found', status: 404 }),
        createMockPage({ url: 'https://example.com/error', status: 500 }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      // Only the 200 page should be analyzed
      const allExamples = pageTypes.flatMap(pt => pt.examples);
      expect(allExamples).toContain('https://example.com/good');
      expect(allExamples).not.toContain('https://example.com/not-found');
      expect(allExamples).not.toContain('https://example.com/error');
    });
  });

  describe('analyzeNavigation', () => {
    it('should extract primary navigation items', () => {
      const analyzer = new Analyzer(navigationPages);
      const nav = analyzer.analyzeNavigation();

      expect(nav.primaryNav).toBeDefined();
      expect(nav.primaryNav.length).toBeGreaterThan(0);
    });

    it('should extract footer links', () => {
      const analyzer = new Analyzer(navigationPages);
      const nav = analyzer.analyzeNavigation();

      expect(nav.footer).toBeDefined();
      expect(nav.footer.length).toBeGreaterThan(0);
    });

    it('should filter navigation items by frequency', () => {
      const analyzer = new Analyzer(navigationPages);
      const nav = analyzer.analyzeNavigation();

      // Items should appear on at least 30% of pages
      const minFrequency = Math.ceil(navigationPages.length * 0.3);
      nav.primaryNav.forEach(item => {
        expect(item.frequency).toBeGreaterThanOrEqual(minFrequency);
      });
    });

    it('should sort navigation items by frequency', () => {
      const analyzer = new Analyzer(navigationPages);
      const nav = analyzer.analyzeNavigation();

      for (let i = 1; i < nav.primaryNav.length; i++) {
        expect(nav.primaryNav[i - 1].frequency).toBeGreaterThanOrEqual(nav.primaryNav[i].frequency);
      }
    });

    it('should extract breadcrumb patterns', () => {
      const analyzer = new Analyzer(pagesWithCategories);
      const nav = analyzer.analyzeNavigation();

      expect(nav.breadcrumbs).toBeDefined();
      expect(nav.breadcrumbs.length).toBeGreaterThan(0);
    });

    it('should extract JSON-LD breadcrumbs', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/product/widget',
          jsonLd: [
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { name: 'Home', item: 'https://example.com/' },
                { name: 'Products', item: 'https://example.com/products' },
                { name: 'Widget', item: 'https://example.com/product/widget' },
              ],
            },
          ],
          links: [],
        }),
      ];
      const analyzer = new Analyzer(pages);
      const nav = analyzer.analyzeNavigation();

      expect(nav.breadcrumbs.length).toBe(1);
      expect(nav.breadcrumbs[0].source).toBe('jsonld');
      expect(nav.breadcrumbs[0].breadcrumbs.length).toBe(3);
    });

    it('should build site graph', () => {
      const analyzer = new Analyzer(navigationPages);
      const nav = analyzer.analyzeNavigation();

      expect(nav.siteGraph).toBeDefined();
      expect(nav.siteGraph.nodes).toBeDefined();
      expect(nav.siteGraph.edges).toBeDefined();
      expect(nav.siteGraph.nodes.length).toBe(navigationPages.length);
    });

    it('should set graph node depth based on URL', () => {
      const analyzer = new Analyzer(navigationPages);
      const nav = analyzer.analyzeNavigation();

      const homeNode = nav.siteGraph.nodes.find(n => n.url === 'https://example.com/');
      const aboutNode = nav.siteGraph.nodes.find(n => n.url === 'https://example.com/about');

      expect(homeNode!.depth).toBe(0);
      expect(aboutNode!.depth).toBe(1);
    });
  });

  describe('detectPageTypes', () => {
    it('should group pages by URL pattern', () => {
      const analyzer = new Analyzer(blogPages);
      const pageTypes = analyzer.detectPageTypes();

      // All blog pages should be grouped together
      const blogType = pageTypes.find(pt => pt.urlPattern?.includes('blog'));
      expect(blogType).toBeDefined();
      expect(blogType!.pageCount).toBe(3);
    });

    it('should detect page type name from JSON-LD', () => {
      const analyzer = new Analyzer(blogPages);
      const pageTypes = analyzer.detectPageTypes();

      const articleType = pageTypes.find(pt => pt.name === 'article');
      expect(articleType).toBeDefined();
    });

    it('should include singletons by default', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/' }),
        createMockPage({ url: 'https://example.com/about' }),
        createMockPage({ url: 'https://example.com/contact' }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes(0.7, 20, true);

      // Each page has unique pattern, should be included as singleton
      expect(pageTypes.length).toBeGreaterThanOrEqual(3);
    });

    it('should exclude singletons when disabled', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/' }),
        createMockPage({ url: 'https://example.com/about' }),
        createMockPage({ url: 'https://example.com/blog/post-1' }),
        createMockPage({ url: 'https://example.com/blog/post-2' }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes(0.7, 20, false);

      // Only blog type with 2 pages should be included
      expect(pageTypes.length).toBe(1);
      expect(pageTypes[0].pageCount).toBe(2);
    });

    it('should limit results to maxClusters', () => {
      const pages = Array.from({ length: 50 }, (_, i) =>
        createMockPage({
          url: `https://example.com/type-${i}/page`,
          id: `page-${i}`,
        })
      );
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes(0.7, 10);

      expect(pageTypes.length).toBeLessThanOrEqual(10);
    });

    it('should sort by page count descending', () => {
      const pages = [
        ...blogPages, // 3 pages
        createMockPage({ url: 'https://example.com/about' }), // 1 page
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      for (let i = 1; i < pageTypes.length; i++) {
        expect(pageTypes[i - 1].pageCount).toBeGreaterThanOrEqual(pageTypes[i].pageCount);
      }
    });

    it('should analyze page features', () => {
      const analyzer = new Analyzer(blogPages);
      const pageTypes = analyzer.detectPageTypes();

      const articleType = pageTypes.find(pt => pt.name === 'article');
      expect(articleType).toBeDefined();
      expect(articleType!.features).toBeDefined();
      expect(articleType!.features.hasDate).toBe(true);
      expect(articleType!.features.hasAuthor).toBe(true);
      expect(articleType!.features.richContent).toBe(true);
    });

    it('should extract JSON-LD types', () => {
      const analyzer = new Analyzer(blogPages);
      const pageTypes = analyzer.detectPageTypes();

      const articleType = pageTypes.find(pt => pt.jsonLdTypes?.includes('Article'));
      expect(articleType).toBeDefined();
    });

    it('should generate rationale', () => {
      const analyzer = new Analyzer(blogPages);
      const pageTypes = analyzer.detectPageTypes();

      pageTypes.forEach(pt => {
        expect(pt.rationale).toBeDefined();
        expect(pt.rationale.length).toBeGreaterThan(0);
      });
    });

    it('should calculate confidence score', () => {
      const analyzer = new Analyzer(blogPages);
      const pageTypes = analyzer.detectPageTypes();

      pageTypes.forEach(pt => {
        expect(pt.confidence).toBeGreaterThanOrEqual(0);
        expect(pt.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should create DOM signature from headings', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/posts/1',
          headings: [{ level: 1, text: 'Title' }, { level: 2, text: 'Subtitle' }],
        }),
        createMockPage({
          url: 'https://example.com/posts/2',
          headings: [{ level: 1, text: 'Title 2' }, { level: 2, text: 'Subtitle 2' }],
        }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      const postType = pageTypes[0];
      expect(postType.domSignature).toBe('h1-h2');
    });
  });

  describe('detectRelationships', () => {
    it('should detect index-detail relationships', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/blog',
          links: [
            { href: 'https://example.com/blog/post-1', text: 'Post 1', context: 'main' },
            { href: 'https://example.com/blog/post-2', text: 'Post 2', context: 'main' },
            { href: 'https://example.com/blog/post-3', text: 'Post 3', context: 'main' },
            { href: 'https://example.com/blog/post-4', text: 'Post 4', context: 'main' },
          ],
        }),
        createMockPage({ url: 'https://example.com/blog/post-1' }),
        createMockPage({ url: 'https://example.com/blog/post-2' }),
        createMockPage({ url: 'https://example.com/blog/post-3' }),
        createMockPage({ url: 'https://example.com/blog/post-4' }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();
      const relationships = analyzer.detectRelationships(pageTypes);

      const indexDetail = relationships.find(r => r.type === 'index-detail');
      expect(indexDetail).toBeDefined();
    });

    it('should detect taxonomy relationships from URL patterns', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/category/tech/post-1' }),
        createMockPage({ url: 'https://example.com/category/tech/post-2' }),
        createMockPage({ url: 'https://example.com/category/tech/post-3' }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();
      const relationships = analyzer.detectRelationships(pageTypes);

      const taxonomy = relationships.find(r => r.type === 'taxonomy');
      expect(taxonomy).toBeDefined();
    });

    it('should include relationship evidence', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/blog',
          links: [
            { href: 'https://example.com/blog/post-1', text: 'Post 1', context: 'main' },
            { href: 'https://example.com/blog/post-2', text: 'Post 2', context: 'main' },
            { href: 'https://example.com/blog/post-3', text: 'Post 3', context: 'main' },
          ],
        }),
        createMockPage({ url: 'https://example.com/blog/post-1' }),
        createMockPage({ url: 'https://example.com/blog/post-2' }),
        createMockPage({ url: 'https://example.com/blog/post-3' }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();
      const relationships = analyzer.detectRelationships(pageTypes);

      relationships.forEach(r => {
        expect(r.evidence).toBeDefined();
        expect(Array.isArray(r.evidence)).toBe(true);
      });
    });

    it('should calculate relationship confidence', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/blog',
          links: Array.from({ length: 10 }, (_, i) => ({
            href: `https://example.com/blog/post-${i}`,
            text: `Post ${i}`,
            context: 'main' as const,
          })),
        }),
        ...Array.from({ length: 10 }, (_, i) =>
          createMockPage({ url: `https://example.com/blog/post-${i}`, id: `post-${i}` })
        ),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();
      const relationships = analyzer.detectRelationships(pageTypes);

      relationships.forEach(r => {
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('detectObjects', () => {
    it('should delegate to ObjectDetector', () => {
      const analyzer = new Analyzer(blogPages);
      const objects = analyzer.detectObjects();

      expect(Array.isArray(objects)).toBe(true);
    });

    it('should detect authors from blog pages', () => {
      const analyzer = new Analyzer(blogPages);
      const objects = analyzer.detectObjects();

      const authors = objects.filter(o => o.type === 'author');
      expect(authors.length).toBeGreaterThan(0);
    });
  });

  describe('page type naming', () => {
    it('should use JSON-LD type when available', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/products/widget-1',
          jsonLd: [{ '@type': 'Product' }],
        }),
        createMockPage({
          url: 'https://example.com/products/widget-2',
          jsonLd: [{ '@type': 'Product' }],
        }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      expect(pageTypes[0].name).toBe('product');
    });

    it('should use URL segment when no JSON-LD', () => {
      const pages = [
        createMockPage({ url: 'https://example.com/services/consulting' }),
        createMockPage({ url: 'https://example.com/services/development' }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      expect(pageTypes[0].name).toBe('services');
    });

    it('should detect article type from features', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/posts/1',
          jsonLd: [{ datePublished: '2024-01-01', author: 'John' }],
          mainContent: 'Long content '.repeat(100),
        }),
        createMockPage({
          url: 'https://example.com/posts/2',
          jsonLd: [{ datePublished: '2024-01-02', author: 'Jane' }],
          mainContent: 'Long content '.repeat(100),
        }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      // Should detect as article due to hasAuthor + hasDate features
      expect(pageTypes[0].features.hasAuthor).toBe(true);
      expect(pageTypes[0].features.hasDate).toBe(true);
    });

    it('should detect product type from price content', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/items/1',
          mainContent: 'Widget - $99.99 - Buy now!',
        }),
        createMockPage({
          url: 'https://example.com/items/2',
          mainContent: 'Gadget - $149.99 - Add to cart',
        }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      expect(pageTypes[0].features.hasPrice).toBe(true);
    });

    it('should detect contact pages from form headings', () => {
      const pages = [
        createMockPage({
          url: 'https://example.com/contact',
          headings: [{ level: 1, text: 'Contact Us' }, { level: 2, text: 'Contact Form' }],
        }),
      ];
      const analyzer = new Analyzer(pages);
      const pageTypes = analyzer.detectPageTypes();

      expect(pageTypes[0].features.hasForm).toBe(true);
    });
  });
});
