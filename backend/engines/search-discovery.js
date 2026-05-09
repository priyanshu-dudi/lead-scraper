// ============================================================
// LeadForge — India Gym/Fitness Search Discovery Engine
// Generates direct Indian business directory URLs (no search
// engine dependency — works on Railway cloud IPs)
// Priority: Rajasthan → Delhi → Maharashtra
// ============================================================
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Look for locations.json inside backend/config/ (bundled with Railway upload)
const LOCATIONS_PATHS = [
  path.join(__dirname, '../config/locations.json'),   // backend/config/ (Railway)
  path.join(__dirname, '../../config/locations.json'), // project root (local)
];

// ── Gym-focused search keywords ─────────────────────────────
const GYM_KEYWORDS = [
  'gym', 'fitness center', 'fitness club', 'crossfit', 'yoga studio',
  'zumba classes', 'pilates', 'martial arts academy', 'boxing gym',
  'personal trainer', 'aerobics', 'weight loss center', 'health club',
  'sports academy', 'swimming pool fitness',
];

// ── India business directory URL generators ─────────────────
function buildDirectoryUrls(keyword, city, state) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const kwSlug = keyword.toLowerCase().replace(/\s+/g, '-');
  const kwEncoded = encodeURIComponent(keyword);
  const cityEncoded = encodeURIComponent(city);

  return [
    // JustDial — largest Indian directory
    `https://www.justdial.com/${citySlug}/${kwSlug}`,
    `https://www.justdial.com/${citySlug}/${kwSlug}-in-${citySlug}`,

    // Sulekha
    `https://www.sulekha.com/${kwSlug}/${citySlug}`,

    // IndiaMart
    `https://dir.indiamart.com/search.mp?ss=${kwEncoded}&city=${cityEncoded}`,

    // YellowPages India
    `https://www.yellowpages.in/${citySlug}/${kwSlug}`,

    // AskLaila
    `https://www.asklaila.com/${city}/${keyword.replace(/\s/g, '+')}/`,

    // UrbanPro
    `https://www.urbanpro.com/gyms-fitness-centres/${citySlug}`,

    // TradeIndia
    `https://www.tradeindia.com/search.html?q=${kwEncoded}+${cityEncoded}`,

    // ClickIndia
    `https://www.clickindia.com/services/${kwSlug}/${citySlug}/`,

    // Hotfrog India
    `https://www.hotfrog.in/${citySlug}/${kwSlug}`,
  ];
}

// ── Bing search (more cloud-friendly than DDG) ───────────────
async function searchBing(query) {
  try {
    const resp = await axios.get(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&mkt=en-IN`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
        timeout: 15000,
      }
    );
    const urls = [];
    const rx = /href="(https?:\/\/[^"&]+)"/g;
    let m;
    while ((m = rx.exec(resp.data)) !== null) {
      const u = m[1];
      if (
        !u.includes('bing.com') && !u.includes('microsoft.com') &&
        !u.includes('msn.com') && !u.includes('goo.gl')
      ) urls.push(u);
    }
    return [...new Set(urls)].slice(0, 10);
  } catch { return []; }
}

export class SearchDiscovery {
  constructor() {
    this.locationsDb = this._loadLocations();
  }

  _loadLocations() {
    for (const p of LOCATIONS_PATHS) {
      if (existsSync(p)) {
        logger.info(`Loaded locations from: ${p}`);
        return JSON.parse(readFileSync(p, 'utf-8'));
      }
    }
    logger.warn('locations.json not found — using env-based locations');
    return null;
  }

  // ── Main entry point ──────────────────────────────────────
  async generateSeedUrls(niches, locations) {
    const urls = [];

    if (this.locationsDb) {
      // ── Full mode: use locations DB with all cities + pin codes ──
      const stateOrder = ['Rajasthan', 'Delhi', 'Maharashtra'];

      for (const stateName of stateOrder) {
        const stateData = this.locationsDb.states[stateName];
        if (!stateData) continue;
        logger.info(`📍 Building URLs for ${stateName} (${stateData.cities.length} cities)`);

        for (const cityObj of stateData.cities) {
          const city = cityObj.name;
          const pinCodes = cityObj.pinCodes || [];

          for (const keyword of GYM_KEYWORDS) {
            // 1. Direct directory URLs (always work, no bot detection)
            const dirUrls = buildDirectoryUrls(keyword, city, stateName);
            dirUrls.forEach(url => urls.push({ url, engine: 'httpx', priority: 9, city, state: stateName }));
            
            // Add pin codes as standard search strings (no slow Bing blocking)
            for (const pin of pinCodes.slice(0, 2)) {
               urls.push({ url: `https://www.justdial.com/${city.toLowerCase()}/${keyword.toLowerCase().replace(/ /g, '-')}-${pin}`, engine: 'httpx', priority: 8, city, state: stateName, pinCode: pin });
            }
          }
        }
      }
    } else {
      // ── Fallback: use passed locations from ENV ───────────────
      const cities = locations?.cities || [];
      const states = locations?.states || [];
      const country = (locations?.countries || ['India'])[0];

      logger.info(`Fallback mode: ${cities.length} cities, ${states.length} states`);

      for (const city of cities) {
        for (const keyword of GYM_KEYWORDS) {
          const dirUrls = buildDirectoryUrls(keyword, city, country);
          dirUrls.forEach(url => urls.push({ url, engine: 'httpx', priority: 8, city, state: '' }));
        }
      }
    }

    logger.info(`🗺️  Generated ${urls.length} seed URLs`);
    return this._dedup(urls);
  }

  // ── Build search queries ──────────────────────────────────
  _buildIndiaQueries(keyword, city, state) {
    return [
      `"${keyword}" "${city}" contact number email India`,
      `best ${keyword} ${city} ${state} phone whatsapp`,
      `${keyword} ${city} address pincode India`,
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

  // Legacy compat
  buildSearchQueries(k, l) { return this._buildIndiaQueries(k, l, 'India'); }
  deduplicateUrls(u) { return this._dedup(u); }
}
