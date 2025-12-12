/**
 * AI-Powered Analyzer - Uses Claude to enhance schema detection
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import {
  Page,
  PageType,
  DetectedObject,
  AIConfig,
} from '../../types';
import { logger } from '../../utils/logger';

export interface AIAnalysisResult {
  enhancedPageTypes: Array<{
    pageTypeId: string;
    suggestedName: string;
    description: string;
    suggestedFields: Array<{
      name: string;
      type: string;
      description: string;
      required: boolean;
    }>;
  }>;
  detectedBlocks: Array<{
    name: string;
    type: 'block';
    description: string;
    occurrences: number;
    fields: Array<{
      name: string;
      type: string;
      description: string;
    }>;
  }>;
  enhancedObjects: Array<{
    objectId?: string;
    name: string;
    type: 'author' | 'category' | 'tag' | 'location' | 'custom';
    description: string;
    suggestedFields: Array<{
      name: string;
      type: string;
      description: string;
      required: boolean;
    }>;
    instances: number;
  }>;
}

export class AIAnalyzer {
  private client: Anthropic;
  private config: AIConfig;

  constructor(config: AIConfig) {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required for AI analysis');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.config = config;
  }

  /**
   * Analyze pages and page types using AI
   */
  async analyzeSite(
    pages: Page[],
    pageTypes: PageType[],
    workspacePath?: string
  ): Promise<AIAnalysisResult> {
    logger.info('Starting AI-powered analysis...');

    // Limit pages to analyze to control costs
    const samplesToAnalyze = this.selectRepresentativePages(
      pages,
      pageTypes,
      this.config.maxPagesPerAnalysis
    );

    logger.info(`Analyzing ${samplesToAnalyze.length} representative pages with AI`);

    try {
      const prompt = this.buildAnalysisPrompt(samplesToAnalyze, pageTypes);

      // Build message content with optional screenshots
      const content: Array<any> = [];

      // Add text prompt
      content.push({
        type: 'text',
        text: prompt,
      });

      // Add screenshots if vision is enabled and workspace path is provided
      if (this.config.useVision && workspacePath) {
        logger.info('Including screenshots for visual analysis');
        const screenshots = this.loadScreenshots(samplesToAnalyze, workspacePath);

        for (const screenshot of screenshots) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshot.data,
            },
          });
        }

        logger.info(`Included ${screenshots.length} screenshots in analysis`);
      }

      const message = await this.client.messages.create({
        model: this.config.model || 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      return this.parseAIResponse(responseText);
    } catch (error) {
      const err = error as any;
      logger.error(`AI analysis failed: ${err.message}`);
      if (err.status) {
        logger.error(`Status: ${err.status}`);
      }
      if (err.error?.message) {
        logger.error(`Details: ${err.error.message}`);
      }
      throw error;
    }
  }

  /**
   * Select representative pages for each page type
   */
  private selectRepresentativePages(
    pages: Page[],
    pageTypes: PageType[],
    maxPages: number
  ): Page[] {
    const selected: Page[] = [];
    const pagesPerType = Math.max(1, Math.floor(maxPages / pageTypes.length));

    for (const pageType of pageTypes) {
      const typePages = pages.filter(p =>
        pageType.examples.includes(p.url)
      );

      // Take up to pagesPerType from this type
      selected.push(...typePages.slice(0, pagesPerType));

      if (selected.length >= maxPages) break;
    }

    return selected.slice(0, maxPages);
  }

  /**
   * Load screenshots for pages
   */
  private loadScreenshots(
    pages: Page[],
    workspacePath: string
  ): Array<{ url: string; data: string }> {
    const screenshots: Array<{ url: string; data: string }> = [];

    for (const page of pages) {
      if (page.screenshot) {
        try {
          const screenshotPath = path.join(workspacePath, page.screenshot);

          if (fs.existsSync(screenshotPath)) {
            const imageBuffer = fs.readFileSync(screenshotPath);
            const base64Data = imageBuffer.toString('base64');

            screenshots.push({
              url: page.url,
              data: base64Data,
            });
          } else {
            logger.debug(`Screenshot not found: ${screenshotPath}`);
          }
        } catch (error) {
          logger.debug(`Failed to load screenshot for ${page.url}: ${(error as Error).message}`);
        }
      }
    }

    return screenshots;
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(pages: Page[], pageTypes: PageType[]): string {
    const pagesData = pages.map(p => ({
      url: p.url,
      title: p.title,
      headings: p.headings.map(h => ({ level: h.level, text: h.text })),
      mainContent: p.mainContent?.substring(0, 1000), // Limit content length
      jsonLd: p.jsonLd,
      meta: p.meta,
      hasScreenshot: !!p.screenshot,
    }));

    const pageTypesData = pageTypes.map(pt => ({
      id: pt.id,
      name: pt.name,
      pageCount: pt.pageCount,
      urlPattern: pt.urlPattern,
      examples: pt.examples.slice(0, 3),
    }));

    const hasScreenshots = pages.some(p => p.screenshot);
    const visionInstructions = hasScreenshots ? `

**IMPORTANT**: Screenshots of the pages are included with this analysis. Use these screenshots to:
- Visually identify UI blocks and patterns (hero sections, CTAs, testimonials, feature grids, card layouts, forms, etc.)
- Detect visual layout patterns that may not be obvious from HTML/text alone
- Identify image-heavy sections that should be represented as blocks
- Spot recurring visual components across different pages
- Better understand the visual hierarchy and content structure

When detecting blocks, pay special attention to:
- Hero sections (large heading + text + CTA at top of page)
- Call-to-action sections (prominent buttons/links)
- Feature grids (multiple items in grid/column layout)
- Testimonials (quotes with author info)
- Logo clouds/partner sections
- Image galleries or media sections
- Stats/metrics displays
- Team member cards
- Pricing tables
` : '';

    return `You are analyzing a website to generate a Sanity CMS schema. Your task is to:

1. **Enhance Page Type Detection**: Review the detected page types and suggest better names, descriptions, and field structures.

2. **Detect Reusable Blocks**: Identify repeating content patterns across pages (hero sections, CTAs, testimonials, feature grids, etc.) that should be Sanity blocks.${visionInstructions}

3. **Detect Content Objects**: Find reusable content objects (authors, categories, tags, locations, etc.) that should be references in Sanity.

# Page Types Detected:
${JSON.stringify(pageTypesData, null, 2)}

# Sample Pages:
${JSON.stringify(pagesData, null, 2)}

Please analyze this data and respond with a JSON object in this exact format:

\`\`\`json
{
  "enhancedPageTypes": [
    {
      "pageTypeId": "type-1",
      "suggestedName": "blogPost",
      "description": "Individual blog post pages with article content",
      "suggestedFields": [
        {
          "name": "title",
          "type": "string",
          "description": "Post title",
          "required": true
        },
        {
          "name": "publishedAt",
          "type": "datetime",
          "description": "Publication date",
          "required": true
        },
        {
          "name": "author",
          "type": "reference",
          "description": "Post author reference",
          "required": false
        }
      ]
    }
  ],
  "detectedBlocks": [
    {
      "name": "hero",
      "type": "block",
      "description": "Hero section with heading, text, and CTA",
      "occurrences": 5,
      "fields": [
        {
          "name": "heading",
          "type": "string",
          "description": "Hero heading text"
        },
        {
          "name": "subheading",
          "type": "text",
          "description": "Hero subheading"
        },
        {
          "name": "ctaText",
          "type": "string",
          "description": "CTA button text"
        },
        {
          "name": "ctaLink",
          "type": "url",
          "description": "CTA button link"
        }
      ]
    }
  ],
  "enhancedObjects": [
    {
      "name": "author",
      "type": "author",
      "description": "Blog post author",
      "suggestedFields": [
        {
          "name": "name",
          "type": "string",
          "description": "Author full name",
          "required": true
        },
        {
          "name": "bio",
          "type": "text",
          "description": "Author biography",
          "required": false
        },
        {
          "name": "avatar",
          "type": "image",
          "description": "Author profile photo",
          "required": false
        }
      ],
      "instances": 3
    }
  ]
}
\`\`\`

Focus on:
- Sanity-appropriate field types (string, text, number, boolean, datetime, url, image, array, object, reference)
- Identifying which fields should be references vs embedded
- Finding repeating UI patterns that should be blocks
- Practical, descriptive field names
- Accurate field descriptions

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Parse AI response into structured result
   */
  private parseAIResponse(responseText: string): AIAnalysisResult {
    try {
      // Extract JSON from code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                       responseText.match(/```\n([\s\S]*?)\n```/);

      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      const parsed = JSON.parse(jsonText);

      return {
        enhancedPageTypes: parsed.enhancedPageTypes || [],
        detectedBlocks: parsed.detectedBlocks || [],
        enhancedObjects: parsed.enhancedObjects || [],
      };
    } catch (error) {
      logger.error('Failed to parse AI response');
      logger.debug(responseText);
      throw new Error('AI returned invalid JSON response');
    }
  }
}
