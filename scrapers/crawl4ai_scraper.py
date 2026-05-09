"""
LeadForge Ultimate — AI-Powered Crawl4AI Scraper
Uses crawl4ai for intelligent web crawling with AI extraction
"""
import asyncio
import json
import os
import re
from datetime import datetime

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
PHONE_RE = re.compile(r'(?:\+?\d{1,3}[\s\-]?)?\(?\d{3,5}\)?[\s\-]?\d{3,5}[\s\-]?\d{3,6}')


async def crawl_with_ai(urls: list, niche: str = 'general', use_openai: bool = False):
    """
    Crawl URLs using crawl4ai with optional AI extraction.
    Falls back to regex-based extraction if AI is not configured.
    """
    try:
        from crawl4ai import AsyncWebCrawler
        from crawl4ai.extraction_strategy import LLMExtractionStrategy
    except ImportError:
        print("crawl4ai not installed. Run: pip install crawl4ai")
        return []

    leads = []
    openai_key = os.getenv('OPENAI_API_KEY', '')
    has_ai = use_openai and openai_key and not openai_key.startswith('sk-your')

    extraction_strategy = None
    if has_ai:
        try:
            extraction_strategy = LLMExtractionStrategy(
                provider="openai/gpt-4o-mini",
                api_token=openai_key,
                schema={
                    "type": "object",
                    "properties": {
                        "businesses": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "business_name": {"type": "string"},
                                    "phone": {"type": "string"},
                                    "email": {"type": "string"},
                                    "city": {"type": "string"},
                                    "website": {"type": "string"},
                                }
                            }
                        }
                    }
                },
                instruction=f"Extract all {niche} business contact information from this page.",
            )
        except Exception as e:
            print(f"LLM strategy init failed: {e}")
            extraction_strategy = None

    async with AsyncWebCrawler(verbose=False) as crawler:
        for url in urls:
            try:
                result = await crawler.arun(
                    url=url,
                    extraction_strategy=extraction_strategy,
                    bypass_cache=True,
                )

                if result.success:
                    # Try AI-extracted data first
                    if extraction_strategy and result.extracted_content:
                        try:
                            data = json.loads(result.extracted_content)
                            businesses = data.get('businesses', [])
                            for biz in businesses:
                                if biz.get('email') or biz.get('phone'):
                                    leads.append({
                                        **biz,
                                        'niche': niche,
                                        'source_url': url,
                                        'extracted_by': 'crawl4ai_llm'
                                    })
                            continue
                        except:
                            pass

                    # Fallback: regex extraction on markdown
                    text = result.markdown or result.cleaned_html or ''
                    email_match = EMAIL_RE.search(text)
                    phone_match = PHONE_RE.search(text)

                    if email_match or phone_match:
                        leads.append({
                            'email': email_match.group(0) if email_match else None,
                            'phone': phone_match.group(0) if phone_match else None,
                            'website_url': url,
                            'source_url': url,
                            'niche': niche,
                            'extracted_by': 'crawl4ai_regex'
                        })

            except Exception as e:
                print(f"Crawl4AI error for {url}: {e}")

    return leads


async def main():
    import sys
    urls = sys.argv[1:] if len(sys.argv) > 1 else ['https://www.yelp.com/biz/sample']
    niche = 'dentist'
    leads = await crawl_with_ai(urls, niche, use_openai=True)
    
    output = f'exports/crawl4ai_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    os.makedirs('exports', exist_ok=True)
    with open(output, 'w') as f:
        json.dump(leads, f, indent=2)
    print(f"✅ Crawl4AI extracted {len(leads)} leads → {output}")


if __name__ == '__main__':
    asyncio.run(main())
