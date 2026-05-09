// ============================================================
// LeadForge Ultimate — HTML Lead Parser & Contact Extractor
// ============================================================
import { parse } from 'node-html-parser';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

// ── Regex patterns ──────────────────────────────────────────────
const PATTERNS = {
  // Email - handles obfuscated formats too
  email: /([a-zA-Z0-9._%+\-]+(?:\s*\[at\]\s*|\s*@\s*)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi,
  emailClean: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi,
  
  // Phone numbers (various formats)
  phone: /(?:\+?\d{1,3}[\s\-\.]?)?\(?\d{3,5}\)?[\s\-\.]?\d{3,5}[\s\-\.]?\d{3,6}(?:\s*(ext|x|ext\.)\s*\d+)?/gi,
  
  // Social media
  linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company|pub)\/[a-zA-Z0-9\-_%]+\/?/gi,
  instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/gi,
  facebook: /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb)\.com\/[a-zA-Z0-9.]+\/?/gi,
  telegram: /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]+/gi,
  whatsapp: /(?:https?:\/\/)?(?:api\.whatsapp\.com|wa\.me)\/(?:\+?[\d]+)/gi,
  
  // PIN/ZIP codes
  pinCode: /\b\d{5,6}\b/g,
};

export class LeadParser {
  // ── Extract leads from HTML ──────────────────────────────────────
  extractFromHtml(html, sourceUrl = '') {
    if (!html || html.length < 50) return [];

    try {
      const root = parse(html);
      const leads = [];

      // Strategy 1: Schema.org markup (most reliable)
      const schemaLeads = this.extractSchemaOrg(root, sourceUrl);
      leads.push(...schemaLeads);

      // Strategy 2: Contact page pattern extraction
      if (leads.length === 0) {
        const contactLead = this.extractFromContactPage(root, html, sourceUrl);
        if (contactLead) leads.push(contactLead);
      }

      // Strategy 3: General pattern matching
      if (leads.length === 0) {
        const patternLead = this.extractByPatterns(html, root, sourceUrl);
        if (patternLead) leads.push(patternLead);
      }

      return leads.filter(l => this.isValidLead(l));
    } catch (err) {
      return [];
    }
  }

  // ── Extract Schema.org LocalBusiness data ─────────────────────────
  extractSchemaOrg(root, sourceUrl) {
    const leads = [];
    const scripts = root.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.text);
        const entries = Array.isArray(data) ? data : [data];

        for (const entry of entries) {
          const type = entry['@type'] || '';
          const isBusinessType = [
            'LocalBusiness', 'Restaurant', 'Store', 'MedicalBusiness',
            'HealthAndBeautyBusiness', 'LegalService', 'Organization',
            'Corporation', 'Hotel', 'Gym', 'SportsClub', 'DentistOffice'
          ].some(t => type.includes(t));

          if (isBusinessType) {
            leads.push(this.parseSchemaEntry(entry, sourceUrl));
          }
        }
      } catch {}
    }

    return leads;
  }

  // ── Parse a single Schema.org entry ──────────────────────────────
  parseSchemaEntry(entry, sourceUrl) {
    const addr = entry.address || {};
    const contact = entry.contactPoint || {};

    return {
      businessName: entry.name || null,
      phone: entry.telephone || contact.telephone || null,
      email: entry.email || contact.email || null,
      websiteUrl: entry.url || sourceUrl,
      city: addr.addressLocality || null,
      state: addr.addressRegion || null,
      country: addr.addressCountry || null,
      pinCode: addr.postalCode || null,
      instagramUrl: entry.sameAs?.find(s => s.includes('instagram')) || null,
      linkedinUrl: entry.sameAs?.find(s => s.includes('linkedin')) || null,
      facebookUrl: entry.sameAs?.find(s => s.includes('facebook')) || null,
      niche: entry['@type'] || null,
      sourceUrl,
    };
  }

  // ── Extract from contact/about pages ─────────────────────────────
  extractFromContactPage(root, html, sourceUrl) {
    const lead = { sourceUrl };

    // Try to get business name from title/h1
    lead.businessName = 
      root.querySelector('h1')?.text?.trim() ||
      root.querySelector('title')?.text?.replace(/\s*[-|].*$/, '').trim() ||
      null;

    // Extract emails
    const emailMatches = html.match(PATTERNS.emailClean) || [];
    const validEmails = emailMatches
      .filter(e => !e.includes('example.com') && !e.includes('domain.com'))
      .filter(e => e.length < 100);
    lead.email = validEmails[0] || null;

    // Extract phones
    const phoneMatches = html.match(PATTERNS.phone) || [];
    const validPhones = phoneMatches
      .filter(p => p.replace(/\D/g, '').length >= 7)
      .map(p => p.trim());
    lead.phone = validPhones[0] || null;

    // Extract social links
    lead.linkedinUrl = (html.match(PATTERNS.linkedin) || [])[0] || null;
    lead.instagramUrl = (html.match(PATTERNS.instagram) || [])[0] || null;
    lead.facebookUrl = (html.match(PATTERNS.facebook) || [])[0] || null;
    lead.telegram = (html.match(PATTERNS.telegram) || [])[0] || null;
    lead.whatsapp = (html.match(PATTERNS.whatsapp) || [])[0] || null;

    // Try to extract address from meta tags
    const addressMeta = root.querySelector('meta[name="address"]')?.getAttribute('content');
    if (addressMeta) {
      const parts = addressMeta.split(',').map(p => p.trim());
      lead.city = parts[parts.length - 2] || null;
      lead.state = parts[parts.length - 1] || null;
    }

    return lead;
  }

  // ── General pattern-based extraction ─────────────────────────────
  extractByPatterns(html, root, sourceUrl) {
    const lead = { sourceUrl };

    // Business name from og tags
    lead.businessName =
      root.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
      root.querySelector('meta[name="application-name"]')?.getAttribute('content') ||
      root.querySelector('title')?.text?.trim()?.split(' - ')[0] ||
      null;

    const emailMatches = html.match(PATTERNS.emailClean) || [];
    lead.email = emailMatches.filter(e => !e.includes('example') && !e.includes('domain'))[0] || null;

    const phoneMatches = html.match(PATTERNS.phone) || [];
    lead.phone = phoneMatches.filter(p => p.replace(/\D/g, '').length >= 7)[0]?.trim() || null;

    lead.linkedinUrl = (html.match(PATTERNS.linkedin) || [])[0] || null;
    lead.instagramUrl = (html.match(PATTERNS.instagram) || [])[0] || null;
    lead.facebookUrl = (html.match(PATTERNS.facebook) || [])[0] || null;
    lead.whatsapp = (html.match(PATTERNS.whatsapp) || [])[0] || null;
    lead.telegram = (html.match(PATTERNS.telegram) || [])[0] || null;

    return lead;
  }

  // ── Extract all links from a page ────────────────────────────────
  extractLinks(html, baseUrl) {
    try {
      const root = parse(html);
      const anchors = root.querySelectorAll('a[href]');
      const urls = new Set();

      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (!href) continue;

        try {
          const absolute = new URL(href, baseUrl).toString();
          urls.add(absolute);
        } catch {}
      }

      return [...urls];
    } catch {
      return [];
    }
  }

  // ── Validate lead has minimum useful data ─────────────────────────
  isValidLead(lead) {
    const hasContact = lead.email || lead.phone || lead.whatsapp;
    const hasBusiness = lead.businessName || lead.websiteUrl;
    return hasContact || hasBusiness;
  }
}
