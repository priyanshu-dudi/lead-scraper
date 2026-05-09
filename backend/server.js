// ============================================================
// LeadForge Ultimate — Server (Railway-ready, auto-start)
// ============================================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

// Load .env — works locally; Railway injects vars directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../config/.env');
if (existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config(); // Railway: vars already in process.env

import { leadRoutes } from './routes/leads.js';
import { scraperRoutes } from './routes/scraper.js';
import { exportRoutes } from './routes/export.js';
import { configRoutes } from './routes/config.js';
import { setupDatabase } from './db/database.js';
import { logger } from './utils/logger.js';
import { ScrapingOrchestrator } from './engines/orchestrator.js';

mkdirSync(path.join(__dirname, '../exports'), { recursive: true });
mkdirSync(path.join(__dirname, '../logs'), { recursive: true });

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3001;

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Database & Orchestrator ─────────────────────────────────
const db = setupDatabase();
const orchestrator = new ScrapingOrchestrator(db, io);
app.locals.orchestrator = orchestrator;
app.locals.db = db;
app.locals.io = io;

// ── Routes ──────────────────────────────────────────────────
app.use('/api/leads', leadRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/config', configRoutes);

// ── Direct leads.csv download (always available) ────────────
app.get('/leads.csv', (req, res) => {
  const csvPath = path.join(__dirname, '../exports/leads.csv');
  if (existsSync(csvPath)) {
    res.download(csvPath, 'leads.csv');
  } else {
    res.status(404).send('No leads.csv yet — scraping may still be warming up.');
  }
});

// ── Health ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM leads WHERE is_duplicate=0').get()?.c || 0;
  res.json({
    app: 'LeadForge Ultimate',
    status: 'running',
    leads_collected: count,
    scraper_running: orchestrator.isRunning,
    uptime_minutes: Math.floor(process.uptime() / 60),
    download_leads: '/leads.csv',
    timestamp: new Date().toISOString(),
  });
});
app.get('/api/health', (req, res) => res.redirect('/'));

// ── Socket.IO ────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Dashboard connected: ${socket.id}`);
  socket.on('start_scraping', (config) => orchestrator.start(config));
  socket.on('stop_scraping', () => orchestrator.stop());
  socket.on('pause_scraping', () => orchestrator.pause());
  socket.on('resume_scraping', () => orchestrator.resume());
  socket.on('disconnect', () => logger.info(`Dashboard disconnected: ${socket.id}`));
});

// ── Start server ─────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 LeadForge running on port ${PORT}`);
  logger.info(`📥 Download leads: GET /leads.csv`);

  // ── AUTO-START on Railway / production ────────────────────
  if (process.env.AUTO_START === 'true') {
    logger.info('⚡ AUTO_START enabled — building scraping config from ENV...');
    setTimeout(() => autoStartScraping(orchestrator), 3000);
  }
});

// ── Build config from env vars and launch ────────────────────
function autoStartScraping(orchestrator) {
  const nicheIds = (process.env.SCRAPE_NICHES || 'dentist,restaurant,gym,salon')
    .split(',').map(s => s.trim()).filter(Boolean);

  const cities = (process.env.SCRAPE_CITIES || 'Mumbai,Delhi,Bangalore')
    .split(',').map(s => s.trim()).filter(Boolean);

  const states = (process.env.SCRAPE_STATES || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const country = process.env.SCRAPE_COUNTRY || 'India';

  // Build niche objects
  const niches = nicheIds.map(id => ({
    id: id.toLowerCase().replace(/\s+/g, '_'),
    label: id,
    keywords: [id],
    searchTerms: [`${id} near me`, `${id} business contact`, `best ${id}`],
  }));

  const config = {
    niches,
    locations: { countries: [country], states, cities },
    maxLeads: 999999,       // No cap — run until Railway kills it
    crawlDepth: parseInt(process.env.CRAWL_DEPTH || '3'),
    concurrency: parseInt(process.env.MAX_CONCURRENCY || '8'),
    useAI: !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-')),
    continuousMode: true,   // Restart pipeline when queue empties
  };

  logger.info(`🎯 Niches: ${nicheIds.join(', ')}`);
  logger.info(`📍 Cities: ${cities.join(', ')}`);
  logger.info(`🚀 Starting continuous scraping...`);

  orchestrator.start(config).catch(err => {
    logger.error(`Auto-start failed: ${err.message}`);
    // Retry after 30s
    setTimeout(() => autoStartScraping(orchestrator), 30000);
  });
}

export { io, db, orchestrator };
