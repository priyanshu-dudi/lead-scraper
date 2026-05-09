// ============================================================
// LeadForge Ultimate — Config Routes
// ============================================================
import { Router } from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const configRoutes = Router();

// ── GET /api/config/niches ─────────────────────────────────────────
configRoutes.get('/niches', (req, res) => {
  try {
    const niches = JSON.parse(readFileSync(path.join(__dirname, '../../config/niches.json'), 'utf-8'));
    res.json({ success: true, data: niches.categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/config/sources ────────────────────────────────────────
configRoutes.get('/sources', (req, res) => {
  try {
    const sources = JSON.parse(readFileSync(path.join(__dirname, '../../config/sources.json'), 'utf-8'));
    res.json({ success: true, data: sources.sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/config/env ────────────────────────────────────────────
configRoutes.get('/env', (req, res) => {
  res.json({
    success: true,
    data: {
      openaiConfigured: !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-')),
      maxConcurrency: process.env.MAX_CONCURRENCY || '5',
      useProxy: process.env.USE_PROXY === 'true',
      aiExtraction: process.env.USE_AI_EXTRACTION === 'true',
      crawlDepth: process.env.CRAWL_DEPTH || '3',
    },
  });
});
