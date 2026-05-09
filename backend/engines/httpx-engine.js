// ============================================================
// LeadForge Ultimate — HTTPX / Axios Fast HTTP Engine
// ============================================================
import axios from 'axios';
import https from 'https';
import { parse } from 'node-html-parser';
import { logger } from '../utils/logger.js';
import { UserAgentRotator } from '../utils/user-agents.js';
import robotsParser from 'robots-parser';

const uaRotator = new UserAgentRotator();

export class HttpxEngine {
  constructor() {
    this.robotsCache = new Map();
    this.client = axios.create({
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      maxRedirects: 5,
      validateStatus: (s) => s < 500,
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false
      })
    });
  }

  // ── Check robots.txt ─────────────────────────────────────────
  async isAllowed(url) {
    try {
      const { origin } = new URL(url);
      if (!this.robotsCache.has(origin)) {
        const resp = await this.client.get(`${origin}/robots.txt`, {
          timeout: 5000,
        }).catch(() => ({ data: '' }));
        this.robotsCache.set(origin, robotsParser(`${origin}/robots.txt`, resp.data));
      }
      const robots = this.robotsCache.get(origin);
      return robots.isAllowed(url, 'LeadForgeBot/1.0');
    } catch {
      return true; // allow if can't check
    }
  }

  // ── Scrape a URL ──────────────────────────────────────────────
  async scrape(url, options = {}) {
    try {
      const allowed = await this.isAllowed(url);
      if (!allowed) {
        logger.debug(`Blocked by robots.txt: ${url}`);
        return null;
      }

      const ua = options.userAgent || uaRotator.next();
      const headers = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      };

      // Add proxy if configured
      const proxyConfig = this.getProxyConfig();

      const response = await this.client.get(url, {
        headers,
        ...proxyConfig,
      });

      if (response.status === 200 && response.data) {
        return {
          url,
          html: response.data,
          status: response.status,
          headers: response.headers,
          engine: 'httpx',
        };
      }

      return null;
    } catch (err) {
      logger.warn(`HTTPX error for ${url}: ${err.message}`);
      return null;
    }
  }

  // ── Scrape multiple URLs in parallel ─────────────────────────
  async scrapeMany(urls, options = {}) {
    const results = await Promise.allSettled(
      urls.map(url => this.scrape(url, options))
    );
    return results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
  }

  // ── Proxy configuration ───────────────────────────────────────
  getProxyConfig() {
    if (process.env.USE_PROXY !== 'true') return {};
    const proxies = (process.env.PROXY_LIST || '').split(',').filter(Boolean);
    if (proxies.length === 0) return {};
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    try {
      const proxyUrl = new URL(proxy);
      return {
        proxy: {
          protocol: proxyUrl.protocol.replace(':', ''),
          host: proxyUrl.hostname,
          port: parseInt(proxyUrl.port),
          auth: proxyUrl.username ? {
            username: proxyUrl.username,
            password: proxyUrl.password,
          } : undefined,
        },
      };
    } catch {
      return {};
    }
  }
}
