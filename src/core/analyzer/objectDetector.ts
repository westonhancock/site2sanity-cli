/**
 * Object Detector - Identifies reusable content objects across pages
 */

import {
  Page,
  DetectedObject,
  ContentObjectInstance,
  ObjectField,
  StructuredDataPattern,
} from '../../types';
import { AIAnalyzer } from './aiAnalyzer';
import { logger } from '../../utils/logger';

export class ObjectDetector {
  private pages: Page[];
  private aiAnalyzer?: AIAnalyzer;

  constructor(pages: Page[], aiAnalyzer?: AIAnalyzer) {
    this.pages = pages;
    this.aiAnalyzer = aiAnalyzer;
  }

  /**
   * Detect all reusable objects across the site
   */
  async detectObjects(): Promise<DetectedObject[]> {
    const objects: DetectedObject[] = [];

    // Detect authors
    const authors = await this.detectAuthors();
    objects.push(...authors);

    // Detect categories/tags from various sources
    const categories = await this.detectCategories();
    objects.push(...categories);

    const tags = await this.detectTags();
    objects.push(...tags);

    // Detect locations (addresses, places)
    const locations = await this.detectLocations();
    objects.push(...locations);

    // Detect events
    const events = await this.detectEvents();
    objects.push(...events);

    // Detect products
    const products = await this.detectProducts();
    objects.push(...products);

    // Detect custom structured data patterns
    const customObjects = this.detectCustomObjects();
    objects.push(...customObjects);

    return objects.filter(obj => obj.instances.length >= 2); // Only keep objects with 2+ instances
  }

