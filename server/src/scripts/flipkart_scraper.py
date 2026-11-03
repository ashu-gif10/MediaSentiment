#!/usr/bin/env python3
"""
Child process backend for Flipkart review extraction using the `flipkart-scraping` library.
Uses Scrape.do proxy integration (reading SCRAPEDO_TOKEN from env or argument).
Outputs structured JSON to stdout for Express backend consumption.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional

try:
    from flipkart_scraping import FlipkartScraper, ScrapeError, reviews_url, clean_product_url
except ImportError as imp_err:
    print(json.dumps({
        "success": False,
        "error": f"Missing python package 'flipkart-scraping': {imp_err}. Run 'pip install flipkart-scraping'.",
        "packageMissing": True,
        "reviews": []
    }))
    sys.exit(0)


def extract_reviews(url: str, token: Optional[str] = None, max_items: int = 50, max_pages: int = 3) -> Dict[str, Any]:
    resolved_token = (token or os.environ.get("SCRAPEDO_TOKEN", "")).strip()

    if not resolved_token:
        return {
            "success": False,
            "error": "Scrape.do token is missing. Configure 'SCRAPEDO_TOKEN' in your server/.env file to enable live scraping via the Scrape.do proxy.",
            "tokenMissing": True,
            "totalFetched": 0,
            "reviews": []
        }

    # Clean and check URL
    try:
        clean_url = clean_product_url(url)
    except Exception as e:
        clean_url = url

    try:
        # Validate review URL can be formed
        rev_url = reviews_url(clean_url)
    except ValueError as ve:
        return {
            "success": False,
            "error": f"Invalid Flipkart product URL: {ve}",
            "invalidUrl": True,
            "totalFetched": 0,
            "reviews": []
        }

    try:
        scraper = FlipkartScraper(
            token=resolved_token,
            geo_code="in",
            timeout=60.0,
            retries=1
        )

        # Attempt to get reviews
        # We limit max_pages to avoid burning credits on large products
        raw_reviews = scraper.get_reviews(
            product_url=clean_url,
            max_pages=max_pages,
            max_items=max_items
        )

        mapped_reviews: List[Dict[str, Any]] = []
        for r in raw_reviews:
            text = (r.get("text") or "").strip()
            if not text:
                continue

            rating_val = None
            raw_rating = r.get("rating")
            if raw_rating is not None and str(raw_rating).strip():
                try:
                    rating_val = float(raw_rating)
                except (ValueError, TypeError):
                    rating_val = None

            # Format author
            city = (r.get("city") or "").strip()
            state = (r.get("state") or "").strip()
            if city and state:
                author_str = f"Buyer from {city}, {state}"
            elif city:
                author_str = f"Buyer from {city}"
            elif r.get("verified_purchase"):
                author_str = "Certified Buyer"
            else:
                author_str = "Flipkart Customer"

            mapped_reviews.append({
                "review_id": str(r.get("review_id") or ""),
                "review_text": text,
                "rating": rating_val,
                "date": str(r.get("created") or ""),
                "author": author_str,
                "title": str(r.get("title") or "").strip(),
                "helpful": r.get("helpful", 0),
                "verified_purchase": bool(r.get("verified_purchase", False)),
                "found_via": str(r.get("found_via") or ""),
            })

        # Try to extract product title if possible
        product_title = None
        try:
            prod_info = scraper.get_product(clean_url)
            product_title = prod_info.get("title")
        except Exception:
            pass

        return {
            "success": True,
            "productUrl": clean_url,
            "productTitle": product_title,
            "totalFetched": len(mapped_reviews),
            "reviews": mapped_reviews
        }

    except ScrapeError as se:
        return {
            "success": False,
            "error": f"Scrape.do API error: {se}",
            "statusCode": getattr(se, "status_code", None),
            "totalFetched": 0,
            "reviews": []
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Scraping failed: {exc}",
            "totalFetched": 0,
            "reviews": []
        }


def main():
    parser = argparse.ArgumentParser(description="Scrape Flipkart reviews via flipkart-scraping & Scrape.do")
    parser.add_argument("--url", required=True, help="Flipkart product URL")
    parser.add_argument("--token", default=None, help="Scrape.do API token (defaults to SCRAPEDO_TOKEN env)")
    parser.add_argument("--max-items", type=int, default=50, help="Max reviews to return")
    parser.add_argument("--max-pages", type=int, default=3, help="Max review pages to scrape per sort order")

    args = parser.parse_args()

    result = extract_reviews(
        url=args.url,
        token=args.token,
        max_items=args.max_items,
        max_pages=args.max_pages
    )

    # Output pure JSON to stdout
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

