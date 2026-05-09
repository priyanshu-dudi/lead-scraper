# 🚀 LeadForge Ultimate — AI-Powered Lead Scraping System

A powerful, locally-running AI lead scraping system combining the best open-source web scraping tools, browser automation, AI extraction, and contact discovery into one unified application.

---

## 📁 Project Structure

```
leadforge-ultimate/
├── frontend/          # React + Vite + Tailwind dashboard
├── backend/           # Node.js API server
├── scrapers/          # Individual scraper modules (Python)
├── engines/           # Core crawling engines
├── ai/                # AI extraction & cleaning modules
├── exports/           # Generated CSV/JSON files
├── logs/              # Scraping logs
├── config/            # Configuration files
├── scripts/           # Utility & startup scripts
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.10+ |
| npm | 9+ |
| pip | 23+ |

### 1. Install All Dependencies

```bash
# Run the master setup script
node scripts/setup.js
```

Or manually:

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install

# Python scrapers
pip install -r requirements.txt

# Install Playwright browsers
npx playwright install chromium firefox
```

### 2. Configure Environment

```bash
cp config/.env.example config/.env
# Edit config/.env and add your OpenAI API key
```

### 3. Start the System

```bash
# Start everything (backend + frontend)
node scripts/start-all.js
```

Or separately:

```bash
# Terminal 1 — Backend API
cd backend && npm run dev

# Terminal 2 — Frontend Dashboard
cd frontend && npm run dev
```

Open: **http://localhost:5173**

---

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `BACKEND_PORT` | API server port (default: 3001) | No |
| `MAX_CONCURRENCY` | Parallel scrapers (default: 5) | No |
| `USE_PROXY` | Enable proxy rotation | No |
| `PROXY_LIST` | Comma-separated proxy URLs | No |

---

## 🧠 Architecture Overview

```
Dashboard (React/Vite)
       ↓
Backend API (Node.js/Express)
       ↓
Scraping Orchestrator
    ├── Browser Automation (Playwright/Puppeteer/Selenium)
    ├── Fast HTTP Crawling (HTTPX/Scrapy/BeautifulSoup)
    ├── AI Extraction (OpenAI/LangChain/Crawl4AI)
    └── Search Discovery (Multi-source search)
       ↓
AI Processing Pipeline
    ├── Data Cleaning
    ├── Contact Detection
    ├── Deduplication
    └── Lead Scoring
       ↓
Storage (CSV/JSON/SQLite)
```

---

## 📊 Lead Fields Collected

- Business Name, Owner Name
- Phone, WhatsApp, Email
- LinkedIn, Instagram, Facebook, Telegram
- Website URL
- City, State, Country, PIN Code
- Category/Niche
- Lead Score (0-100)
- Source URL

---

## 🎯 Supported Niches

Dentists, Restaurants, Real Estate, Gyms, Hotels, Salons, Lawyers, E-commerce, Agencies, SaaS, Startups, Local Businesses, and any custom niche.

---

## 🌍 Geographic Targeting

- Country, State, City
- Multiple PIN codes
- Radius targeting
- Multi-location scraping

---

## ⚖️ Legal & Ethical Use

- Only scrapes publicly available data
- Respects robots.txt
- Uses reasonable rate limits
- No private/protected information
- Personal use only

---

## 📄 License

Personal use only. Not for redistribution.
