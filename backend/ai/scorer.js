// ============================================================
// LeadForge Ultimate — Lead Scorer
// ============================================================
import { logger } from '../utils/logger.js';

export class AIScorer {
  // ── Score all leads in a session ─────────────────────────────────
  async scoreSession(sessionId, db) {
    logger.info(`Scoring leads for session ${sessionId}`);

    const leads = db.prepare(`
      SELECT * FROM leads WHERE session_id = ? AND is_duplicate = 0
    `).all(sessionId);

    const weights = {
      email: parseInt(process.env.SCORE_HAS_EMAIL || '20'),
      phone: parseInt(process.env.SCORE_HAS_PHONE || '20'),
      website: parseInt(process.env.SCORE_HAS_WEBSITE || '15'),
      social: parseInt(process.env.SCORE_HAS_SOCIAL || '10'),
      address: parseInt(process.env.SCORE_HAS_ADDRESS || '15'),
      owner: parseInt(process.env.SCORE_HAS_OWNER || '20'),
    };

    const updateStmt = db.prepare(`UPDATE leads SET lead_score = ? WHERE id = ?`);

    const updateMany = db.transaction((leads) => {
      for (const lead of leads) {
        const score = this.computeScore(lead, weights);
        updateStmt.run(score, lead.id);
      }
    });

    updateMany(leads);
    logger.info(`Scored ${leads.length} leads`);
  }

  // ── Compute individual lead score ─────────────────────────────────
  computeScore(lead, weights) {
    let score = 0;

    if (lead.email && this.isValidEmail(lead.email)) score += weights.email;
    if (lead.phone && lead.phone.length >= 7) score += weights.phone;
    if (lead.website_url) score += weights.website;
    if (lead.owner_name) score += weights.owner;
    
    const hasSocial = [lead.linkedin_url, lead.instagram_url, lead.facebook_url, lead.telegram]
      .filter(Boolean).length;
    score += Math.min(hasSocial * 5, weights.social);

    if (lead.city || lead.state || lead.country) score += weights.address;

    // Bonus for WhatsApp (high-value contact)
    if (lead.whatsapp) score += 5;

    // Bonus for multiple contacts
    const contactCount = [lead.email, lead.phone, lead.whatsapp].filter(Boolean).length;
    if (contactCount >= 2) score += 5;
    if (contactCount >= 3) score += 5;

    return Math.min(score, 100);
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
