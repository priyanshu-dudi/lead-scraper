// ============================================================
// LeadForge Ultimate — AI Lead Extractor (OpenAI + LangChain)
// ============================================================
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXTRACTION_PROMPT = `You are a lead extraction AI. Analyze the provided HTML/text content and extract ALL business lead information found.

For each business found, extract:
- businessName: Company/business name
- ownerName: Owner or contact person name
- phone: Primary phone number (normalize format)
- whatsapp: WhatsApp number if mentioned
- email: Email address
- linkedinUrl: LinkedIn profile/company URL
- instagramUrl: Instagram URL or handle
- facebookUrl: Facebook page URL
- telegram: Telegram handle or link
- websiteUrl: Official website URL
- city: City name
- state: State/province
- country: Country
- pinCode: ZIP/postal/PIN code
- niche: Business category/type

Rules:
- Extract ALL phone numbers found (mobile, landline)
- Look for emails in text, links, and obfuscated formats (like "email [at] domain.com")
- Check footer, header, contact sections, and schema.org markup
- Return ONLY a JSON array, no extra text
- If a field is not found, set it to null
- Return empty array [] if no leads found or if the page looks like an error, captcha, "Access Denied", or "No Results Found" page.

Source URL: {sourceUrl}

Content:
{content}`;

export class AIExtractor {
  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.batchSize = parseInt(process.env.AI_BATCH_SIZE || '10');
  }

  // ── Extract leads from HTML content ────────────────────────────
  async extractLeads(html, sourceUrl) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-')) {
      return [];
    }

    try {
      // Truncate to avoid token limits (keep ~3000 chars of meaningful content)
      const content = this.preprocessHtml(html, 3000);
      if (!content || content.length < 50) return [];

      const prompt = EXTRACTION_PROMPT
        .replace('{sourceUrl}', sourceUrl)
        .replace('{content}', content);

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content || '{"leads":[]}';
      const parsed = JSON.parse(text);
      const leads = Array.isArray(parsed) ? parsed : (parsed.leads || []);

      return leads.map(lead => ({ ...lead, sourceUrl, extractedByAI: true }));
    } catch (err) {
      logger.warn(`AI extraction error: ${err.message}`);
      return [];
    }
  }

  // ── Clean data with AI ─────────────────────────────────────────
  async cleanLeads(leads) {
    if (!process.env.OPENAI_API_KEY || leads.length === 0) return leads;

    const batches = this.chunk(leads, this.batchSize);
    const cleaned = [];

    for (const batch of batches) {
      try {
        const response = await openai.chat.completions.create({
          model: this.model,
          messages: [{
            role: 'user',
            content: `Clean and normalize these business leads. 
For each lead:
- Normalize phone numbers to international format
- Clean business names (remove extra spaces, fix capitalization)
- Standardize city/state names
- Fix email formatting
- Remove placeholder data like "N/A", "null", "unknown"

Return the cleaned array as JSON with same structure.

Leads: ${JSON.stringify(batch)}`,
          }],
          temperature: 0.1,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        });

        const text = response.choices[0]?.message?.content || '{"leads":[]}';
        const parsed = JSON.parse(text);
        const batchCleaned = Array.isArray(parsed) ? parsed : (parsed.leads || batch);
        cleaned.push(...batchCleaned);
      } catch (err) {
        logger.warn(`AI cleaning error: ${err.message}`);
        cleaned.push(...batch); // use original if AI fails
      }
    }

    return cleaned;
  }

  // ── Preprocess HTML for AI ─────────────────────────────────────
  preprocessHtml(html, maxLength = 3000) {
    // Remove scripts and styles
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Prioritize content with contact info
    const lines = text.split(' ');
    const contactLines = [];
    const otherLines = [];

    for (const line of lines) {
      const isContact = /(@|phone|email|tel|contact|whatsapp|instagram|linkedin|facebook|\d{10}|\+\d)/i.test(line);
      if (isContact) contactLines.push(line);
      else otherLines.push(line);
    }

    const prioritized = [...contactLines, ...otherLines].join(' ');
    return prioritized.substring(0, maxLength);
  }

  chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
