/**
 * Test fixtures - Mock page data for testing
 */

import { Page, PageMeta, Link, Heading } from '../../src/types';

/**
 * Create a mock page with default values
 */
export function createMockPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'test-page-1',
    url: 'https://example.com/test',
    status: 200,
    title: 'Test Page',
    meta: createMockMeta(),
    headings: [{ level: 1, text: 'Test Page' }],
    links: [],
    contentHash: 'abc123',
    crawledAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create mock page meta
 */
export function createMockMeta(overrides: Partial<PageMeta> = {}): PageMeta {
  return {
    description: 'Test page description',
    ...overrides,
  };
}

/**
 * Create a mock link
 */
export function createMockLink(overrides: Partial<Link> = {}): Link {
  return {
    href: 'https://example.com/link',
    text: 'Test Link',
    context: 'main',
    ...overrides,
  };
}

/**
 * Create a mock heading
 */
export function createMockHeading(overrides: Partial<Heading> = {}): Heading {
  return {
    level: 1,
    text: 'Test Heading',
    ...overrides,
  };
}

/**
 * Sample blog pages for testing page type detection
 */
export const blogPages: Page[] = [
  createMockPage({
    id: 'blog-1',
    url: 'https://example.com/blog/first-post',
    title: 'First Blog Post',
    headings: [
      { level: 1, text: 'First Blog Post' },
      { level: 2, text: 'Introduction' },
    ],
    jsonLd: [
      {
        '@type': 'Article',
        headline: 'First Blog Post',
        author: { '@type': 'Person', name: 'John Doe' },
        datePublished: '2024-01-01',
      },
    ],
    links: [
      { href: 'https://example.com/blog', text: 'Blog', context: 'breadcrumb' },
      { href: 'https://example.com/blog/second-post', text: 'Second Post', context: 'main' },
    ],
    mainContent: 'This is a long blog post with lots of content. '.repeat(100),
  }),
  createMockPage({
    id: 'blog-2',
    url: 'https://example.com/blog/second-post',
    title: 'Second Blog Post',
    headings: [
      { level: 1, text: 'Second Blog Post' },
      { level: 2, text: 'Overview' },
    ],
    jsonLd: [
      {
        '@type': 'Article',
        headline: 'Second Blog Post',
        author: { '@type': 'Person', name: 'John Doe' },
        datePublished: '2024-01-15',
      },
    ],
    links: [
      { href: 'https://example.com/blog', text: 'Blog', context: 'breadcrumb' },
      { href: 'https://example.com/blog/first-post', text: 'First Post', context: 'main' },
    ],
    mainContent: 'Another blog post with substantial content. '.repeat(100),
  }),
  createMockPage({
    id: 'blog-3',
    url: 'https://example.com/blog/third-post',
    title: 'Third Blog Post',
    headings: [
      { level: 1, text: 'Third Blog Post' },
      { level: 2, text: 'Details' },
    ],
    jsonLd: [
      {
        '@type': 'Article',
        headline: 'Third Blog Post',
        author: { '@type': 'Person', name: 'Jane Smith' },
        datePublished: '2024-02-01',
        keywords: 'tech, programming, web',
      },
    ],
    links: [
      { href: 'https://example.com/blog', text: 'Blog', context: 'breadcrumb' },
    ],
    mainContent: 'A third blog post. '.repeat(100),
  }),
];

/**
 * Sample product pages for testing
 */
export const productPages: Page[] = [
  createMockPage({
    id: 'product-1',
    url: 'https://example.com/products/widget-pro',
    title: 'Widget Pro',
    jsonLd: [
      {
        '@type': 'Product',
        name: 'Widget Pro',
        description: 'Professional widget',
        offers: { price: 99.99, priceCurrency: 'USD' },
      },
    ],
    mainContent: 'Widget Pro - $99.99. The best widget for professionals.',
  }),
  createMockPage({
    id: 'product-2',
    url: 'https://example.com/products/widget-basic',
    title: 'Widget Basic',
    jsonLd: [
      {
        '@type': 'Product',
        name: 'Widget Basic',
        description: 'Basic widget',
        offers: { price: 29.99, priceCurrency: 'USD' },
      },
    ],
    mainContent: 'Widget Basic - $29.99. Entry-level widget.',
  }),
];

