// ============================================================
// LeadForge Ultimate — AI Deduplication Engine
// ============================================================
import { logger } from '../utils/logger.js';

export class AIDedupe {
  constructor(db) {
    this.db = db;
  }

  // ── Deduplicate all leads in a session ──────────────────────────
  async deduplicateSession(sessionId) {
    logger.info(`Running deduplication for session ${sessionId}`);

    // Step 1: Exact match deduplication (fast, DB-level)
    await this.exactDedupe(sessionId);

    // Step 2: Fuzzy match deduplication (phone/email/domain similarity)
    await this.fuzzyDedupe(sessionId);

    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(is_duplicate) as duplicates
      FROM leads WHERE session_id = ?
    `).get(sessionId);

    logger.info(`Deduplication complete: ${stats.duplicates || 0} duplicates found out of ${stats.total}`);
    return stats;
  }

  // ── Exact match on phone/email/domain ────────────────────────────
  async exactDedupe(sessionId) {
    // Mark duplicate emails
    this.db.exec(`
      UPDATE leads
      SET is_duplicate = 1
      WHERE id NOT IN (
        SELECT MIN(id) FROM leads
        WHERE session_id = '${sessionId}' AND email IS NOT NULL AND email != ''
        GROUP BY LOWER(TRIM(email))
      )
      AND session_id = '${sessionId}'
      AND email IS NOT NULL AND email != ''
      AND is_duplicate = 0
    `);

    // Mark duplicate phones
    this.db.exec(`
      UPDATE leads
      SET is_duplicate = 1
      WHERE id NOT IN (
        SELECT MIN(id) FROM leads
        WHERE session_id = '${sessionId}' AND phone IS NOT NULL AND phone != ''
        GROUP BY REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '')
      )
      AND session_id = '${sessionId}'
      AND phone IS NOT NULL AND phone != ''
      AND is_duplicate = 0
    `);

    // Mark duplicate domains
    this.db.exec(`
      UPDATE leads
      SET is_duplicate = 1
      WHERE id NOT IN (
        SELECT MIN(id) FROM leads
        WHERE session_id = '${sessionId}' AND website_url IS NOT NULL AND website_url != ''
        GROUP BY LOWER(
          REPLACE(REPLACE(REPLACE(REPLACE(website_url, 'https://', ''), 'http://', ''), 'www.', ''), '/', '')
        )
      )
      AND session_id = '${sessionId}'
      AND website_url IS NOT NULL AND website_url != ''
      AND is_duplicate = 0
    `);
  }

  // ── Fuzzy deduplication (similarity-based) ────────────────────────
  async fuzzyDedupe(sessionId) {
    const leads = this.db.prepare(`
      SELECT id, business_name, phone, email, website_url
      FROM leads WHERE session_id = ? AND is_duplicate = 0
    `).all(sessionId);

    const seenNames = new Map();

    for (const lead of leads) {
      if (!lead.business_name) continue;
      
      const normalized = this.normalizeName(lead.business_name);
      if (seenNames.has(normalized)) {
        // Mark as duplicate
        this.db.prepare(`UPDATE leads SET is_duplicate = 1 WHERE id = ?`).run(lead.id);
      } else {
        seenNames.set(normalized, lead.id);
      }
    }
  }

  // ── Normalize business name for comparison ────────────────────────
  normalizeName(name) {
    return name
      .toLowerCase()
      .replace(/\b(llc|inc|ltd|pvt|private|limited|corp|co)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
}
