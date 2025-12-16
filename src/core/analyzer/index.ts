/**
 * Analyzer engine - derives IA, page types, and relationships
 */

import { Page, NavigationStructure, PageType, Relationship, NavItem, BreadcrumbPattern, SiteGraph, GraphNode, GraphEdge, PageFeatures, DetectedObject } from '../../types';
import { extractUrlPattern, getPathSegments, normalizeUrl, getUrlDedupKey } from '../../utils/url';
import levenshtein from 'fast-levenshtein';
import { ObjectDetector } from './objectDetector';
import { AIAnalyzer } from './aiAnalyzer';

export class Analyzer {
  private pages: Page[];
  private aiAnalyzer?: AIAnalyzer;

  constructor(pages: Page[], aiAnalyzer?: AIAnalyzer) {
    // Filter to successful pages and deduplicate by canonical URL / dedup key
    // This catches duplicate entries from query param variations
    const successPages = pages.filter(p => p.status === 200);
    const seenKeys = new Set<string>();
    this.pages = successPages.filter(p => {
      // Use canonical if available, otherwise fall back to dedup key (strips query params)
      const dedupKey = p.canonical ? getUrlDedupKey(p.canonical) : getUrlDedupKey(p.url);
      if (seenKeys.has(dedupKey)) {
        return false;
      }
      seenKeys.add(dedupKey);
      return true;
    });
    this.aiAnalyzer = aiAnalyzer;
  }

  /**
   * Analyze navigation structure
   */
  analyzeNavigation(): NavigationStructure {
    const navLinks = this.pages.flatMap(p =>
      p.links.filter(l => l.context === 'nav' || l.context === 'header')
    );

    const footerLinks = this.pages.flatMap(p =>
      p.links.filter(l => l.context === 'footer')
    );

    const breadcrumbLinks = this.pages.flatMap(p =>
      p.links.filter(l => l.context === 'breadcrumb')
    );

    // Count frequency and build nav structure
    const primaryNav = this.buildNavItems(navLinks);
    const footer = this.buildNavItems(footerLinks);
    const breadcrumbs = this.extractBreadcrumbs(breadcrumbLinks);
    const siteGraph = this.buildSiteGraph();

    return {
      primaryNav,
      footer,
      breadcrumbs,
      siteGraph,
    };
  }

  /**
   * Detect page types through clustering
   */
  detectPageTypes(threshold: number = 0.7, maxClusters: number = 20, includeSingletons: boolean = true): PageType[] {
    // Group pages by URL pattern
    const patternGroups = new Map<string, Page[]>();

    for (const page of this.pages) {
      const pattern = extractUrlPattern(page.url);
      if (!patternGroups.has(pattern)) {
        patternGroups.set(pattern, []);
      }
      patternGroups.get(pattern)!.push(page);
    }

    // Analyze each group
    const pageTypes: PageType[] = [];

    for (const [pattern, pages] of patternGroups.entries()) {
      // Include single pages if enabled (home, about, contact, etc.)
      if (pages.length < 2 && !includeSingletons) continue;

      const features = this.analyzePageFeatures(pages);
      const jsonLdTypes = this.extractJsonLdTypes(pages);
      const domSignature = this.createDomSignature(pages);

      const name = this.inferPageTypeName(pattern, jsonLdTypes, features);

      pageTypes.push({
        id: `type-${pageTypes.length + 1}`,
        name,
        confidence: this.calculateConfidence(pages, features),
        examples: pages.slice(0, 5).map(p => p.url),
        urlPattern: pattern,
        domSignature,
        jsonLdTypes,
        features,
        pageCount: pages.length,
        rationale: this.generateRationale(pattern, pages, features, jsonLdTypes),
      });
    }

    // Sort by page count
    return pageTypes.sort((a, b) => b.pageCount - a.pageCount).slice(0, maxClusters);
  }

  /**
   * Detect relationships between page types
   */
  detectRelationships(pageTypes: PageType[]): Relationship[] {
    const relationships: Relationship[] = [];

    // Index-detail detection
    for (const fromType of pageTypes) {
      for (const toType of pageTypes) {
        if (fromType.id === toType.id) continue;

        const evidence = this.findIndexDetailEvidence(fromType, toType);
        if (evidence.length >= 3) {
          relationships.push({
            type: 'index-detail',
            from: fromType.id,
            to: toType.id,
            confidence: Math.min(evidence.length / 10, 1.0),
            evidence: evidence.slice(0, 5),
            description: `${fromType.name} pages link to multiple ${toType.name} pages`,
          });
        }
      }
    }

    // Taxonomy detection (based on breadcrumbs or URL hierarchy)
    for (const pageType of pageTypes) {
      const taxonomyEvidence = this.findTaxonomyEvidence(pageType);
      if (taxonomyEvidence.length >= 3) {
        relationships.push({
          type: 'taxonomy',
          from: 'taxonomy',
          to: pageType.id,
          confidence: 0.8,
          evidence: taxonomyEvidence.slice(0, 5),
          description: `${pageType.name} pages are organized by category/taxonomy`,
        });
      }
    }

    return relationships;
  }

