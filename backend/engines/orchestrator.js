// ============================================================
// LeadForge Ultimate — Master Scraping Orchestrator
// (Continuous mode + CSV auto-save every 60s)
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { HttpxEngine } from './httpx-engine.js';
import { PlaywrightEngine } from './playwright-engine.js';
import { SearchDiscovery } from './search-discovery.js';
import { AIExtractor } from '../ai/extractor.js';
import { AIDedupe } from '../ai/dedupe.js';
import { AIScorer } from '../ai/scorer.js';
import { LeadParser } from '../utils/lead-parser.js';
import { UserAgentRotator } from '../utils/user-agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORTS_DIR = path.join(__dirname, '../../exports');
const LEADS_CSV_PATH = path.join(EXPORTS_DIR, 'leads.csv');

const CSV_HEADERS = [
  { id: 'business_name', title: 'Business Name' },
  { id: 'owner_name', title: 'Owner Name' },
  { id: 'niche', title: 'Niche' },
  { id: 'phone', title: 'Phone' },
  { id: 'whatsapp', title: 'WhatsApp' },
  { id: 'email', title: 'Email' },
  { id: 'linkedin_url', title: 'LinkedIn' },
  { id: 'instagram_url', title: 'Instagram' },
  { id: 'facebook_url', title: 'Facebook' },
  { id: 'telegram', title: 'Telegram' },
  { id: 'website_url', title: 'Website' },
  { id: 'city', title: 'City' },
  { id: 'state', title: 'State' },
  { id: 'country', title: 'Country' },
  { id: 'pin_code', title: 'PIN Code' },
  { id: 'lead_score', title: 'Lead Score' },
  { id: 'source_url', title: 'Source URL' },
  { id: 'created_at', title: 'Created At' },
];

export class ScrapingOrchestrator {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.sessionId = null;
    this.config = null;
    this.isRunning = false;
    this.isPaused = false;
    this.stats = { leads: 0, pages: 0, errors: 0, queue: 0 };
    this._csvSaveInterval = null;
    this._roundCount = 0;

