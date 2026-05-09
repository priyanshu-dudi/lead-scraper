# 🚀 LeadForge — Deploy to Railway via CLI (No GitHub needed)

## What gets scraped
- **Niches**: Gym, Fitness Center, CrossFit, Yoga, Zumba, Pilates, Martial Arts, Boxing, Personal Trainer, Aerobics, Weight Loss, Health Club, Swimming Pool
- **Sequence**: Rajasthan → Delhi → Maharashtra
- **Per city**: JustDial, Sulekha, IndiaMart, YellowPages India + Bing/DuckDuckGo
- **Per pincode**: 5 pin codes per city for hyper-local results
- **Auto-saves**: `leads.csv` every 60 seconds → download at `/leads.csv`

---

## Step 1 — Install Railway CLI

Open PowerShell and run:

```powershell
npm install -g @railway/cli
```

Verify it works:
```powershell
railway --version
```

---

## Step 2 — Login to Railway

```powershell
railway login
```

This opens your browser → sign in with Google/Email → done. **No GitHub connection needed.**

---

## Step 3 — Create a new Railway project

```powershell
cd "C:\Users\dudi8\OneDrive\Desktop\leads\backend"
railway init
```

When prompted:
- **Project name**: `leadforge-gym`
- **Environment**: `production`

---

## Step 4 — Set Environment Variables

Copy and run each line (replace the API key with yours):

```powershell
railway variables set OPENAI_API_KEY="sk-proj-your-key-here"
railway variables set AUTO_START="true"
railway variables set PLAYWRIGHT_ENABLED="false"
railway variables set SCRAPE_COUNTRY="India"
railway variables set SCRAPE_STATES="Rajasthan,Delhi,Maharashtra"
railway variables set SCRAPE_CITIES="Jaipur,Udaipur,Jodhpur,Ajmer,Kota,Bikaner,Alwar,Bhilwara,Sikar,Chittorgarh,Bharatpur,New Delhi,Dwarka,Rohini,Pitampura,Janakpuri,Saket,Vasant Kunj,Karol Bagh,Punjabi Bagh,Mumbai,Pune,Thane,Navi Mumbai,Nagpur,Nashik,Aurangabad"
railway variables set SCRAPE_NICHES="gym,fitness center,crossfit,yoga studio,zumba,pilates,martial arts,boxing gym,personal trainer,aerobics,weight loss center,health club,swimming pool"
railway variables set MAX_CONCURRENCY="8"
railway variables set CRAWL_DEPTH="3"
railway variables set USE_AI_EXTRACTION="true"
railway variables set OPENAI_MODEL="gpt-4o-mini"
railway variables set NODE_ENV="production"
```

---

## Step 5 — Deploy

```powershell
railway up
```

Railway uploads your local `backend/` folder directly and deploys it. Takes ~2 minutes.

---

## Step 6 — Get your public URL

```powershell
railway domain
```

Or open the Railway dashboard:
```powershell
railway open
```

---

## Download Your Leads (anytime)

```powershell
# Replace with your actual Railway URL
curl https://leadforge-gym.up.railway.app/leads.csv -o gym_leads.csv
```

Or just open it in your browser — it downloads automatically.

---

## Monitor Live

```powershell
# Stream live logs
railway logs --follow
```

---

## Re-deploy after code changes

```powershell
cd "C:\Users\dudi8\OneDrive\Desktop\leads\backend"
railway up
```

---

## Environment Variables Reference

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI key |
| `AUTO_START` | `true` |
| `PLAYWRIGHT_ENABLED` | `false` |
| `SCRAPE_COUNTRY` | `India` |
| `SCRAPE_STATES` | `Rajasthan,Delhi,Maharashtra` |
| `SCRAPE_CITIES` | `Jaipur,Udaipur,Jodhpur,Ajmer,Kota,Bikaner,Alwar,Bhilwara,Sikar,Chittorgarh,Bharatpur,New Delhi,Dwarka,Rohini,Pitampura,Janakpuri,Saket,Vasant Kunj,Karol Bagh,Punjabi Bagh,Mumbai,Pune,Thane,Navi Mumbai,Nagpur,Nashik,Aurangabad` |
| `SCRAPE_NICHES` | `gym,fitness center,crossfit,yoga studio,zumba,pilates,martial arts,boxing gym,personal trainer,aerobics,weight loss center,health club,swimming pool` |
| `MAX_CONCURRENCY` | `8` |
| `CRAWL_DEPTH` | `3` |
| `USE_AI_EXTRACTION` | `true` |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `NODE_ENV` | `production` |