  /**
   * Detect reusable content objects (authors, categories, tags, etc.)
   */
  async detectObjects(): Promise<DetectedObject[]> {
    const detector = new ObjectDetector(this.pages, this.aiAnalyzer);
    return await detector.detectObjects();
  }

  /**
   * Build navigation items with frequency
   */
  private buildNavItems(links: any[]): NavItem[] {
    const linkMap = new Map<string, { text: string; count: number }>();

    for (const link of links) {
      const normalized = normalizeUrl(link.href);
      if (!linkMap.has(normalized)) {
        linkMap.set(normalized, { text: link.text, count: 0 });
      }
      linkMap.get(normalized)!.count++;
    }

    // Convert to NavItems and filter by frequency
    const navItems: NavItem[] = [];
    const minFrequency = Math.ceil(this.pages.length * 0.3); // Appear on 30% of pages

    for (const [url, data] of linkMap.entries()) {
      if (data.count >= minFrequency) {
        navItems.push({
          text: data.text,
          url,
          frequency: data.count,
        });
      }
    }

    return navItems.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extract breadcrumb patterns
   */
  private extractBreadcrumbs(breadcrumbLinks: any[]): BreadcrumbPattern[] {
    const patterns: BreadcrumbPattern[] = [];
    const seenUrls = new Set<string>();

    for (const page of this.pages) {
      const pageBreadcrumbs = page.links.filter(l => l.context === 'breadcrumb');

      if (pageBreadcrumbs.length > 0 && !seenUrls.has(page.url)) {
        patterns.push({
          url: page.url,
          breadcrumbs: pageBreadcrumbs.map(l => ({
            text: l.text,
            url: normalizeUrl(l.href),
          })),
          source: 'html',
        });
        seenUrls.add(page.url);
      }

      // Check JSON-LD breadcrumbs
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type'] === 'BreadcrumbList' && !seenUrls.has(page.url)) {
            const itemList = item.itemListElement || [];
            patterns.push({
              url: page.url,
              breadcrumbs: itemList.map((elem: any) => ({
                text: elem.name,
                url: elem.item,
              })),
              source: 'jsonld',
            });
            seenUrls.add(page.url);
          }
        }
      }
    }

    return patterns;
  }

  /**
   * Build site graph
   */
  private buildSiteGraph(): SiteGraph {
    const nodes: GraphNode[] = this.pages.map((p, idx) => ({
      id: p.id,
      url: p.url,
      type: undefined,
      depth: getPathSegments(p.url).length,
    }));

    const edges: GraphEdge[] = [];
    const pageMap = new Map(this.pages.map(p => [p.url, p.id]));

    for (const page of this.pages) {
      for (const link of page.links) {
        const toId = pageMap.get(normalizeUrl(link.href));
        if (toId) {
          edges.push({
            from: page.id,
            to: toId,
            context: link.context,
            confidence: link.context === 'nav' ? 0.9 : 0.7,
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Analyze page features
   */
  private analyzePageFeatures(pages: Page[]): PageFeatures {
    let hasDate = 0, hasAuthor = 0, hasPrice = 0, hasForm = 0;
    let hasGallery = 0, hasBreadcrumbs = 0, hasRelatedContent = 0, richContent = 0;

    for (const page of pages) {
      const content = (page.mainContent || '').toLowerCase();
      const headingsText = page.headings.map(h => h.text.toLowerCase()).join(' ');

      if (page.jsonLd?.some(item => item['@type'] === 'Article' || item.datePublished)) hasDate++;
      if (content.includes('author') || page.jsonLd?.some(item => item.author)) hasAuthor++;
      if (content.includes('$') || content.includes('price')) hasPrice++;
      if (headingsText.includes('contact') || headingsText.includes('form')) hasForm++;
      if (page.links.some(l => l.href.includes('gallery') || l.text.toLowerCase().includes('gallery'))) hasGallery++;
      if (page.links.some(l => l.context === 'breadcrumb')) hasBreadcrumbs++;
      if (page.links.some(l => l.text.toLowerCase().includes('related'))) hasRelatedContent++;
      if ((page.mainContent?.length || 0) > 1000) richContent++;
    }

    const threshold = pages.length * 0.5;

    return {
      hasDate: hasDate > threshold,
      hasAuthor: hasAuthor > threshold,
      hasPrice: hasPrice > threshold,
      hasForm: hasForm > threshold,
      hasGallery: hasGallery > threshold,
      hasBreadcrumbs: hasBreadcrumbs > threshold,
      hasRelatedContent: hasRelatedContent > threshold,
      richContent: richContent > threshold,
    };
  }

  /**
   * Extract JSON-LD types
   */
  private extractJsonLdTypes(pages: Page[]): string[] {
    const types = new Set<string>();

    for (const page of pages) {
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type']) {
            types.add(item['@type']);
          }
        }
      }
    }

    return Array.from(types);
  }

  /**
   * Create DOM signature
   */
  private createDomSignature(pages: Page[]): string {
    // Create a signature based on heading structure
    const signatures = pages.slice(0, 5).map(p => {
      return p.headings.map(h => `h${h.level}`).join('-');
    });

    // Return the most common pattern
    const counts = new Map<string, number>();
    for (const sig of signatures) {
      counts.set(sig, (counts.get(sig) || 0) + 1);
    }

    let maxSig = '';
    let maxCount = 0;
    for (const [sig, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxSig = sig;
      }
    }

    return maxSig || 'unknown';
  }

  /**
   * Infer page type name
   */
  private inferPageTypeName(pattern: string, jsonLdTypes: string[], features: PageFeatures): string {
    // Check JSON-LD types
    if (jsonLdTypes.length > 0) {
      return jsonLdTypes[0].toLowerCase();
    }

    // Check URL pattern
    const segments = pattern.split('/').filter(s => s.length > 0 && !s.startsWith(':'));
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      if (lastSegment !== 'index' && lastSegment !== 'home') {
        return lastSegment;
      }
    }

    // Check features
    if (features.hasAuthor && features.hasDate) return 'article';
    if (features.hasPrice) return 'product';
    if (features.hasForm) return 'contact';

    return 'page';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(pages: Page[], features: PageFeatures): number {
    let score = 0.5; // Base score

    // More pages = higher confidence
    if (pages.length > 10) score += 0.2;
    else if (pages.length > 5) score += 0.1;

    // Consistent features = higher confidence
    const featureCount = Object.values(features).filter(Boolean).length;
    score += featureCount * 0.05;

    return Math.min(score, 1.0);
  }

  /**
   * Generate rationale
   */
  private generateRationale(pattern: string, pages: Page[], features: PageFeatures, jsonLdTypes: string[]): string {
    const reasons: string[] = [];

    reasons.push(`${pages.length} pages match the URL pattern "${pattern}"`);

    if (jsonLdTypes.length > 0) {
      reasons.push(`Detected JSON-LD types: ${jsonLdTypes.join(', ')}`);
    }

    const featureList: string[] = [];
    if (features.hasDate) featureList.push('dates');
    if (features.hasAuthor) featureList.push('authors');
    if (features.hasPrice) featureList.push('pricing');
    if (features.richContent) featureList.push('rich content');

    if (featureList.length > 0) {
      reasons.push(`Common features: ${featureList.join(', ')}`);
    }

    return reasons.join('. ');
  }

  /**
   * Find index-detail evidence
   */
  private findIndexDetailEvidence(fromType: PageType, toType: PageType): any[] {
    const evidence: any[] = [];
    const fromPages = this.pages.filter(p => fromType.examples.includes(p.url));
    const toUrls = new Set(toType.examples);

    for (const fromPage of fromPages) {
      const linksToType = fromPage.links.filter(l =>
        toUrls.has(l.href) || toType.examples.some(ex => l.href.includes(ex))
      );

      if (linksToType.length >= 3) {
        for (const link of linksToType.slice(0, 3)) {
          evidence.push({
            fromUrl: fromPage.url,
            toUrl: link.href,
            context: link.context,
          });
        }
      }

      if (evidence.length >= 10) break;
    }

    return evidence;
  }

  /**
   * Find taxonomy evidence
   */
  private findTaxonomyEvidence(pageType: PageType): any[] {
    const evidence: any[] = [];

    // Look for category/tag patterns in URLs
    const categoryPatterns = ['/category/', '/tag/', '/topic/', '/type/'];

    for (const example of pageType.examples) {
      for (const pattern of categoryPatterns) {
        if (example.includes(pattern)) {
          evidence.push({
            fromUrl: 'taxonomy',
            toUrl: example,
            context: 'url-pattern',
          });
        }
      }
    }

    return evidence;
  }
}
