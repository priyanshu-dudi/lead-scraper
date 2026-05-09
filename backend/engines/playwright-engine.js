// ============================================================
// LeadForge Ultimate — Playwright Browser Automation Engine
// ============================================================
import { chromium, firefox } from 'playwright';
import { logger } from '../utils/logger.js';
import { UserAgentRotator } from '../utils/user-agents.js';

const uaRotator = new UserAgentRotator();

export class PlaywrightEngine {
  constructor() {
    this.browser = null;
    this.context = null;
    this.browserType = 'chromium';
  }

  // ── Initialize browser ────────────────────────────────────────
  async init() {
    if (this.browser) return true;
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
          '--disable-web-security',
        ],
      });
      logger.info('Playwright browser initialized');
      return true;
    } catch (err) {
      logger.warn(`Playwright unavailable (run "npx playwright install chromium"): ${err.message.split('\n')[0]}`);
      return false;
    }
  }

  // ── Create stealth context ────────────────────────────────────
  async createContext(userAgent) {
    if (!this.browser) await this.init();

    const ua = userAgent || uaRotator.next();
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
    ];
    const viewport = viewports[Math.floor(Math.random() * viewports.length)];

    const context = await this.browser.newContext({
      userAgent: ua,
      viewport,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
    });

    // Stealth scripts
    await context.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // Fake plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      // Fake languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });

    return context;
  }

  // ── Scrape a URL ──────────────────────────────────────────────
  async scrape(url, options = {}) {
    let context = null;
    let page = null;

    try {
      const ready = await this.init();
      if (!ready) return null; // browser not installed, caller falls back to httpx
      context = await this.createContext(options.userAgent);
      page = await context.newPage();

      // Block unnecessary resources for speed
      await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,mp4,mp3,pdf}', route => {
        route.abort();
      });

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      });

      if (!response || response.status() >= 400) {
        return null;
      }

      // Wait for content to load
      await page.waitForTimeout(1500 + Math.random() * 1000);

      // Scroll to trigger lazy loading
      await this.autoScroll(page);

      const html = await page.content();
      const title = await page.title();

      return {
        url,
        html,
        title,
        status: response.status(),
        engine: 'playwright',
      };

    } catch (err) {
      logger.warn(`Playwright error for ${url}: ${err.message}`);
      return null;
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  // ── Auto-scroll for infinite pages ───────────────────────────
  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= Math.min(document.body.scrollHeight, 5000)) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    }).catch(() => {});
  }

  // ── Search on Google ──────────────────────────────────────────
  async searchGoogle(query) {
    let context = null;
    let page = null;
    const results = [];

    try {
      context = await this.createContext();
      page = await context.newPage();

      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      await page.waitForTimeout(2000);

      // Accept cookies if present
      const cookieBtn = page.locator('[aria-label="Accept all"]');
      if (await cookieBtn.count() > 0) {
        await cookieBtn.click().catch(() => {});
      }

      // Extract search results
      const links = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href^="http"]');
        const urls = [];
        for (const a of anchors) {
          const href = a.href;
          if (
            href &&
            !href.includes('google.com') &&
            !href.includes('youtube.com') &&
            !href.includes('wikipedia.org')
          ) {
            urls.push(href);
          }
        }
        return [...new Set(urls)].slice(0, 20);
      });

      return links;
    } catch (err) {
      logger.warn(`Google search error: ${err.message}`);
      return [];
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  // ── Close browser ─────────────────────────────────────────────
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Playwright browser closed');
    }
  }
}
