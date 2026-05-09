// ============================================================
// LeadForge — India Gym/Fitness Search Discovery Engine
// Generates hyper-local, area-specific search URLs
// Priority order: Rajasthan → Delhi/NCR → Mumbai → South India
// ============================================================
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_PATH = path.join(__dirname, '../../config/locations.json');

// ── India-specific directory URL generators ─────────────────
const INDIA_DIRECTORIES = {
  justdial: (niche, city) =>
    `https://www.justdial.com/${city.replace(/\s/g, '-')}/${niche.replace(/\s/g, '-')}/nct-10000045`,

  sulekha: (niche, city) =>
    `https://www.sulekha.com/${niche.replace(/\s/g, '-')}/${city.replace(/\s/g, '-').toLowerCase()}`,

  indiamart: (niche, city) =>
    `https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(niche)}&city=${encodeURIComponent(city)}`,

  urbanpro: (niche, city) =>
    `https://www.urbanpro.com/find-tutors/${encodeURIComponent(niche)}/${encodeURIComponent(city)}`,

  practo: (niche, city) =>
    `https://www.practo.com/${city.toLowerCase()}/fitness`,

  gymbusiness: (niche, city) =>
    `https://www.gymbusiness.in/gyms/${city.toLowerCase().replace(/\s/g, '-')}`,

  yellowpagesindia: (niche, city) =>
    `https://www.yellowpages.in/${city.replace(/\s/g, '-').toLowerCase()}/${niche.replace(/\s/g, '-').toLowerCase()}`,

  asklaila: (niche, city) =>
    `https://www.asklaila.com/${city}/${niche.replace(/\s/g, '+')}/`,

  tradeindia: (niche, city) =>
    `https://www.tradeindia.com/search.html?q=${encodeURIComponent(niche + ' ' + city)}`,

  zaubacorp: (niche, city) =>
    `https://www.zaubacorp.com/company-list/${encodeURIComponent(niche)}/${encodeURIComponent(city)}`,
};

// ── Search engine query builders ────────────────────────────
async function searchDuckDuckGo(query) {
  try {
    const resp = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 12000,
    });
    const urls = [];
    const rx = /href="(https?:\/\/[^"]+)"/g;
    let m;
    while ((m = rx.exec(resp.data)) !== null) {
      const u = m[1];
      if (!u.includes('duckduckgo.com') && !u.includes('google.com')) urls.push(u);
    }
    return [...new Set(urls)].slice(0, 12);
  } catch { return []; }
}

async function searchBing(query) {
  try {
    const resp = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&mkt=en-IN`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 12000,
    });
    const urls = [];
    const rx = /href="(https?:\/\/[^"&]+)"/g;
    let m;
    while ((m = rx.exec(resp.data)) !== null) {
      const u = m[1];
      if (!u.includes('bing.com') && !u.includes('microsoft.com')) urls.push(u);
    }
    return [...new Set(urls)].slice(0, 12);
  } catch { return []; }
}

export class SearchDiscovery {
  constructor() {
    this.locationsDb = this._loadLocations();
  }

  _loadLocations() {
    if (existsSync(LOCATIONS_PATH)) {
      return JSON.parse(readFileSync(LOCATIONS_PATH, 'utf-8'));
    }
    return null;
  }

  // ── Main entry point ──────────────────────────────────────
  async generateSeedUrls(niches, locations) {
    const urls = [];

    // If we have the full locations DB, use area-specific mode
    if (this.locationsDb) {
      // Priority order: Rajasthan → Delhi → Maharashtra
      const stateOrder = ['Rajasthan', 'Delhi', 'Maharashtra'];

      for (const stateName of stateOrder) {
        const stateData = this.locationsDb.states[stateName];
        if (!stateData) continue;

        for (const cityObj of stateData.cities) {
          const city = cityObj.name;
          const pinCodes = cityObj.pinCodes || [];

          for (const niche of niches) {
            const keywords = niche.keywords || [niche.label || niche.id];
            const primaryKeyword = keywords[0];

            // 1. India directory URLs for this city
            for (const [dir, fn] of Object.entries(INDIA_DIRECTORIES)) {
              try {
                urls.push({ url: fn(primaryKeyword, city), engine: 'httpx', priority: 9, city, state: stateName });
              } catch {}
            }

            // 2. Search engine queries — city specific
            const queries = this._buildIndiaQueries(primaryKeyword, city, stateName);
            for (const query of queries.slice(0, 2)) {
              const results = await searchDuckDuckGo(query);
              results.forEach(url => urls.push({ url, engine: 'httpx', priority: 7, city, state: stateName }));
            }

            // 3. Pin code specific queries (for top 5 pin codes per city)
            for (const pin of pinCodes.slice(0, 5)) {
              const pinQuery = `${primaryKeyword} ${pin} contact email phone`;
              const pinResults = await searchBing(pinQuery);
              pinResults.slice(0, 5).forEach(url =>
                urls.push({ url, engine: 'httpx', priority: 8, city, state: stateName, pinCode: pin })
              );
            }
          }
        }
      }
    } else {
      // Fallback: use passed locations
      const locationStr = [
        ...(locations?.cities || []),
        ...(locations?.states || []),
        ...(locations?.countries || []),
      ].join(', ');

      for (const niche of niches) {
        const keyword = (niche.keywords || [niche.id])[0];
        const queries = this._buildIndiaQueries(keyword, locationStr, 'India');
        for (const query of queries.slice(0, 3)) {
          const r1 = await searchDuckDuckGo(query);
          const r2 = await searchBing(query);
          [...r1, ...r2].forEach(url => urls.push({ url, engine: 'httpx', priority: 7 }));
        }
      }
    }

    logger.info(`🗺️  Generated ${urls.length} area-specific seed URLs across India`);
    return this._dedup(urls);
  }

  // ── Build India-specific search queries ──────────────────
  _buildIndiaQueries(keyword, city, state) {
    return [
      `${keyword} in ${city} ${state} contact number email`,
      `best ${keyword} ${city} phone whatsapp`,
      `${keyword} ${city} site:justdial.com OR site:sulekha.com`,
      `"${keyword}" "${city}" email OR phone OR whatsapp`,
      `${keyword} ${city} ${state} address pincode`,
      `top ${keyword} centers ${city} contact details`,
    ];
  }

  // ── Deduplicate ───────────────────────────────────────────
  _dedup(urls) {
    const seen = new Set();
    return urls.filter(item => {
      const u = typeof item === 'string' ? item : item.url;
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }

  // ── Legacy compatibility ──────────────────────────────────
  buildSearchQueries(niche, location) {
    return this._buildIndiaQueries(niche, location, 'India');
  }

  deduplicateUrls(urls) {
    return this._dedup(urls);
  }
}
