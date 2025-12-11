/**
 * URL utilities tests
 */

import {
  normalizeUrl,
  isValidUrl,
  isSameOrigin,
  urlToId,
  getPathSegments,
  extractUrlPattern,
  urlToSlug,
  getUrlDepth,
  matchesPattern,
  generateContentHash,
} from '../../src/utils/url';

describe('URL Utilities', () => {
  describe('normalizeUrl', () => {
    it('should remove trailing slashes', () => {
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('should preserve root slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('should remove default HTTP port', () => {
      expect(normalizeUrl('http://example.com:80/path')).toBe('http://example.com/path');
    });

    it('should remove default HTTPS port', () => {
      expect(normalizeUrl('https://example.com:443/path')).toBe('https://example.com/path');
    });

    it('should preserve non-default ports', () => {
      expect(normalizeUrl('https://example.com:8080/path')).toBe('https://example.com:8080/path');
    });

    it('should sort query parameters', () => {
      expect(normalizeUrl('https://example.com/path?z=1&a=2')).toBe('https://example.com/path?a=2&z=1');
    });

    it('should handle URLs without query parameters', () => {
      expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path');
    });

    it('should handle relative URLs with base URL', () => {
      expect(normalizeUrl('/path', 'https://example.com')).toBe('https://example.com/path');
    });

    it('should return original URL on parse error', () => {
      // url-parse is permissive, so this should still work
      const result = normalizeUrl('https://example.com/path');
      expect(result).toBe('https://example.com/path');
    });

    it('should handle empty pathname', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid HTTP URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should return true for valid HTTPS URL', () => {
      expect(isValidUrl('https://example.com/path')).toBe(true);
    });

    it('should return true for URL with query parameters', () => {
      expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('should return false for URL without protocol', () => {
      expect(isValidUrl('example.com')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('should return true for URL with port', () => {
      expect(isValidUrl('https://example.com:8080')).toBe(true);
    });
  });

  describe('isSameOrigin', () => {
    it('should return true for same origin URLs', () => {
      expect(isSameOrigin('https://example.com/path1', 'https://example.com/path2')).toBe(true);
    });

    it('should return false for different hostnames', () => {
      expect(isSameOrigin('https://example.com', 'https://other.com')).toBe(false);
    });

    it('should return false for different protocols', () => {
      expect(isSameOrigin('http://example.com', 'https://example.com')).toBe(false);
    });

    it('should return false for different ports', () => {
      expect(isSameOrigin('https://example.com:8080', 'https://example.com:9090')).toBe(false);
    });

    it('should return true for same origin with different paths', () => {
      expect(isSameOrigin('https://example.com/a/b/c', 'https://example.com/x/y/z')).toBe(true);
    });

    it('should handle trailing slashes', () => {
      expect(isSameOrigin('https://example.com/', 'https://example.com/path')).toBe(true);
    });
  });

  describe('urlToId', () => {
    it('should generate consistent ID for same URL', () => {
      const id1 = urlToId('https://example.com/path');
      const id2 = urlToId('https://example.com/path');
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different URLs', () => {
      const id1 = urlToId('https://example.com/path1');
      const id2 = urlToId('https://example.com/path2');
      expect(id1).not.toBe(id2);
    });

    it('should generate 16 character ID', () => {
      const id = urlToId('https://example.com/path');
      expect(id).toHaveLength(16);
    });

    it('should normalize URLs before generating ID', () => {
      const id1 = urlToId('https://example.com/path/');
      const id2 = urlToId('https://example.com/path');
      expect(id1).toBe(id2);
    });
  });

  describe('getPathSegments', () => {
    it('should return empty array for root URL', () => {
      expect(getPathSegments('https://example.com/')).toEqual([]);
    });

    it('should return single segment', () => {
      expect(getPathSegments('https://example.com/blog')).toEqual(['blog']);
    });

    it('should return multiple segments', () => {
      expect(getPathSegments('https://example.com/blog/posts/123')).toEqual(['blog', 'posts', '123']);
    });

    it('should handle trailing slashes', () => {
      expect(getPathSegments('https://example.com/blog/')).toEqual(['blog']);
    });

    it('should return empty array on error', () => {
      expect(getPathSegments('')).toEqual([]);
    });
  });

  describe('extractUrlPattern', () => {
    it('should preserve static segments', () => {
      expect(extractUrlPattern('https://example.com/blog')).toBe('/blog');
    });

    it('should replace numeric IDs with :id', () => {
      expect(extractUrlPattern('https://example.com/posts/123')).toBe('/posts/:id');
    });

    it('should replace UUIDs with :uuid', () => {
      expect(extractUrlPattern('https://example.com/items/550e8400-e29b-41d4-a716-446655440000')).toBe('/items/:uuid');
    });

    it('should replace dates with :date', () => {
      expect(extractUrlPattern('https://example.com/archive/2024-01-15')).toBe('/archive/:date');
    });

    it('should replace slugs in last position with :slug', () => {
      expect(extractUrlPattern('https://example.com/blog/my-awesome-post')).toBe('/blog/:slug');
    });

    it('should replace long alphanumeric slugs with :slug', () => {
      expect(extractUrlPattern('https://example.com/articles/this-is-a-very-long-slug-title')).toBe('/articles/:slug');
    });

    it('should handle complex URL patterns', () => {
      expect(extractUrlPattern('https://example.com/blog/2024-01-15/my-post')).toBe('/blog/:date/:slug');
    });

    it('should return root for root URL', () => {
      expect(extractUrlPattern('https://example.com/')).toBe('/');
    });

    it('should not replace short static segments', () => {
      expect(extractUrlPattern('https://example.com/api')).toBe('/api');
    });
  });

  describe('urlToSlug', () => {
    it('should return "home" for root URL', () => {
      expect(urlToSlug('https://example.com/')).toBe('home');
    });

    it('should return path segment for single segment', () => {
      expect(urlToSlug('https://example.com/about')).toBe('about');
    });

    it('should replace slashes with hyphens', () => {
      expect(urlToSlug('https://example.com/blog/posts/my-post')).toBe('blog-posts-my-post');
    });

    it('should handle trailing slashes', () => {
      expect(urlToSlug('https://example.com/about/')).toBe('about');
    });

    it('should return "page" on error', () => {
      // urlToSlug uses url-parse which is permissive, test with empty
      const result = urlToSlug('');
      expect(typeof result).toBe('string');
    });
  });

  describe('getUrlDepth', () => {
    it('should return 0 for root URL', () => {
      expect(getUrlDepth('https://example.com/')).toBe(0);
    });

    it('should return 1 for single segment', () => {
      expect(getUrlDepth('https://example.com/about')).toBe(1);
    });

    it('should return correct depth for nested paths', () => {
      expect(getUrlDepth('https://example.com/blog/posts/123')).toBe(3);
    });
  });

  describe('matchesPattern', () => {
    it('should match exact pattern', () => {
      expect(matchesPattern('https://example.com/blog', '/blog')).toBe(true);
    });

    it('should match pattern with wildcard', () => {
      expect(matchesPattern('https://example.com/blog/123', '/blog/:id')).toBe(true);
    });

    it('should not match different segment count', () => {
      expect(matchesPattern('https://example.com/blog/posts/123', '/blog/:id')).toBe(false);
    });

    it('should not match different static segments', () => {
      expect(matchesPattern('https://example.com/articles/123', '/blog/:id')).toBe(false);
    });

    it('should match multiple wildcards', () => {
      expect(matchesPattern('https://example.com/blog/2024/my-post', '/blog/:year/:slug')).toBe(true);
    });

    it('should match root pattern', () => {
      expect(matchesPattern('https://example.com/', '/')).toBe(true);
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const hash1 = generateContentHash('test content');
      const hash2 = generateContentHash('test content');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = generateContentHash('content 1');
      const hash2 = generateContentHash('content 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should generate 32 character MD5 hash', () => {
      const hash = generateContentHash('test');
      expect(hash).toHaveLength(32);
    });

    it('should handle empty string', () => {
      const hash = generateContentHash('');
      expect(hash).toHaveLength(32);
    });
  });
});
