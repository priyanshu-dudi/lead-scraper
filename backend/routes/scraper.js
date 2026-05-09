// ============================================================
// LeadForge Ultimate — Scraper Control Routes
// ============================================================
import { Router } from 'express';

export const scraperRoutes = Router();

// ── POST /api/scraper/start ────────────────────────────────────────
scraperRoutes.post('/start', async (req, res) => {
  const orchestrator = req.app.locals.orchestrator;
  const config = req.body;

  if (orchestrator.isRunning) {
    return res.status(409).json({ success: false, error: 'Scraper already running' });
  }

  // Start async - don't await
  orchestrator.start(config).catch(console.error);

  res.json({ success: true, sessionId: orchestrator.sessionId });
});

// ── POST /api/scraper/stop ─────────────────────────────────────────
scraperRoutes.post('/stop', (req, res) => {
  const orchestrator = req.app.locals.orchestrator;
  orchestrator.stop();
  res.json({ success: true });
});

// ── POST /api/scraper/pause ────────────────────────────────────────
scraperRoutes.post('/pause', (req, res) => {
  const orchestrator = req.app.locals.orchestrator;
  orchestrator.pause();
  res.json({ success: true });
});

// ── POST /api/scraper/resume ───────────────────────────────────────
scraperRoutes.post('/resume', (req, res) => {
  const orchestrator = req.app.locals.orchestrator;
  orchestrator.resume();
  res.json({ success: true });
});

// ── GET /api/scraper/status ────────────────────────────────────────
scraperRoutes.get('/status', (req, res) => {
  const orchestrator = req.app.locals.orchestrator;
  res.json({
    success: true,
    data: {
      isRunning: orchestrator.isRunning,
      isPaused: orchestrator.isPaused,
      sessionId: orchestrator.sessionId,
      stats: orchestrator.stats,
    },
  });
});

// ── GET /api/scraper/logs ──────────────────────────────────────────
scraperRoutes.get('/logs', (req, res) => {
  const db = req.app.locals.db;
  const { sessionId, limit = 200 } = req.query;

  const where = sessionId ? `WHERE session_id = '${sessionId}'` : '';
  const logs = db.prepare(`
    SELECT * FROM scraping_logs ${where}
    ORDER BY created_at DESC LIMIT ?
  `).all(parseInt(limit));

  res.json({ success: true, data: logs.reverse() });
});

// ── GET /api/scraper/queue ─────────────────────────────────────────
scraperRoutes.get('/queue', (req, res) => {
  const db = req.app.locals.db;
  const { sessionId } = req.query;

  const where = sessionId ? `WHERE session_id = '${sessionId}'` : '';
  const queue = db.prepare(`
    SELECT status, COUNT(*) as count FROM scraping_queue ${where}
    GROUP BY status
  `).all();

  res.json({ success: true, data: queue });
});