/**
 * Sample pages with navigation structure
 */
export const navigationPages: Page[] = [
  createMockPage({
    id: 'home',
    url: 'https://example.com/',
    title: 'Home',
    links: [
      { href: 'https://example.com/about', text: 'About', context: 'nav' },
      { href: 'https://example.com/blog', text: 'Blog', context: 'nav' },
      { href: 'https://example.com/contact', text: 'Contact', context: 'nav' },
      { href: 'https://example.com/privacy', text: 'Privacy', context: 'footer' },
      { href: 'https://example.com/terms', text: 'Terms', context: 'footer' },
    ],
  }),
  createMockPage({
    id: 'about',
    url: 'https://example.com/about',
    title: 'About Us',
    links: [
      { href: 'https://example.com/about', text: 'About', context: 'nav' },
      { href: 'https://example.com/blog', text: 'Blog', context: 'nav' },
      { href: 'https://example.com/contact', text: 'Contact', context: 'nav' },
      { href: 'https://example.com/privacy', text: 'Privacy', context: 'footer' },
      { href: 'https://example.com/terms', text: 'Terms', context: 'footer' },
    ],
  }),
  createMockPage({
    id: 'blog-index',
    url: 'https://example.com/blog',
    title: 'Blog',
    links: [
      { href: 'https://example.com/about', text: 'About', context: 'nav' },
      { href: 'https://example.com/blog', text: 'Blog', context: 'nav' },
      { href: 'https://example.com/contact', text: 'Contact', context: 'nav' },
      { href: 'https://example.com/blog/post-1', text: 'Post 1', context: 'main' },
      { href: 'https://example.com/blog/post-2', text: 'Post 2', context: 'main' },
      { href: 'https://example.com/privacy', text: 'Privacy', context: 'footer' },
      { href: 'https://example.com/terms', text: 'Terms', context: 'footer' },
    ],
  }),
  createMockPage({
    id: 'contact',
    url: 'https://example.com/contact',
    title: 'Contact Us',
    headings: [
      { level: 1, text: 'Contact Us' },
      { level: 2, text: 'Contact Form' },
    ],
    links: [
      { href: 'https://example.com/about', text: 'About', context: 'nav' },
      { href: 'https://example.com/blog', text: 'Blog', context: 'nav' },
      { href: 'https://example.com/contact', text: 'Contact', context: 'nav' },
      { href: 'https://example.com/privacy', text: 'Privacy', context: 'footer' },
      { href: 'https://example.com/terms', text: 'Terms', context: 'footer' },
    ],
  }),
];

/**
 * Pages with author data for object detection testing
 */
export const pagesWithAuthors: Page[] = [
  createMockPage({
    id: 'author-post-1',
    url: 'https://example.com/blog/post-by-john',
    jsonLd: [
      {
        '@type': 'Article',
        author: { '@type': 'Person', name: 'John Doe', url: 'https://example.com/authors/john' },
      },
    ],
    meta: { author: 'John Doe' } as any,
  }),
  createMockPage({
    id: 'author-post-2',
    url: 'https://example.com/blog/another-by-john',
    jsonLd: [
      {
        '@type': 'Article',
        author: { '@type': 'Person', name: 'John Doe', url: 'https://example.com/authors/john' },
      },
    ],
  }),
  createMockPage({
    id: 'author-post-3',
    url: 'https://example.com/blog/post-by-jane',
    jsonLd: [
      {
        '@type': 'Article',
        author: 'Jane Smith',
      },
    ],
  }),
  createMockPage({
    id: 'author-post-4',
    url: 'https://example.com/blog/another-by-jane',
    jsonLd: [
      {
        '@type': 'Article',
        author: 'Jane Smith',
      },
    ],
  }),
];