    this.httpxEngine = new HttpxEngine();
    // Only enable Playwright if explicitly enabled and not in cloud mode
    this.playwrightEnabled = process.env.PLAYWRIGHT_ENABLED !== 'false';
    this.playwrightEngine = this.playwrightEnabled ? new PlaywrightEngine() : null;
    this.searchDiscovery = new SearchDiscovery();
    this.aiExtractor = new AIExtractor();
    this.aiDedupe = new AIDedupe(db);
    this.aiScorer = new AIScorer();
    this.leadParser = new LeadParser();
    this.uaRotator = new UserAgentRotator();
  }

  // ── Start Scraping Session ──────────────────────────────────
  async start(config) {
    if (this.isRunning) {
      this.emit('error', { message: 'Already running' });
      return;
    }

    this.sessionId = uuidv4();
    this.config = config;
    this.isRunning = true;
    this.isPaused = false;
    this.stats = { leads: 0, pages: 0, errors: 0, queue: 0 };
    this._roundCount = 0;

    this.db.prepare(`
      INSERT INTO scraping_sessions (id, status, config, started_at)
      VALUES (?, 'running', ?, CURRENT_TIMESTAMP)
    `).run(this.sessionId, JSON.stringify(config));

    this.emit('session_started', { sessionId: this.sessionId, config });
    this.log('info', `🚀 Session started: ${this.sessionId}`);

    // ── Auto-save CSV every 60 seconds ─────────────────────
    this._csvSaveInterval = setInterval(() => {
      this.saveLeadsCSV().catch(() => {});
    }, 60_000);

    try {
      if (config.continuousMode) {
        await this.runContinuous();
      } else {
        await this.runScrapingPipeline();
      }
    } catch (err) {
      logger.error('Orchestrator fatal error:', err);
      this.log('error', `Fatal: ${err.message}`);
    } finally {
      clearInterval(this._csvSaveInterval);
      await this.saveLeadsCSV(); // final save
      this.finishSession();
    }
  }

  // ── Continuous mode: keep restarting pipelines 24/7 ────────
  async runContinuous() {
    while (this.isRunning) {
      this._roundCount++;
      this.log('info', `🔄 Starting scrape round #${this._roundCount}`);
      await this.runScrapingPipeline();

      if (!this.isRunning) break;

      this.log('info', `♻️  Round #${this._roundCount} complete. Restarting in 10s...`);
      await this.sleep(10_000);
    }
  }

  // ── Single pipeline run ─────────────────────────────────────
  async runScrapingPipeline() {
    const { niches, locations, crawlDepth = 3 } = this.config;

    this.log('info', '🔍 Generating search URLs...');
    const seedUrls = await this.searchDiscovery.generateSeedUrls(niches, locations);
    this.addToQueue(seedUrls, 0, 'search');

    this.log('info', `🕸️  Processing ${seedUrls.length} seed URLs...`);
    await this.processQueue(crawlDepth);

    this.log('info', '🧠 Deduplicating...');
    await this.aiDedupe.deduplicateSession(this.sessionId);

    this.log('info', '⭐ Scoring leads...');
    await this.aiScorer.scoreSession(this.sessionId, this.db);

    // Save CSV after each pipeline
    await this.saveLeadsCSV();
    this.log('info', `✅ Pipeline done. Total leads: ${this.stats.leads}`);
  }

  // ── Queue Processor ─────────────────────────────────────────
  async processQueue(maxDepth) {
    const concurrency = parseInt(process.env.MAX_CONCURRENCY || '8');
    const limit = pLimit(concurrency);

    while (this.isRunning) {
      if (this.isPaused) { await this.sleep(1000); continue; }

      const batch = this.db.prepare(`
        SELECT * FROM scraping_queue
        WHERE session_id = ? AND status = 'pending' AND depth <= ?
        ORDER BY priority DESC, created_at ASC
        LIMIT ?
      `).all(this.sessionId, maxDepth, concurrency * 3);

      if (batch.length === 0) break;

      this.stats.queue = this.getPendingCount();
      this.emit('stats_update', this.stats);

      await Promise.allSettled(batch.map(item => limit(() => this.processQueueItem(item))));
    }
  }

  // ── Process Single Queue Item ────────────────────────────────
  async processQueueItem(item) {
    if (!this.isRunning) return;

    this.db.prepare(`UPDATE scraping_queue SET status='processing', processed_at=CURRENT_TIMESTAMP WHERE id=?`).run(item.id);

    try {
      await this.randomDelay();

      // Use HTTPX or Playwright based on config
      let result = null;
      if (item.engine === 'playwright' && this.playwrightEnabled && this.playwrightEngine) {
        result = await this.playwrightEngine.scrape(item.url, { userAgent: this.uaRotator.next() });
      }
      // Always fall back to httpx
      if (!result) {
        result = await this.httpxEngine.scrape(item.url, { userAgent: this.uaRotator.next() });
      }

      this.stats.pages++;

      if (result?.html) {
        const rawLeads = this.leadParser.extractFromHtml(result.html, item.url);
        let aiLeads = [];

        if (process.env.USE_AI_EXTRACTION === 'true' && rawLeads.length === 0) {
          aiLeads = await this.aiExtractor.extractLeads(result.html, item.url);
        }

        for (const lead of [...rawLeads, ...aiLeads]) {
          this.saveLead({ ...lead, niche: lead.niche || item.source });
        }

        // Discover deeper links
        if (item.depth < (this.config.crawlDepth || 3)) {
          const links = this.leadParser.extractLinks(result.html, item.url);
          const filtered = this.filterRelevantUrls(links, item.depth + 1);
          this.addToQueue(filtered, item.depth + 1, item.source);
        }
      }

      this.db.prepare(`UPDATE scraping_queue SET status='done' WHERE id=?`).run(item.id);

    } catch (err) {
      this.stats.errors++;
      this.db.prepare(`UPDATE scraping_queue SET status='failed', attempts=attempts+1, error_msg=? WHERE id=?`)
        .run(err.message, item.id);

      if (item.attempts < 3) {
        this.db.prepare(`UPDATE scraping_queue SET status='pending' WHERE id=? AND attempts < 3`).run(item.id);
      }
    }
  }

  // ── Save Lead ────────────────────────────────────────────────
  saveLead(lead) {
    if (!lead.businessName && !lead.email && !lead.phone) return;
    try {
      const result = this.db.prepare(`
        INSERT INTO leads (
          session_id, business_name, owner_name, niche, phone, whatsapp,
          email, linkedin_url, instagram_url, facebook_url, telegram,
          website_url, city, state, country, pin_code, source_url, raw_data
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        this.sessionId,
        lead.businessName || null, lead.ownerName || null,
        lead.niche || null, lead.phone || null, lead.whatsapp || null,
        lead.email || null, lead.linkedinUrl || null, lead.instagramUrl || null,
        lead.facebookUrl || null, lead.telegram || null, lead.websiteUrl || null,
        lead.city || null, lead.state || null, lead.country || null,
        lead.pinCode || null, lead.sourceUrl || null, JSON.stringify(lead)
      );
      if (result.changes > 0) {
        this.stats.leads++;
        this.emit('new_lead', { lead, stats: this.stats });
        if (this.stats.leads % 50 === 0) {
          this.log('info', `📊 ${this.stats.leads} leads collected so far`);
        }
      }
    } catch (err) {
      logger.debug(`Lead save error: ${err.message}`);
    }
  }

  // ── Auto-Save CSV every 60s ──────────────────────────────────
  async saveLeadsCSV() {
    try {
      const leads = this.db.prepare(`
        SELECT * FROM leads WHERE is_duplicate = 0
        ORDER BY lead_score DESC, created_at DESC
      `).all();

      if (leads.length === 0) return;

      const csvWriter = createObjectCsvWriter({
        path: LEADS_CSV_PATH,
        header: CSV_HEADERS,
      });

      await csvWriter.writeRecords(leads);
      logger.info(`💾 Auto-saved ${leads.length} leads → exports/leads.csv`);
      this.emit('csv_saved', { count: leads.length, path: LEADS_CSV_PATH });
    } catch (err) {
      logger.error(`CSV save failed: ${err.message}`);
    }
  }

  // ── Add to Queue ─────────────────────────────────────────────
  addToQueue(urls, depth = 0, source = 'generic') {
    const insert = this.db.transaction((items) => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO scraping_queue (session_id, url, source, depth, engine, priority)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        const url = typeof item === 'string' ? item : item.url;
        const engine = typeof item === 'object' ? (item.engine || 'httpx') : 'httpx';
        const priority = typeof item === 'object' ? (item.priority || 5) : 5;
        if (url) stmt.run(this.sessionId, url, source, depth, engine, priority);
      }
    });
    insert(urls.filter(Boolean));
  }

  // ── Filter relevant URLs ─────────────────────────────────────
  filterRelevantUrls(urls, depth) {
    return urls.filter(url => {
      try {
        const u = new URL(url);
        if (!['http:', 'https:'].includes(u.protocol)) return false;
        if (/\.(jpg|jpeg|png|gif|pdf|zip|mp4|css|js|woff)$/i.test(u.pathname)) return false;
        if (/contact|about|team|reach|touch/i.test(u.pathname)) return true;
        if (depth > 1) {
          const niches = (this.config?.niches || []).flatMap(n => n.keywords || []);
          return niches.some(k => url.toLowerCase().includes(k.toLowerCase()));
        }
        return true;
      } catch { return false; }
    });
  }

  // ── Control ───────────────────────────────────────────────────
  stop() {
    this.isRunning = false;
    clearInterval(this._csvSaveInterval);
    this.saveLeadsCSV().catch(() => {});
    this.emit('session_stopped', { stats: this.stats });
    this.log('info', '⏹️ Stopped');
  }

  pause() { this.isPaused = true; this.emit('session_paused', { stats: this.stats }); }
  resume() { this.isPaused = false; this.emit('session_resumed', { stats: this.stats }); }

  finishSession() {
    this.isRunning = false;
    this.db.prepare(`
      UPDATE scraping_sessions
      SET status='completed', leads_found=?, pages_crawled=?, errors=?, completed_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(this.stats.leads, this.stats.pages, this.stats.errors, this.sessionId);
    this.emit('session_completed', { stats: this.stats });
    this.log('info', `🎉 Done. Leads: ${this.stats.leads} | Pages: ${this.stats.pages}`);
  }

  // ── Helpers ───────────────────────────────────────────────────
  getPendingCount() {
    return this.db.prepare(`SELECT COUNT(*) as c FROM scraping_queue WHERE session_id=? AND status='pending'`).get(this.sessionId)?.c || 0;
  }
  emit(event, data) { this.io.emit(event, data); }
  log(level, message) {
    logger[level]?.(message) || logger.info(message);
    try {
      this.db.prepare(`INSERT INTO scraping_logs (session_id, level, message) VALUES (?,?,?)`).run(this.sessionId, level, message);
    } catch {}
    this.emit('log', { level, message, timestamp: new Date().toISOString() });
  }
  async randomDelay() {
    const min = parseInt(process.env.REQUEST_DELAY_MIN || '800');
    const max = parseInt(process.env.REQUEST_DELAY_MAX || '2500');
    await this.sleep(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
