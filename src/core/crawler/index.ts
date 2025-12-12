/**
 * Web crawler engine
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import puppeteer, { Browser, Page as PuppeteerPage } from 'puppeteer';
import { CrawlConfig, Page, PageMeta, Heading, Link } from '../../types';
import { normalizeUrl, isSameOrigin, urlToId, generateContentHash, getUrlDepth } from '../../utils/url';
import { CrawlDatabase } from '../../utils/database';
import PQueue from 'p-queue';
import { logger } from '../../utils/logger';

export class Crawler {
  private config: CrawlConfig;
  private baseUrl: string;
  private db: CrawlDatabase;
  private queue: PQueue;
  private visited: Set<string>;
  private toVisit: Array<{ url: string; depth: number }>;
  private browser: Browser | null = null;

  constructor(baseUrl: string, config: CrawlConfig, db: CrawlDatabase) {
    this.baseUrl = normalizeUrl(baseUrl);
    this.config = config;
    this.db = db;
    this.queue = new PQueue({ concurrency: config.concurrency });
    this.visited = new Set();
    this.toVisit = [];
  }

  /**
   * Start crawling
   */
  async crawl(): Promise<void> {
    logger.info(`Starting crawl of ${this.baseUrl}`);
    logger.info(`Max pages: ${this.config.maxPages}, Max depth: ${this.config.maxDepth}`);

    try {
      if (this.config.render) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
          ],
        });
        logger.info('Launched headless browser for rendered crawling');
      }

      // Add base URL to queue
      this.toVisit.push({ url: this.baseUrl, depth: 0 });

      let crawled = 0;
      const startTime = Date.now();

      while (this.toVisit.length > 0 && crawled < this.config.maxPages) {
        const batch = this.toVisit.splice(0, this.config.concurrency);

        await Promise.allSettled(
          batch.map(({ url, depth }) =>
            this.queue.add(() => this.crawlPage(url, depth))
          )
        );

        crawled = this.visited.size;
        logger.updateSpinner(`Crawled ${crawled} pages (${this.toVisit.length} in queue)`);

        // Throttle
        if (this.config.throttle > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.throttle));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.succeedSpinner(`Crawled ${crawled} pages in ${duration}s`);
    } catch (error) {
      logger.failSpinner(`Crawl failed: ${(error as Error).message}`);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Crawl specific pages with browser and take full-page screenshots
   * Used after initial HTML crawl to capture visual layout for AI analysis
   */
  async crawlWithScreenshots(urls: string[]): Promise<void> {
    if (urls.length === 0) {
      logger.info('No URLs to screenshot');
      return;
    }

    logger.info(`Taking full-page screenshots of ${urls.length} representative pages`);

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
        ],
      });

      let captured = 0;
      for (const url of urls) {
        try {
          const normalizedUrl = normalizeUrl(url);
          const page = await this.crawlRendered(normalizedUrl, true); // Force full-page screenshot
          this.db.savePage(page);
          captured++;
          logger.info(`Captured screenshot ${captured}/${urls.length}: ${url}`);
        } catch (error) {
          logger.warn(`Failed to screenshot ${url}: ${(error as Error).message}`);
        }
      }

      logger.success(`Captured ${captured} screenshots`);
    } catch (error) {
      logger.error(`Screenshot capture failed: ${(error as Error).message}`);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(url: string, depth: number): Promise<void> {
    const normalizedUrl = normalizeUrl(url);

    // Skip if already visited or exceeds depth
    if (this.visited.has(normalizedUrl) || depth > this.config.maxDepth) {
      return;
    }

    // Skip if matches exclude patterns
    if (this.shouldExclude(normalizedUrl)) {
      return;
    }

    this.visited.add(normalizedUrl);

    // Retry logic for transient errors
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const page: Page = this.config.render
          ? await this.crawlRendered(normalizedUrl)
          : await this.crawlHTML(normalizedUrl);

        // Save to database
        this.db.savePage(page);

        // Extract and queue links
        if (depth < this.config.maxDepth) {
          const newLinks = page.links
            .filter(link => isSameOrigin(link.href, this.baseUrl, this.config.followSubdomains))
            .filter(link => !this.visited.has(normalizeUrl(link.href)))
            .filter(link => !this.shouldExclude(normalizeUrl(link.href)));

          for (const link of newLinks) {
            const normalizedLink = normalizeUrl(link.href);
            if (!this.toVisit.some(item => item.url === normalizedLink)) {
              this.toVisit.push({ url: normalizedLink, depth: depth + 1 });
            }
          }
        }

        // Success - break out of retry loop
        return;
      } catch (error) {
        lastError = error as Error;
        const isRetryable = this.isRetryableError(error as Error);

        if (isRetryable && attempt < maxRetries) {
          const backoff = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
          logger.debug(`Retry ${attempt}/${maxRetries} for ${normalizedUrl} after ${backoff}ms`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        } else {
          break;
        }
      }
    }

    if (lastError) {
      logger.debug(`Failed to crawl ${normalizedUrl} after ${maxRetries} attempts: ${lastError.message}`);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'socket hang up',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'Network request failed',
      'AbortError',
    ];

    return retryableMessages.some(msg =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  /**
   * Crawl using HTML fetch
   */
  private async crawlHTML(url: string): Promise<Page> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent || 'Mozilla/5.0 (compatible; site2sanity-bot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      const html = await response.text();
      const $ = cheerio.load(html);

      return this.extractPageData(url, $, response.status);
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Crawl using headless browser
   */
  private async crawlRendered(url: string, forceFullPage: boolean = false): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();

    // Set timeout and user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setDefaultNavigationTimeout(30000);

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded', // Changed from networkidle0 for better reliability
        timeout: 30000,
      });

      const html = await page.content();
      const $ = cheerio.load(html);

      const pageData = this.extractPageData(url, $, response?.status() || 200);

      // Screenshot if configured or forced
      if (forceFullPage || this.config.screenshot !== 'none') {
        const screenshotPath = `screenshot-${urlToId(url)}.png`;
        const takeFullPage = forceFullPage || this.config.screenshot === 'fullPage';
        await page.screenshot({
          path: screenshotPath,
          fullPage: takeFullPage,
        });
        pageData.screenshot = screenshotPath;
      }

      return pageData;
    } finally {
      await page.close();
    }
  }

  /**
   * Extract page data from HTML
   */
  private extractPageData(url: string, $: cheerio.CheerioAPI, status: number): Page {
    const title = $('title').text().trim() || $('h1').first().text().trim();

    const meta: PageMeta = {
      description: $('meta[name="description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content'),
      ogTitle: $('meta[property="og:title"]').attr('content'),
      ogDescription: $('meta[property="og:description"]').attr('content'),
      ogImage: $('meta[property="og:image"]').attr('content'),
      ogType: $('meta[property="og:type"]').attr('content'),
    };

    const headings: Heading[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
      const $elem = $(elem);
      headings.push({
        level: parseInt(elem.tagName.substring(1)),
        text: $elem.text().trim(),
        id: $elem.attr('id'),
      });
    });

    const links: Link[] = [];
    $('a[href]').each((_, elem) => {
      const $elem = $(elem);
      const href = $elem.attr('href');
      if (!href) return;

      let context: Link['context'] = 'main';
      const $closest = $elem.closest('header, nav, footer, aside, [role="navigation"]');
      if ($closest.length) {
        const tag = $closest.prop('tagName')?.toLowerCase();
        if (tag === 'header' || $closest.attr('role') === 'navigation') {
          context = 'nav';
        } else if (tag === 'footer') {
          context = 'footer';
        } else if (tag === 'aside') {
          context = 'aside';
        }
      }

      // Check if in breadcrumb
      if ($elem.closest('[class*="breadcrumb"], [aria-label*="breadcrumb"]').length) {
        context = 'breadcrumb';
      }

      try {
        const absoluteUrl = new URL(href, url).href;
        links.push({
          href: absoluteUrl,
          text: $elem.text().trim(),
          context,
          rel: $elem.attr('rel'),
          title: $elem.attr('title'),
        });
      } catch {
        // Skip invalid URLs
      }
    });

    // Extract main content
    const mainContent = this.extractMainContent($);

    // Extract JSON-LD
    const jsonLd: any[] = [];
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const data = JSON.parse($(elem).html() || '');
        jsonLd.push(data);
      } catch {
        // Skip invalid JSON-LD
      }
    });

    return {
      id: urlToId(url),
      url,
      canonical: $('link[rel="canonical"]').attr('href') || url,
      status,
      title,
      meta,
      headings,
      lang: $('html').attr('lang'),
      jsonLd: jsonLd.length > 0 ? jsonLd : undefined,
      links,
      mainContent,
      contentHash: generateContentHash(mainContent || ''),
      crawledAt: new Date(),
    };
  }

  /**
   * Extract main content from page
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Try to find main content area
    const candidates = [
      $('main').first(),
      $('[role="main"]').first(),
      $('article').first(),
      $('#content').first(),
      $('.content').first(),
      $('body'),
    ];

    for (const $elem of candidates) {
      if ($elem.length) {
        // Remove script, style, nav, header, footer
        $elem.find('script, style, nav, header, footer, aside').remove();
        const text = $elem.text().trim();
        if (text.length > 100) {
          return text;
        }
      }
    }

    return '';
  }

  /**
   * Check if URL should be excluded
   */
  private shouldExclude(url: string): boolean {
    // Check exclude patterns
    if (this.config.exclude && this.config.exclude.length > 0) {
      for (const pattern of this.config.exclude) {
        if (url.includes(pattern)) {
          return true;
        }
      }
    }

    // Check include patterns (if specified, URL must match)
    if (this.config.include && this.config.include.length > 0) {
      let matches = false;
      for (const pattern of this.config.include) {
        if (url.includes(pattern)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        return true;
      }
    }

    // Skip common non-HTML extensions
    const skipExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.xml', '.zip'];
    for (const ext of skipExtensions) {
      if (url.toLowerCase().endsWith(ext)) {
        return true;
      }
    }

    return false;
  }
}
