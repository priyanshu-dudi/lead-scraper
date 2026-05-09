"""
LeadForge Ultimate — BeautifulSoup Fast Scraper
Used for static HTML pages, sitemaps, and contact pages
"""
import requests
from bs4 import BeautifulSoup
import re
import json
import os
from urllib.parse import urljoin, urlparse
from datetime import datetime
import random
import time

# User agents pool
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
]

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
PHONE_RE = re.compile(r'(?:\+?\d{1,3}[\s\-.]?)?\(?\d{3,5}\)?[\s\-.]?\d{3,5}[\s\-.]?\d{3,6}')
LINKEDIN_RE = re.compile(r'https?://(?:www\.)?linkedin\.com/(?:in|company)/[a-zA-Z0-9\-_%]+')
INSTAGRAM_RE = re.compile(r'https?://(?:www\.)?instagram\.com/[a-zA-Z0-9_.]+')
FACEBOOK_RE = re.compile(r'https?://(?:www\.)?(?:facebook|fb)\.com/[a-zA-Z0-9.]+')
WHATSAPP_RE = re.compile(r'https?://(?:api\.whatsapp\.com|wa\.me)/(?:\+?[\d]+)')


def get_session():
    session = requests.Session()
    session.headers.update({
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
    })
    return session


def extract_from_page(html: str, url: str, niche: str = '') -> dict:
    """Extract lead data from HTML using BeautifulSoup"""
    soup = BeautifulSoup(html, 'lxml')
    text = soup.get_text(' ')

    # Schema.org extraction first
    lead = extract_schema_org(soup, url)

    # Fallback: regex
    if not lead.get('email'):
        emails = EMAIL_RE.findall(text)
        valid_emails = [e for e in emails if not any(x in e for x in ['example.com', 'domain.com'])]
        lead['email'] = valid_emails[0] if valid_emails else None

    if not lead.get('phone'):
        phones = PHONE_RE.findall(text)
        valid_phones = [p for p in phones if len(re.sub(r'\D', '', p)) >= 7]
        lead['phone'] = valid_phones[0].strip() if valid_phones else None

    lead.setdefault('linkedin_url', LINKEDIN_RE.search(html) and LINKEDIN_RE.search(html).group(0))
    lead.setdefault('instagram_url', INSTAGRAM_RE.search(html) and INSTAGRAM_RE.search(html).group(0))
    lead.setdefault('facebook_url', FACEBOOK_RE.search(html) and FACEBOOK_RE.search(html).group(0))
    lead.setdefault('whatsapp', WHATSAPP_RE.search(html) and WHATSAPP_RE.search(html).group(0))

    if not lead.get('business_name'):
        h1 = soup.find('h1')
        og_site = soup.find('meta', property='og:site_name')
        title = soup.find('title')
        lead['business_name'] = (
            h1.get_text().strip() if h1 else
            og_site.get('content', '').strip() if og_site else
            title.get_text().split(' - ')[0].strip() if title else None
        )

    lead['niche'] = niche
    lead['source_url'] = url
    lead['website_url'] = lead.get('website_url') or url

    return lead


def extract_schema_org(soup, url):
    """Extract from JSON-LD schema markup"""
    lead = {}
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            if not isinstance(data, dict):
                continue
            schema_type = str(data.get('@type', ''))
            business_types = ['LocalBusiness', 'Restaurant', 'Store', 'Organization',
                              'MedicalBusiness', 'Hotel', 'Gym', 'DentistOffice']
            if any(t in schema_type for t in business_types):
                addr = data.get('address', {})
                lead = {
                    'business_name': data.get('name'),
                    'phone': data.get('telephone'),
                    'email': data.get('email'),
                    'website_url': data.get('url', url),
                    'city': addr.get('addressLocality'),
                    'state': addr.get('addressRegion'),
                    'country': addr.get('addressCountry'),
                    'pin_code': addr.get('postalCode'),
                }
                # Social media from sameAs
                same_as = data.get('sameAs', [])
                for social in same_as:
                    if 'linkedin.com' in social:
                        lead['linkedin_url'] = social
                    elif 'instagram.com' in social:
                        lead['instagram_url'] = social
                    elif 'facebook.com' in social:
                        lead['facebook_url'] = social
                break
        except:
            pass
    return lead


def scrape_sitemap(base_url: str, session=None) -> list:
    """Scrape sitemap.xml to discover pages"""
    if not session:
        session = get_session()

    urls = []
    sitemap_urls = [
        f"{base_url}/sitemap.xml",
        f"{base_url}/sitemap_index.xml",
        f"{base_url}/sitemap/",
    ]

    for sitemap_url in sitemap_urls:
        try:
            resp = session.get(sitemap_url, timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'xml')
                locs = soup.find_all('loc')
                urls.extend(loc.get_text().strip() for loc in locs)
                break
        except:
            pass

    return urls


def batch_scrape(urls: list, niche: str = '', delay: float = 1.5) -> list:
    """Scrape multiple URLs and extract leads"""
    session = get_session()
    leads = []

    for i, url in enumerate(urls):
        try:
            print(f"[{i+1}/{len(urls)}] Scraping: {url[:80]}")
            resp = session.get(url, timeout=20)
            if resp.status_code == 200:
                lead = extract_from_page(resp.text, url, niche)
                if lead.get('email') or lead.get('phone'):
                    leads.append(lead)
                    print(f"  ✅ Found: {lead.get('business_name') or lead.get('email')}")

            # Randomized delay
            time.sleep(delay + random.uniform(0, 1))

        except Exception as e:
            print(f"  ❌ Error: {e}")

    return leads


if __name__ == '__main__':
    import sys
    urls = sys.argv[1:] or ['https://example.com']
    niche = 'general'
    leads = batch_scrape(urls, niche)

    output = f'exports/bs4_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    os.makedirs('exports', exist_ok=True)
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Saved {len(leads)} leads → {output}")
