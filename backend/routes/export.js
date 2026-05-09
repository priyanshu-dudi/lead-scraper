// ============================================================
// LeadForge Ultimate — CSV/JSON Export Routes
// ============================================================
import { Router } from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import { mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORTS_DIR = path.join(__dirname, '../../exports');

mkdirSync(EXPORTS_DIR, { recursive: true });

export const exportRoutes = Router();

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

// ── POST /api/export/csv — Export leads to CSV ─────────────────────
exportRoutes.post('/csv', async (req, res) => {
  const db = req.app.locals.db;
  const {
    sessionId, niche, city, country, minScore = 0,
    excludeDuplicates = true, filename,
  } = req.body;

  try {
    const conditions = [];
    const params = [];

    if (excludeDuplicates) { conditions.push('is_duplicate = 0'); }
    if (sessionId) { conditions.push('session_id = ?'); params.push(sessionId); }
    if (niche) { conditions.push('niche LIKE ?'); params.push(`%${niche}%`); }
    if (city) { conditions.push('city LIKE ?'); params.push(`%${city}%`); }
    if (country) { conditions.push('country LIKE ?'); params.push(`%${country}%`); }
    if (minScore > 0) { conditions.push('lead_score >= ?'); params.push(parseInt(minScore)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY lead_score DESC`).all(...params);

    if (leads.length === 0) {
      return res.status(404).json({ success: false, error: 'No leads found with given filters' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filePrefix = niche ? `${niche}_` : '';
    const cityPrefix = city ? `${city}_` : '';
    const exportFilename = filename || `leads_${filePrefix}${cityPrefix}${timestamp}.csv`;
    const filePath = path.join(EXPORTS_DIR, exportFilename);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: CSV_HEADERS,
    });

    await csvWriter.writeRecords(leads);

    res.json({
      success: true,
      data: {
        filename: exportFilename,
        path: filePath,
        count: leads.length,
        timestamp,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/export/download/:filename — Download CSV ─────────────
exportRoutes.get('/download/:filename', (req, res) => {
  const filePath = path.join(EXPORTS_DIR, req.params.filename);
  
  if (!existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  res.download(filePath);
});

// ── GET /api/export/files — List exported files ────────────────────
exportRoutes.get('/files', (req, res) => {
  try {
    const files = readdirSync(EXPORTS_DIR)
      .filter(f => f.endsWith('.csv') || f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(EXPORTS_DIR, f);
        const stats = statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/export/json — Export as JSON ─────────────────────────
exportRoutes.post('/json', async (req, res) => {
  const db = req.app.locals.db;
  const { sessionId, excludeDuplicates = true } = req.body;

  const where = [
    excludeDuplicates ? 'is_duplicate = 0' : null,
    sessionId ? `session_id = '${sessionId}'` : null,
  ].filter(Boolean).join(' AND ');

  const leads = db.prepare(`SELECT * FROM leads ${where ? 'WHERE ' + where : ''} ORDER BY lead_score DESC`).all();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `leads_${timestamp}.json`;
  const filePath = path.join(EXPORTS_DIR, filename);

  const { writeFileSync } = await import('fs');
  writeFileSync(filePath, JSON.stringify(leads, null, 2));

  res.json({ success: true, data: { filename, count: leads.length } });
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