/**
 * Pages with category data
 */
export const pagesWithCategories: Page[] = [
  createMockPage({
    id: 'cat-post-1',
    url: 'https://example.com/category/tech/post-1',
    jsonLd: [{ '@type': 'Article', articleSection: 'Technology' }],
    links: [
      { href: 'https://example.com/', text: 'Home', context: 'breadcrumb' },
      { href: 'https://example.com/category/tech', text: 'Technology', context: 'breadcrumb' },
    ],
  }),
  createMockPage({
    id: 'cat-post-2',
    url: 'https://example.com/category/tech/post-2',
    jsonLd: [{ '@type': 'Article', articleSection: 'Technology' }],
    links: [
      { href: 'https://example.com/', text: 'Home', context: 'breadcrumb' },
      { href: 'https://example.com/category/tech', text: 'Technology', context: 'breadcrumb' },
    ],
  }),
  createMockPage({
    id: 'cat-post-3',
    url: 'https://example.com/category/business/post-1',
    jsonLd: [{ '@type': 'Article', articleSection: 'Business' }],
    links: [
      { href: 'https://example.com/', text: 'Home', context: 'breadcrumb' },
      { href: 'https://example.com/category/business', text: 'Business', context: 'breadcrumb' },
    ],
  }),
];

/**
 * Pages with tags/keywords
 */
export const pagesWithTags: Page[] = [
  createMockPage({
    id: 'tag-post-1',
    url: 'https://example.com/blog/tagged-1',
    jsonLd: [{ '@type': 'Article', keywords: 'javascript, typescript, web' }],
    meta: { keywords: 'javascript, typescript, web' },
  }),
  createMockPage({
    id: 'tag-post-2',
    url: 'https://example.com/blog/tagged-2',
    jsonLd: [{ '@type': 'Article', keywords: ['javascript', 'react', 'frontend'] }],
    meta: { keywords: 'javascript, react, frontend' },
  }),
  createMockPage({
    id: 'tag-post-3',
    url: 'https://example.com/blog/tagged-3',
    meta: { keywords: 'javascript, node, backend' },
  }),
  createMockPage({
    id: 'tag-post-4',
    url: 'https://example.com/blog/tagged-4',
    meta: { keywords: 'typescript, node, backend' },
  }),
];

/**
 * Pages with location/event data
 */
export const pagesWithLocations: Page[] = [
  createMockPage({
    id: 'location-1',
    url: 'https://example.com/locations/new-york',
    jsonLd: [
      {
        '@type': 'Place',
        name: 'New York Office',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '123 Main St',
          addressLocality: 'New York',
          addressRegion: 'NY',
        },
      },
    ],
  }),
  createMockPage({
    id: 'location-2',
    url: 'https://example.com/locations/san-francisco',
    jsonLd: [
      {
        '@type': 'LocalBusiness',
        name: 'SF Office',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '456 Market St',
          addressLocality: 'San Francisco',
          addressRegion: 'CA',
        },
      },
    ],
  }),
];

/**
 * Pages with event data
 */
export const pagesWithEvents: Page[] = [
  createMockPage({
    id: 'event-1',
    url: 'https://example.com/events/conference-2024',
    jsonLd: [
      {
        '@type': 'Event',
        name: 'Tech Conference 2024',
        startDate: '2024-06-15',
        location: { '@type': 'Place', name: 'Convention Center' },
      },
    ],
  }),
  createMockPage({
    id: 'event-2',
    url: 'https://example.com/events/workshop-react',
    jsonLd: [
      {
        '@type': 'Event',
        name: 'React Workshop',
        startDate: '2024-07-01',
        location: { '@type': 'Place', name: 'Online' },
      },
    ],
  }),
];
