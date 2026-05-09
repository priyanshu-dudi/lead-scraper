"""
LeadForge Ultimate — Python Scrapy Spider Collection
Fast HTML-based crawling for business directories
"""
import scrapy
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
import json
import re
import csv
import os
from datetime import datetime

# ── Regex patterns ─────────────────────────────────────────────────
EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
PHONE_RE = re.compile(r'(?:\+?\d{1,3}[\s\-\.]?)?\(?\d{3,5}\)?[\s\-\.]?\d{3,5}[\s\-\.]?\d{3,6}')
LINKEDIN_RE = re.compile(r'https?://(?:www\.)?linkedin\.com/(?:in|company)/[a-zA-Z0-9\-_%]+')
INSTAGRAM_RE = re.compile(r'https?://(?:www\.)?instagram\.com/[a-zA-Z0-9_.]+')
FACEBOOK_RE = re.compile(r'https?://(?:www\.)?(?:facebook|fb)\.com/[a-zA-Z0-9.]+')
WHATSAPP_RE = re.compile(r'https?://(?:api\.whatsapp\.com|wa\.me)/(?:\+?[\d]+)')


class BusinessDirectorySpider(scrapy.Spider):
    """Generic business directory spider"""
    name = 'business_directory'
    custom_settings = {
        'DOWNLOAD_DELAY': 1.5,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'CONCURRENT_REQUESTS': 8,
        'ROBOTSTXT_OBEY': True,
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 1,
        'AUTOTHROTTLE_MAX_DELAY': 5,
        'RETRY_TIMES': 3,
        'HTTPERROR_ALLOWED_CODES': [404, 403],
    }

    def __init__(self, urls=None, niche='general', location='', *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_urls = urls or []
        self.niche = niche
        self.location = location
        self.leads = []
        self.output_file = f'exports/scrapy_{niche}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        os.makedirs('exports', exist_ok=True)

    def parse(self, response):
        """Parse directory listing pages"""
        # Extract all links to business detail pages
        business_links = response.css('a[href]::attr(href)').getall()

        for link in business_links:
            absolute_url = response.urljoin(link)
            # Follow contact/detail pages
            if any(p in absolute_url.lower() for p in ['/biz/', '/business/', '/listing/', '/company/', '/profile/']):
                yield response.follow(absolute_url, callback=self.parse_business)

        # Follow pagination
        next_page = response.css('a[aria-label="Next"]::attr(href), a.next::attr(href), [rel="next"]::attr(href)').get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)

    def parse_business(self, response):
        """Parse individual business page"""
        html = response.text

        lead = {
            'business_name': self._extract_name(response),
            'email': self._extract_first(EMAIL_RE, html),
            'phone': self._extract_first(PHONE_RE, html),
            'linkedin_url': self._extract_first(LINKEDIN_RE, html),
            'instagram_url': self._extract_first(INSTAGRAM_RE, html),
            'facebook_url': self._extract_first(FACEBOOK_RE, html),
            'whatsapp': self._extract_first(WHATSAPP_RE, html),
            'website_url': response.url,
            'niche': self.niche,
            'source_url': response.url,
        }

        # Schema.org extraction
        schema_data = response.css('script[type="application/ld+json"]::text').getall()
        for schema in schema_data:
            try:
                data = json.loads(schema)
                if isinstance(data, dict) and 'LocalBusiness' in str(data.get('@type', '')):
                    addr = data.get('address', {})
                    lead.update({
                        'business_name': data.get('name') or lead['business_name'],
                        'phone': data.get('telephone') or lead['phone'],
                        'email': data.get('email') or lead['email'],
                        'city': addr.get('addressLocality'),
                        'state': addr.get('addressRegion'),
                        'country': addr.get('addressCountry'),
                        'pin_code': addr.get('postalCode'),
                    })
            except:
                pass

        # Only yield if has useful data
        if lead.get('email') or lead.get('phone'):
            self.leads.append(lead)
            yield lead

    def _extract_name(self, response):
        return (
            response.css('h1::text').get('').strip() or
            response.css('meta[property="og:site_name"]::attr(content)').get('').strip() or
            response.css('title::text').get('').split(' - ')[0].strip()
        )

    def _extract_first(self, pattern, text):
        match = pattern.search(text)
        return match.group(0) if match else None

    def closed(self, reason):
        """Save leads to JSON on spider close"""
        if self.leads:
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(self.leads, f, ensure_ascii=False, indent=2)
            print(f"✅ Saved {len(self.leads)} leads to {self.output_file}")


class YelpSpider(scrapy.Spider):
    """Yelp business listing spider"""
    name = 'yelp'
    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'ROBOTSTXT_OBEY': True,
        'USER_AGENT': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15',
    }

    def __init__(self, niche='restaurant', location='New York', *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.niche = niche
        self.location = location
        self.start_urls = [
            f'https://www.yelp.com/search?find_desc={niche}&find_loc={location}'
        ]

    def parse(self, response):
        # Extract business cards
        for card in response.css('[class*="businessName"]'):
            name = card.css('a::text').get('').strip()
            link = card.css('a::attr(href)').get('')
            if name and link:
                yield response.follow(link, callback=self.parse_business, meta={'name': name})

        # Next page
        next_page = response.css('a[aria-label="Next"]::attr(href)').get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)

    def parse_business(self, response):
        html = response.text
        yield {
            'business_name': response.meta.get('name'),
            'phone': PHONE_RE.search(html) and PHONE_RE.search(html).group(0),
            'website_url': response.css('a[href*="biz_redir"]::attr(href)').get(),
            'source_url': response.url,
            'niche': self.niche,
        }


def run_spider(niche, location, urls):
    """Run the Scrapy spider programmatically"""
    process = CrawlerProcess({
        'LOG_LEVEL': 'WARNING',
        'FEEDS': {
            f'exports/scrapy_{niche}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json': {
                'format': 'json',
                'overwrite': True,
            }
        }
    })

    process.crawl(BusinessDirectorySpider, urls=urls, niche=niche, location=location)
    process.start()


if __name__ == '__main__':
    import sys
    niche = sys.argv[1] if len(sys.argv) > 1 else 'dentist'
    location = sys.argv[2] if len(sys.argv) > 2 else 'India'
    urls = sys.argv[3:] or [f'https://www.yelp.com/search?find_desc={niche}&find_loc={location}']
    run_spider(niche, location, urls)
