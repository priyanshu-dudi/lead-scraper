// ============================================================
// LeadForge Ultimate — Leads API Routes
// ============================================================
import { Router } from 'express';

export const leadRoutes = Router();

// ── GET /api/leads — List leads with filters ──────────────────────
leadRoutes.get('/', (req, res) => {
  const db = req.app.locals.db;
  const {
    sessionId, niche, city, country, minScore = 0,
    page = 1, limit = 100, sortBy = 'lead_score', sortDir = 'DESC',
    duplicates = 'false', search,
  } = req.query;

  const conditions = [`l.is_duplicate = ${duplicates === 'true' ? 1 : 0}`];
  const params = [];

  if (sessionId) { conditions.push('l.session_id = ?'); params.push(sessionId); }
  if (niche) { conditions.push('l.niche LIKE ?'); params.push(`%${niche}%`); }
  if (city) { conditions.push('l.city LIKE ?'); params.push(`%${city}%`); }
  if (country) { conditions.push('l.country LIKE ?'); params.push(`%${country}%`); }
  if (minScore > 0) { conditions.push('l.lead_score >= ?'); params.push(parseInt(minScore)); }
  if (search) {
    conditions.push('(l.business_name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.city LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const validSortCols = ['lead_score', 'created_at', 'business_name', 'city', 'niche'];
  const sortCol = validSortCols.includes(sortBy) ? sortBy : 'lead_score';
  const sortDirSafe = sortDir === 'ASC' ? 'ASC' : 'DESC';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const total = db.prepare(`SELECT COUNT(*) as count FROM leads l ${where}`).get(...params);
    const leads = db.prepare(`
      SELECT l.* FROM leads l ${where}
      ORDER BY l.${sortCol} ${sortDirSafe}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      success: true,
      data: leads,
      pagination: {
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total.count / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/leads/stats — Aggregate stats ─────────────────────────
leadRoutes.get('/stats', (req, res) => {
  const db = req.app.locals.db;
  const { sessionId } = req.query;

  try {
    const where = sessionId ? `WHERE session_id = '${sessionId}'` : '';
    
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_duplicate = 0 THEN 1 END) as unique_leads,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email,
        COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as with_phone,
        COUNT(CASE WHEN whatsapp IS NOT NULL AND whatsapp != '' THEN 1 END) as with_whatsapp,
        COUNT(CASE WHEN website_url IS NOT NULL THEN 1 END) as with_website,
        AVG(lead_score) as avg_score,
        MAX(lead_score) as max_score
      FROM leads ${where}
    `).get();

    const byNiche = db.prepare(`
      SELECT niche, COUNT(*) as count
      FROM leads ${where}
      GROUP BY niche ORDER BY count DESC LIMIT 10
    `).all();

    const byCity = db.prepare(`
      SELECT city, COUNT(*) as count
      FROM leads ${where ? where + ' AND' : 'WHERE'} city IS NOT NULL
      GROUP BY city ORDER BY count DESC LIMIT 10
    `).all();

    const sessions = db.prepare(`
      SELECT * FROM scraping_sessions ORDER BY started_at DESC LIMIT 10
    `).all();

    res.json({ success: true, data: { stats, byNiche, byCity, sessions } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/leads/:id ──────────────────────────────────────────
leadRoutes.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── DELETE /api/leads — Clear all ──────────────────────────────────
leadRoutes.delete('/', (req, res) => {
  const db = req.app.locals.db;
  const { sessionId } = req.query;
  
  if (sessionId) {
    db.prepare('DELETE FROM leads WHERE session_id = ?').run(sessionId);
  } else {
    db.prepare('DELETE FROM leads').run();
  }
  
  res.json({ success: true });
});