  /**
   * Detect authors from JSON-LD, meta tags, and content
   * Returns a single generic 'author' type with all instances aggregated
   */
  private async detectAuthors(): Promise<DetectedObject[]> {
    const allAuthorInstances: ContentObjectInstance[] = [];
    const uniqueAuthors = new Set<string>();

    for (const page of this.pages) {
      // Check JSON-LD
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item.author) {
            const authors = Array.isArray(item.author) ? item.author : [item.author];
            for (const author of authors) {
              const name = typeof author === 'string' ? author : author.name;
              if (name) {
                uniqueAuthors.add(name);
                allAuthorInstances.push({
                  pageUrl: page.url,
                  data: typeof author === 'string' ? { name: author } : author,
                  source: 'jsonld',
                });
              }
            }
          }
        }
      }

      // Check meta tags
      const metaAny = page.meta as any;
      const authorMeta = metaAny.author || metaAny['article:author'];
      if (authorMeta) {
        const name = authorMeta;
        uniqueAuthors.add(name);
        allAuthorInstances.push({
          pageUrl: page.url,
          data: { name },
          source: 'meta',
        });
      }
    }

    // Validate instances using AI if available
    const validatedInstances = await this.validateInstances(allAuthorInstances, 'author');

    // Create a single generic 'author' type if we found at least 2 valid instances
    if (validatedInstances.length >= 2) {
      const fields = this.inferFields(validatedInstances);
      const confidence = this.calculateConfidence(validatedInstances.length);

      return [{
        id: 'author',
        type: 'author',
        name: 'author',
        instances: validatedInstances,
        confidence,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(validatedInstances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Found ${validatedInstances.length} author instances (${uniqueAuthors.size} unique) across the site with consistent field structure`,
      }];
    }

    return [];
  }

  /**
   * Detect categories from URLs, JSON-LD, and content
   * Returns a single generic 'category' type with all instances aggregated
   */
  private async detectCategories(): Promise<DetectedObject[]> {
    const allCategoryInstances: ContentObjectInstance[] = [];
    const uniqueCategories = new Set<string>();

    for (const page of this.pages) {
      // Check JSON-LD categories
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          const categories = item.articleSection || item.category || item.genre;
          if (categories) {
            const cats = Array.isArray(categories) ? categories : [categories];
            for (const cat of cats) {
              const name = typeof cat === 'string' ? cat : cat.name;
              if (name) {
                uniqueCategories.add(name);
                allCategoryInstances.push({
                  pageUrl: page.url,
                  data: typeof cat === 'string' ? { name: cat } : cat,
                  source: 'jsonld',
                });
              }
            }
          }
        }
      }

      // Check breadcrumbs for categories
      const breadcrumbLinks = page.links.filter(l => l.context === 'breadcrumb');
      for (const link of breadcrumbLinks) {
        const name = link.text;
        if (name && name !== 'Home') {
          uniqueCategories.add(name);
          allCategoryInstances.push({
            pageUrl: page.url,
            data: { name, url: link.href },
            source: 'content',
          });
        }
      }

      // Check URL patterns for categories (e.g., /category/foo, /blog/foo)
      const categoryPatterns = ['/category/', '/categories/', '/topic/', '/topics/'];
      for (const pattern of categoryPatterns) {
        if (page.url.includes(pattern)) {
          const parts = page.url.split(pattern);
          if (parts.length > 1) {
            const categorySlug = parts[1].split('/')[0];
            const name = categorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            uniqueCategories.add(name);
            allCategoryInstances.push({
              pageUrl: page.url,
              data: { name, slug: categorySlug },
              source: 'structured',
            });
          }
        }
      }
    }

    // Validate instances using AI if available
    const validatedInstances = await this.validateInstances(allCategoryInstances, 'category');

    // Create a single generic 'category' type if we found at least 2 valid instances
    if (validatedInstances.length >= 2) {
      const fields = this.inferFields(validatedInstances);
      const confidence = this.calculateConfidence(validatedInstances.length);

      return [{
        id: 'category',
        type: 'category',
        name: 'category',
        instances: validatedInstances,
        confidence,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(validatedInstances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Found ${validatedInstances.length} category instances (${uniqueCategories.size} unique) across the site with consistent field structure`,
      }];
    }

    return [];
  }

  /**
   * Detect tags from meta keywords and JSON-LD
   * Returns a single generic 'tag' type with all instances aggregated
   */
  private async detectTags(): Promise<DetectedObject[]> {
    const allTagInstances: ContentObjectInstance[] = [];
    const uniqueTags = new Set<string>();

    for (const page of this.pages) {
      // Check JSON-LD keywords
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          const keywords = item.keywords;
          if (keywords) {
            const tags = typeof keywords === 'string' ? keywords.split(',') : keywords;
            for (const tag of tags) {
              const name = tag.trim();
              if (name) {
                uniqueTags.add(name);
                allTagInstances.push({
                  pageUrl: page.url,
                  data: { name },
                  source: 'jsonld',
                });
              }
            }
          }
        }
      }

      // Check meta keywords
      const metaKeywords = page.meta.keywords;
      if (metaKeywords) {
        const tags = metaKeywords.split(',');
        for (const tag of tags) {
          const name = tag.trim();
          if (name) {
            uniqueTags.add(name);
            allTagInstances.push({
              pageUrl: page.url,
              data: { name },
              source: 'meta',
            });
          }
        }
      }
    }

    // Validate instances using AI if available
    const validatedInstances = await this.validateInstances(allTagInstances, 'tag');

    // Create a single generic 'tag' type if we found at least 2 valid instances
    if (validatedInstances.length >= 2) {
      const fields = this.inferFields(validatedInstances);
      const confidence = this.calculateConfidence(validatedInstances.length);

      return [{
        id: 'tag',
        type: 'tag',
        name: 'tag',
        instances: validatedInstances,
        confidence,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(validatedInstances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Found ${validatedInstances.length} tag instances (${uniqueTags.size} unique) across the site with consistent field structure`,
      }];
    }

    return [];
  }

  /**
   * Detect locations from JSON-LD address data
   * Returns a single generic 'location' type with all instances aggregated
   */
  private async detectLocations(): Promise<DetectedObject[]> {
    const allLocationInstances: ContentObjectInstance[] = [];
    const uniqueLocations = new Set<string>();

    for (const page of this.pages) {
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type'] === 'Place' || item['@type'] === 'LocalBusiness' || item.address) {
            const address = item.address || item;
            const name = item.name || 'Unknown Location';

            uniqueLocations.add(name);
            allLocationInstances.push({
              pageUrl: page.url,
              data: address,
              source: 'jsonld',
            });
          }
        }
      }
    }

    // Validate instances using AI if available
    const validatedInstances = await this.validateInstances(allLocationInstances, 'location');

    // Create a single generic 'location' type if we found at least 2 valid instances
    if (validatedInstances.length >= 2) {
      const fields = this.inferFields(validatedInstances);
      const confidence = this.calculateConfidence(validatedInstances.length);

      return [{
        id: 'location',
        type: 'location',
        name: 'location',
        instances: validatedInstances,
        confidence,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(validatedInstances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Found ${validatedInstances.length} location instances (${uniqueLocations.size} unique) across the site with consistent field structure`,
      }];
    }

    return [];
  }

  /**
   * Detect events from JSON-LD
   * Returns a single generic 'event' type with all instances aggregated
   */
  private async detectEvents(): Promise<DetectedObject[]> {
    const allEventInstances: ContentObjectInstance[] = [];
    const uniqueEvents = new Set<string>();

    for (const page of this.pages) {
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type'] === 'Event') {
            const name = item.name || 'Unknown Event';

            uniqueEvents.add(name);
            allEventInstances.push({
              pageUrl: page.url,
              data: item,
              source: 'jsonld',
            });
          }
        }
      }
    }

    // Validate instances using AI if available
    const validatedInstances = await this.validateInstances(allEventInstances, 'event');

    // Create a single generic 'event' type if we found at least 2 valid instances
    if (validatedInstances.length >= 2) {
      const fields = this.inferFields(validatedInstances);
      const confidence = this.calculateConfidence(validatedInstances.length);

      return [{
        id: 'event',
        type: 'event',
        name: 'event',
        instances: validatedInstances,
        confidence,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(validatedInstances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Found ${validatedInstances.length} event instances (${uniqueEvents.size} unique) across the site with consistent field structure`,
      }];
    }

    return [];
  }

  /**
   * Detect products from JSON-LD
   * Returns a single generic 'product' type with all instances aggregated
   */
  private async detectProducts(): Promise<DetectedObject[]> {
    const allProductInstances: ContentObjectInstance[] = [];
    const uniqueProducts = new Set<string>();

    for (const page of this.pages) {
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type'] === 'Product') {
            const name = item.name || 'Unknown Product';

            uniqueProducts.add(name);
            allProductInstances.push({
              pageUrl: page.url,
              data: item,
              source: 'jsonld',
            });
          }
        }
      }
    }

    // Validate instances using AI if available
    const validatedInstances = await this.validateInstances(allProductInstances, 'product');

    // Create a single generic 'product' type if we found at least 2 valid instances
    if (validatedInstances.length >= 2) {
      const fields = this.inferFields(validatedInstances);
      const confidence = this.calculateConfidence(validatedInstances.length);

      return [{
        id: 'product',
        type: 'product',
        name: 'product',
        instances: validatedInstances,
        confidence,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(validatedInstances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Found ${validatedInstances.length} product instances (${uniqueProducts.size} unique) across the site with consistent field structure`,
      }];
    }

    return [];
  }

  /**
   * Detect custom objects from recurring structured data patterns
   */
  private detectCustomObjects(): DetectedObject[] {
    // TODO: Implement pattern detection for custom objects
    // This would analyze JSON-LD and find recurring patterns
    return [];
  }

  /**
   * Infer field structure from object instances
   */
  private inferFields(instances: ContentObjectInstance[]): ObjectField[] {
    const fieldMap = new Map<string, {
      type: Set<string>;
      required: number;
      examples: any[];
      nestedInstances?: any[]; // For analyzing nested objects/arrays
    }>();

    for (const instance of instances) {
      for (const [key, value] of Object.entries(instance.data)) {
        // Sanitize field name to make it valid for Sanity
        const sanitizedKey = this.sanitizeFieldName(key);

        if (!fieldMap.has(sanitizedKey)) {
          fieldMap.set(sanitizedKey, { type: new Set(), required: 0, examples: [], nestedInstances: [] });
        }

        const field = fieldMap.get(sanitizedKey)!;
        field.required++;
        field.type.add(this.inferType(value));

        if (field.examples.length < 3) {
          field.examples.push(value);
        }

        // Store nested values for later analysis
        if (value !== null && value !== undefined) {
          field.nestedInstances!.push(value);
        }
      }
    }

    const fields: ObjectField[] = [];
    for (const [name, data] of fieldMap.entries()) {
      const baseType = this.consolidateTypes(Array.from(data.type));
      const field: ObjectField = {
        name,
        type: baseType,
        required: data.required >= instances.length * 0.8, // 80% threshold
        examples: data.examples,
      };

      // Handle nested objects
      if (baseType === 'object' && data.nestedInstances && data.nestedInstances.length > 0) {
        const objectInstances = data.nestedInstances
          .filter(v => v && typeof v === 'object' && !Array.isArray(v))
          .map(v => ({ pageUrl: '', data: v, source: 'content' as const }));

        if (objectInstances.length > 0) {
          field.fields = this.inferFields(objectInstances);
        }
      }

      // Handle arrays
      if (baseType === 'array' && data.nestedInstances && data.nestedInstances.length > 0) {
        const arrayInstances = data.nestedInstances.filter(v => Array.isArray(v));
        if (arrayInstances.length > 0) {
          // Analyze first non-empty array to determine item type
          const firstArray = arrayInstances.find(arr => arr.length > 0);
          if (firstArray && firstArray.length > 0) {
            const firstItem = firstArray[0];
            const itemType = this.inferType(firstItem);

            if (itemType === 'object' && typeof firstItem === 'object' && firstItem !== null) {
              // Array of objects - infer nested structure
              const allItems = arrayInstances.flatMap(arr => arr);
              const itemInstances = allItems
                .filter(item => item && typeof item === 'object')
                .map(item => ({ pageUrl: '', data: item, source: 'content' as const }));

              if (itemInstances.length > 0) {
                field.of = [{
                  type: 'object',
                  fields: this.inferFields(itemInstances)
                }];
              }
            } else {
              // Array of primitives
              field.of = [{ type: itemType }];
            }
          }
        }
      }

      fields.push(field);
    }

    return fields;
  }

  /**
   * Infer TypeScript/Sanity type from value
   */
  private inferType(value: any): string {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'datetime';
      if (value.match(/^https?:\/\//)) return 'url';
      return 'string';
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  /**
   * Consolidate multiple types into a single type
   */
  private consolidateTypes(types: string[]): string {
    if (types.length === 1) return types[0];
    if (types.includes('string')) return 'string'; // Default to string if mixed
    return types[0];
  }

  /**
   * Get simplified page URL for grouping
   */
  private getPageUrl(url: string): string {
    return url;
  }

  /**
   * Sanitize field name to be valid for Sanity
   * Field names must match /^[a-zA-Z_][a-zA-Z0-9_]*$/
   */
  private sanitizeFieldName(name: string): string {
    // Handle common JSON-LD properties
    if (name.startsWith('@')) {
      name = name.slice(1); // @type → type, @context → context
    }

    // Transliterate non-ASCII characters
    const charMap: Record<string, string> = {
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
      'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i',
      'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o',
      'ö': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ý': 'y',
      'ÿ': 'y', 'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
    };

    let result = name;
    for (const [char, replacement] of Object.entries(charMap)) {
      result = result.replace(new RegExp(char, 'g'), replacement);
    }

    // Remove any characters that aren't alphanumeric or underscore
    result = result.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure it starts with a letter or underscore
    if (/^[0-9]/.test(result)) {
      result = '_' + result;
    }

    // If empty after sanitization, use a default
    if (!result) {
      result = 'field';
    }

    return result;
  }

  /**
   * Validate instances using AI if available
   * Only uses AI if pre-AI confidence is below threshold (0.8)
   */
  private async validateInstances(
    instances: ContentObjectInstance[],
    typeName: string
  ): Promise<ContentObjectInstance[]> {
    if (!this.aiAnalyzer || instances.length < 2) {
      return instances;
    }

    // Calculate pre-AI confidence score
    const preAIConfidence = this.calculatePreAIConfidence(instances);

    // Skip AI validation if pre-AI confidence is high (>= 0.8)
    const AI_CONFIDENCE_THRESHOLD = 0.8;
    if (preAIConfidence >= AI_CONFIDENCE_THRESHOLD) {
      logger.info(
        `Skipping AI validation for ${typeName}: high pre-AI confidence (${preAIConfidence.toFixed(2)})`
      );
      return instances;
    }

    // Use AI validation for low-confidence cases
    logger.info(
      `Pre-AI confidence for ${typeName}: ${preAIConfidence.toFixed(2)} - using AI validation`
    );

    try {
      logger.debug(`Validating ${instances.length} instances of ${typeName} using AI...`);
      const result = await this.aiAnalyzer.validateInstanceSimilarity(instances, typeName);

      if (result.outliers.length > 0) {
        logger.info(
          `AI validation for ${typeName}: removed ${result.outliers.length} outlier(s) (confidence: ${result.confidence})`
        );
        logger.debug(`Reasoning: ${result.reasoning}`);
      }

      return result.validInstances;
    } catch (error) {
      logger.warn(`AI validation failed for ${typeName}: ${(error as Error).message}`);
      return instances; // Fail open
    }
  }

  /**
   * Calculate confidence score based on instance count
   */
  private calculateConfidence(instanceCount: number): number {
    if (instanceCount >= 10) return 0.95;
    if (instanceCount >= 5) return 0.85;
    if (instanceCount >= 2) return 0.7;
    return 0.5;
  }

  /**
   * Calculate pre-AI confidence score based on structural analysis
   * Determines whether expensive AI validation is needed
   */
  private calculatePreAIConfidence(instances: ContentObjectInstance[]): number {
    if (instances.length === 0) return 0;
    if (instances.length === 1) return 1.0; // Single instance is inherently consistent

    let score = 1.0; // Start at perfect confidence

    // Factor 1: Source consistency (weight: 0.15)
    const sources = new Set(instances.map(i => i.source));
    if (sources.size > 1) {
      // Multiple sources reduce confidence
      const sourceConsistency = 1 - ((sources.size - 1) * 0.15);
      score *= Math.max(0.5, sourceConsistency); // Penalty up to 50%
    }

    // Factor 2: Field structure consistency (weight: 0.30)
    const fieldSets = instances.map(i => new Set(Object.keys(i.data)));

    // Calculate Jaccard similarity between each pair of instances
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < fieldSets.length; i++) {
      for (let j = i + 1; j < fieldSets.length; j++) {
        const intersection = new Set(
          Array.from(fieldSets[i]).filter(x => fieldSets[j].has(x))
        );
        const union = new Set([...fieldSets[i], ...fieldSets[j]]);
        totalSimilarity += intersection.size / union.size;
        comparisons++;
      }
    }

    const avgFieldSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1.0;
    score *= avgFieldSimilarity;

    // Factor 3: Field count variance (weight: 0.20)
    const fieldCounts = instances.map(i => Object.keys(i.data).length);
    const avgFieldCount = fieldCounts.reduce((a, b) => a + b, 0) / fieldCounts.length;
    const variance = fieldCounts.reduce((sum, count) =>
      sum + Math.pow(count - avgFieldCount, 2), 0) / fieldCounts.length;
    const stddev = Math.sqrt(variance);
    const coefficientOfVariation = avgFieldCount > 0 ? stddev / avgFieldCount : 0;

    // High variance (CV > 0.5) significantly reduces confidence
    const variancePenalty = Math.max(0, 1 - (coefficientOfVariation * 0.5));
    score *= variancePenalty;

    // Factor 4: Instance count bonus (weight: 0.15)
    if (instances.length >= 10) {
      score *= 1.05; // 5% bonus for high sample size
    } else if (instances.length < 5) {
      score *= 0.9; // 10% penalty for low sample size
    }

    // Factor 5: Data type consistency (weight: 0.20)
    const typeConsistency = this.checkTypeConsistency(instances);
    score *= typeConsistency;

    return Math.max(0, Math.min(1.0, score));
  }

  /**
   * Check type consistency across instances
   * Returns ratio of fields with consistent types to total fields
   */
  private checkTypeConsistency(instances: ContentObjectInstance[]): number {
    const fieldTypes = new Map<string, Set<string>>();

    for (const instance of instances) {
      for (const [key, value] of Object.entries(instance.data)) {
        if (!fieldTypes.has(key)) {
          fieldTypes.set(key, new Set());
        }
        fieldTypes.get(key)!.add(this.inferType(value));
      }
    }

    // Calculate percentage of fields with consistent types
    let consistentFields = 0;
    let totalFields = 0;

    for (const types of fieldTypes.values()) {
      totalFields++;
      if (types.size === 1) {
        consistentFields++;
      }
    }

    return totalFields > 0 ? consistentFields / totalFields : 1.0;
  }

  /**
   * Slugify a string
   */
  private slugify(str: string): string {
    // Transliteration map for common non-ASCII characters
    const charMap: Record<string, string> = {
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
      'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i',
      'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o',
      'ö': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ý': 'y',
      'ÿ': 'y', 'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
    };

    // Transliterate non-ASCII characters
    let result = str.toLowerCase();
    for (const [char, replacement] of Object.entries(charMap)) {
      result = result.replace(new RegExp(char, 'g'), replacement);
    }

    // Remove any remaining non-ASCII and special characters
    return result
      .replace(/[^a-z0-9\s-]/g, '')  // Only allow a-z, 0-9, spaces, and hyphens
      .replace(/[\s_-]+/g, '-')      // Replace spaces/underscores with hyphens
      .replace(/^-+|-+$/g, '');      // Trim hyphens from start/end
  }
}
