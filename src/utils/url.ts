/**
 * URL utilities
 */

import * as crypto from 'crypto';
import URLParse from 'url-parse';

/**
 * Normalize URL
 */
export function normalizeUrl(url: string, baseUrl?: string): string {
  try {
    const parsed = new URLParse(url, baseUrl || undefined);

    // Remove trailing slash except for root
    let pathname = parsed.pathname || '/';
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Remove default ports
    let port = parsed.port;
    if ((parsed.protocol === 'http:' && port === '80') ||
        (parsed.protocol === 'https:' && port === '443')) {
      port = '';
    }

    // Sort query parameters
    const searchParams = new URLSearchParams(parsed.query);
    const sortedParams = Array.from(searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    const query = sortedParams.length > 0
      ? '?' + new URLSearchParams(sortedParams).toString()
      : '';

    // Reconstruct URL
    const portPart = port ? `:${port}` : '';
    const normalized = `${parsed.protocol}//${parsed.hostname}${portPart}${pathname}${query}`;

    return normalized;
  } catch {
    return url;
  }
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URLParse(url);
    return !!(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Check if URL is same origin
 */
export function isSameOrigin(url: string, baseUrl: string, followSubdomains: boolean = false): boolean {
  try {
    const parsed1 = new URLParse(normalizeUrl(url));
    const parsed2 = new URLParse(normalizeUrl(baseUrl));

    if (followSubdomains) {
      // Check if same domain (including subdomains)
      return isSameDomain(url, baseUrl);
    }

    return parsed1.origin === parsed2.origin;
  } catch {
    return false;
  }
}

/**
 * Check if URL is same domain (allowing subdomains)
 */
export function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const parsed1 = new URLParse(normalizeUrl(url));
    const parsed2 = new URLParse(normalizeUrl(baseUrl));

    // Get root domain from both URLs
    const domain1 = getRootDomain(parsed1.hostname);
    const domain2 = getRootDomain(parsed2.hostname);

    return domain1 === domain2;
  } catch {
    return false;
  }
}

/**
 * Get root domain from hostname (e.g., "blog.example.com" -> "example.com")
 */
export function getRootDomain(hostname: string): string {
  const parts = hostname.split('.');

  // Handle cases like "localhost" or IP addresses
  if (parts.length < 2) {
    return hostname;
  }

  // Get last two parts for standard domains (example.com)
  // This is a simple approach; doesn't handle .co.uk, etc.
  return parts.slice(-2).join('.');
}

/**
 * Generate stable ID from URL
 */
export function urlToId(url: string): string {
  const normalized = normalizeUrl(url);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Extract URL path segments
 */
export function getPathSegments(url: string): string[] {
  try {
    const parsed = new URLParse(url);
    const pathname = parsed.pathname || '/';
    return pathname.split('/').filter(s => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Extract URL pattern (for grouping)
 */
export function extractUrlPattern(url: string): string {
  try {
    const segments = getPathSegments(url);

    // Replace segments that look like IDs/slugs with placeholders
    const pattern = segments.map((segment, index) => {
      // Numbers
      if (/^\d+$/.test(segment)) {
        return ':id';
      }
      // UUIDs
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
        return ':uuid';
      }
      // Date-like patterns
      if (/^\d{4}-\d{2}-\d{2}$/.test(segment)) {
        return ':date';
      }
      // Slugs: lowercase alphanumeric with optional hyphens
      // Detect as slug if it's in the last position and previous segment exists
      // This catches "plato-systems", "sandow", "aec", "d-id" after "case-studies", "solutions", etc.
      if (index > 0 && index === segments.length - 1 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(segment)) {
        return ':slug';
      }
      // Long alphanumeric (likely slugs)
      if (segment.length > 12 && /^[a-z0-9-]+$/.test(segment)) {
        return ':slug';
      }
      return segment;
    }).join('/');

    return '/' + pattern;
  } catch {
    return '/';
  }
}

/**
 * Generate slug from URL
 */
export function urlToSlug(url: string): string {
  try {
    const parsed = new URLParse(url);
    let pathname = parsed.pathname || '/';

    if (pathname === '/') {
      return 'home';
    }

    // Remove trailing slash
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }

    // Replace slashes with hyphens
    return pathname.replace(/\//g, '-');
  } catch {
    return 'page';
  }
}

/**
 * Get URL depth (number of path segments)
 */
export function getUrlDepth(url: string): number {
  return getPathSegments(url).length;
}

/**
 * Check if URL matches pattern
 */
export function matchesPattern(url: string, pattern: string): boolean {
  const urlSegments = getPathSegments(url);
  const patternSegments = pattern.split('/').filter(s => s.length > 0);

  if (urlSegments.length !== patternSegments.length) {
    return false;
  }

  return patternSegments.every((patternSeg, i) => {
    if (patternSeg.startsWith(':')) {
      return true; // Wildcard
    }
    return patternSeg === urlSegments[i];
  });
}

/**
 * Generate content hash
 */
export function generateContentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}
