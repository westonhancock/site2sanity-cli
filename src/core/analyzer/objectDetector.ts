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

export class ObjectDetector {
  private pages: Page[];

  constructor(pages: Page[]) {
    this.pages = pages;
  }

  /**
   * Detect all reusable objects across the site
   */
  detectObjects(): DetectedObject[] {
    const objects: DetectedObject[] = [];

    // Detect authors
    const authors = this.detectAuthors();
    objects.push(...authors);

    // Detect categories/tags from various sources
    const categories = this.detectCategories();
    objects.push(...categories);

    const tags = this.detectTags();
    objects.push(...tags);

    // Detect locations (addresses, places)
    const locations = this.detectLocations();
    objects.push(...locations);

    // Detect events
    const events = this.detectEvents();
    objects.push(...events);

    // Detect products
    const products = this.detectProducts();
    objects.push(...products);

    // Detect custom structured data patterns
    const customObjects = this.detectCustomObjects();
    objects.push(...customObjects);

    return objects.filter(obj => obj.instances.length >= 2); // Only keep objects with 2+ instances
  }

  /**
   * Detect authors from JSON-LD, meta tags, and content
   */
  private detectAuthors(): DetectedObject[] {
    const authorMap = new Map<string, ContentObjectInstance[]>();

    for (const page of this.pages) {
      // Check JSON-LD
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item.author) {
            const authors = Array.isArray(item.author) ? item.author : [item.author];
            for (const author of authors) {
              const name = typeof author === 'string' ? author : author.name;
              if (name) {
                if (!authorMap.has(name)) {
                  authorMap.set(name, []);
                }
                authorMap.get(name)!.push({
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
        if (!authorMap.has(name)) {
          authorMap.set(name, []);
        }
        authorMap.get(name)!.push({
          pageUrl: page.url,
          data: { name },
          source: 'meta',
        });
      }
    }

    const result: DetectedObject[] = [];
    for (const [name, instances] of authorMap.entries()) {
      if (instances.length >= 1) {
        // Determine fields from instances
        const fields = this.inferFields(instances);

        result.push({
          id: `author-${this.slugify(name)}`,
          type: 'author',
          name,
          instances,
          confidence: instances.length > 3 ? 0.9 : 0.7,
          suggestedFields: fields,
          pageTypeRefs: [...new Set(instances.map(i => this.getPageUrl(i.pageUrl)))],
          rationale: `Found ${instances.length} references to this author across the site`,
        });
      }
    }

    return result;
  }

  /**
   * Detect categories from URLs, JSON-LD, and content
   */
  private detectCategories(): DetectedObject[] {
    const categoryMap = new Map<string, ContentObjectInstance[]>();

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
                if (!categoryMap.has(name)) {
                  categoryMap.set(name, []);
                }
                categoryMap.get(name)!.push({
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
          if (!categoryMap.has(name)) {
            categoryMap.set(name, []);
          }
          categoryMap.get(name)!.push({
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
            if (!categoryMap.has(name)) {
              categoryMap.set(name, []);
            }
            categoryMap.get(name)!.push({
              pageUrl: page.url,
              data: { name, slug: categorySlug },
              source: 'structured',
            });
          }
        }
      }
    }

    const result: DetectedObject[] = [];
    for (const [name, instances] of categoryMap.entries()) {
      if (instances.length >= 2) {
        const fields = this.inferFields(instances);

        result.push({
          id: `category-${this.slugify(name)}`,
          type: 'category',
          name,
          instances,
          confidence: instances.length > 5 ? 0.9 : 0.7,
          suggestedFields: fields,
          pageTypeRefs: [...new Set(instances.map(i => this.getPageUrl(i.pageUrl)))],
          rationale: `Found ${instances.length} pages in this category`,
        });
      }
    }

    return result;
  }

  /**
   * Detect tags from meta keywords and JSON-LD
   */
  private detectTags(): DetectedObject[] {
    const tagMap = new Map<string, ContentObjectInstance[]>();

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
                if (!tagMap.has(name)) {
                  tagMap.set(name, []);
                }
                tagMap.get(name)!.push({
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
            if (!tagMap.has(name)) {
              tagMap.set(name, []);
            }
            tagMap.get(name)!.push({
              pageUrl: page.url,
              data: { name },
              source: 'meta',
            });
          }
        }
      }
    }

    const result: DetectedObject[] = [];
    for (const [name, instances] of tagMap.entries()) {
      if (instances.length >= 3) {
        const fields = this.inferFields(instances);

        result.push({
          id: `tag-${this.slugify(name)}`,
          type: 'tag',
          name,
          instances,
          confidence: instances.length > 5 ? 0.8 : 0.6,
          suggestedFields: fields,
          pageTypeRefs: [...new Set(instances.map(i => this.getPageUrl(i.pageUrl)))],
          rationale: `Found ${instances.length} pages with this tag`,
        });
      }
    }

    return result;
  }

  /**
   * Detect locations from JSON-LD address data
   */
  private detectLocations(): DetectedObject[] {
    const locationMap = new Map<string, ContentObjectInstance[]>();

    for (const page of this.pages) {
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type'] === 'Place' || item['@type'] === 'LocalBusiness' || item.address) {
            const address = item.address || item;
            const name = item.name || 'Unknown Location';

            if (!locationMap.has(name)) {
              locationMap.set(name, []);
            }
            locationMap.get(name)!.push({
              pageUrl: page.url,
              data: address,
              source: 'jsonld',
            });
          }
        }
      }
    }

    const result: DetectedObject[] = [];
    for (const [name, instances] of locationMap.entries()) {
      if (instances.length >= 1) {
        const fields = this.inferFields(instances);

        result.push({
          id: `location-${this.slugify(name)}`,
          type: 'location',
          name,
          instances,
          confidence: 0.8,
          suggestedFields: fields,
          pageTypeRefs: [...new Set(instances.map(i => this.getPageUrl(i.pageUrl)))],
          rationale: `Found location data on ${instances.length} page(s)`,
        });
      }
    }

    return result;
  }

  /**
   * Detect events from JSON-LD
   */
  private detectEvents(): DetectedObject[] {
    const eventMap = new Map<string, ContentObjectInstance[]>();

    for (const page of this.pages) {
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type'] === 'Event') {
            const name = item.name || 'Unknown Event';

            if (!eventMap.has(name)) {
              eventMap.set(name, []);
            }
            eventMap.get(name)!.push({
              pageUrl: page.url,
              data: item,
              source: 'jsonld',
            });
          }
        }
      }
    }

    const result: DetectedObject[] = [];
    for (const [name, instances] of eventMap.entries()) {
      const fields = this.inferFields(instances);

      result.push({
        id: `event-${this.slugify(name)}`,
        type: 'event',
        name,
        instances,
        confidence: 0.9,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(instances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Event found with structured data`,
      });
    }

    return result;
  }

  /**
   * Detect products from JSON-LD
   */
  private detectProducts(): DetectedObject[] {
    const productMap = new Map<string, ContentObjectInstance[]>();

    for (const page of this.pages) {
      if (page.jsonLd) {
        for (const item of page.jsonLd) {
          if (item['@type'] === 'Product') {
            const name = item.name || 'Unknown Product';

            if (!productMap.has(name)) {
              productMap.set(name, []);
            }
            productMap.get(name)!.push({
              pageUrl: page.url,
              data: item,
              source: 'jsonld',
            });
          }
        }
      }
    }

    const result: DetectedObject[] = [];
    for (const [name, instances] of productMap.entries()) {
      const fields = this.inferFields(instances);

      result.push({
        id: `product-${this.slugify(name)}`,
        type: 'product',
        name,
        instances,
        confidence: 0.9,
        suggestedFields: fields,
        pageTypeRefs: [...new Set(instances.map(i => this.getPageUrl(i.pageUrl)))],
        rationale: `Product found with structured data`,
      });
    }

    return result;
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
