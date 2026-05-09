# 🏋️ LeadForge — Gym & Fitness India (Railway Deploy)

## What gets scraped
- **Niches**: Gym, Fitness Center, CrossFit, Yoga, Zumba, Pilates, Martial Arts, Boxing, Personal Trainer, Aerobics, Weight Loss, Health Club, Swimming Pool
- **Sequence**: Rajasthan first → Delhi/NCR → Mumbai/Pune → Bangalore → Chennai → Hyderabad → Kerala
- **Per city**: JustDial, Sulekha, IndiaMart, YellowPages India + Bing/DuckDuckGo queries
- **Per pincode**: 5 pin codes per city scraped individually for hyper-local results
- **Saves**: `leads.csv` every 60 seconds — download at `/leads.csv`

---

## Step 1 — Push to GitHub

```powershell
cd "C:\Users\dudi8\OneDrive\Desktop\leads\backend"
git add .
git commit -m "Gym fitness India scraper"
git remote add origin https://github.com/YOUR_USERNAME/leadforge-gym.git
git push -u origin main
```

## Step 2 — Deploy on Railway

1. Go to **https://railway.app** → New Project → Deploy from GitHub
2. Select your repo → set **Root Directory**: `/backend`

## Step 3 — Railway Environment Variables

Set these in Railway → your service → **Variables** tab:

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | `sk-proj-...your key...` |
| `AUTO_START` | `true` |
| `PLAYWRIGHT_ENABLED` | `false` |
| `SCRAPE_NICHES` | `gym,fitness center,crossfit,yoga studio,zumba,pilates,martial arts,boxing gym,personal trainer,aerobics,weight loss center,health club,swimming pool` |
| `SCRAPE_STATES` | `Rajasthan,Delhi,Uttar Pradesh,Maharashtra,Karnataka,Tamil Nadu,Telangana,Andhra Pradesh,Kerala` |
| `SCRAPE_CITIES` | `Jaipur,Udaipur,Jodhpur,Ajmer,Kota,Bikaner,New Delhi,Noida,Greater Noida,Mumbai,Pune,Thane,Bangalore,Mysore,Chennai,Coimbatore,Madurai,Hyderabad,Visakhapatnam,Vijayawada,Kochi,Thiruvananthapuram` |
| `SCRAPE_COUNTRY` | `India` |
| `MAX_CONCURRENCY` | `8` |
| `NODE_ENV` | `production` |

## Step 4 — Monitor & Download

- **Status**: `https://your-app.railway.app/`
- **Download leads**: `https://your-app.railway.app/leads.csv`

```bash
# Download CSV from anywhere
curl https://your-app.railway.app/leads.csv -o gym_leads_india.csv
```

---

## CSV Columns

| Column | Example |
|--------|---------|
| Business Name | Gold's Gym Jaipur |
| Phone | +91-9876543210 |
| WhatsApp | +919876543210 |
| Email | info@goldsgymjaipur.com |
| Website | https://goldsgymjaipur.com |
| Instagram | https://instagram.com/goldsgymjaipur |
| Facebook | https://facebook.com/goldsgymjaipur |
| LinkedIn | https://linkedin.com/company/goldsgym |
| City | Jaipur |
| State | Rajasthan |
| Country | India |
| PIN Code | 302001 |
| Lead Score | 85 |
| Source URL | https://justdial.com/... |

---

## How Much Will $5 Get You?

- Railway ~$0.000463/min → **~7 days** of continuous scraping
- Per city: ~50–500 leads depending on niche density
- **30 cities × 13 niches × 5 pin codes** = massive coverage
- Estimated total: **20,000–100,000+ gym/fitness leads**
