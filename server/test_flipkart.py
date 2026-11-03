#!/usr/bin/env python3
"""
Test script to verify direct Flipkart product reviews scraping feasibility using Python requests and BeautifulSoup.
Zero paid APIs. Zero external tokens.
"""

import sys
import re
import json
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import requests
from bs4 import BeautifulSoup

# Ensure UTF-8 output on Windows consoles
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def normalize_to_reviews_url(url: str, page: int = 1) -> str:
    """
    Ensure the URL points to the canonical /product-reviews/ endpoint with pid and page.
    """
    if not url.startswith("http"):
        url = "https://" + url

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    pid = qs.get("pid", [None])[0]

    path = parsed.path
    if "/p/" in path:
        path = path.replace("/p/", "/product-reviews/")

    new_query = {}
    if pid:
        new_query["pid"] = pid
    if page > 1:
        new_query["page"] = str(page)

    return urlunparse((
        parsed.scheme or "https",
        parsed.netloc or "www.flipkart.com",
        path,
        "",
        urlencode(new_query),
        ""
    ))


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\.{3}\s*more$", "", text, flags=re.I)
    text = re.sub(r"\bmore$", "", text, flags=re.I)
    text = re.sub(r"READ MORE\s*$", "", text, flags=re.I)
    return text.strip()


def test_flipkart_scrape(target_url: str):
    reviews_url = normalize_to_reviews_url(target_url)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
    }

    print("=" * 60)
    print("FLIPKART PRODUCT REVIEW ACCESS & EXTRACTION TEST")
    print("=" * 60)
    print(f"Target URL: {target_url}")
    print(f"Canonical Reviews URL: {reviews_url}\n")

    session = requests.Session()
    response = session.get(reviews_url, headers=headers, timeout=20)

    # 1. Print connection metadata
    status_code = response.status_code
    final_url = response.url
    content_type = response.headers.get("Content-Type", "")

    print(f"HTTP Status Code : {status_code}")
    print(f"Final URL        : {final_url}")
    print(f"Content-Type     : {content_type}")

    if status_code != 200:
        print(f"\n[BLOCKED] Request returned non-200 HTTP status: {status_code}")
        if status_code in (403, 429):
            print("Access blocked by Flipkart anti-bot protection (Akamai/PerimeterX).")
        return False, []

    soup = BeautifulSoup(response.text, "html.parser")

    # 2. Page Title
    title_tag = soup.find("title")
    page_title = title_tag.get_text(strip=True) if title_tag else "No Title Found"
    print(f"Page Title       : {page_title}")

    # Check for bot challenge or error pages
    if "Something went wrong" in response.text and "E002" in response.text:
        print("\n[BLOCKED] Flipkart returned error code E002 (Session/bot challenge).")
        return False, []

    extracted_reviews = []
    seen_texts = set()

    # 3. Strategy A: Modern Flipkart React-Native-Web review cards (2024-2026 UI)
    # Cards feature star rating flex container (.r-rehuqn), review body (.r-11f147o or span.css-1jxf684),
    # author (.r-1r2vb7i), and "Verified Purchase" tag.
    star_containers = soup.find_all(class_=lambda c: c and "r-rehuqn" in c)
    total_elements_found = len(star_containers)

    if star_containers:
        for sc in star_containers:
            # Walk up to find the review card container
            card = sc
            for _ in range(8):
                if card.parent and card.parent.name != "body":
                    card = card.parent
                    if "Verified Purchase" in card.get_text():
                        break

            # 3.1 Rating: Count filled star icons in star container
            rating = 5
            stars = sc.find_all(recursive=False)
            if len(stars) == 5:
                unfilled = len([s for s in stars if any(m in (s.get("class") or []) for m in ["r-1pcdyqj", "r-1x6tx0e"])])
                rating = max(1, 5 - unfilled)

            # 3.2 Headline / Title
            title_el = card.find(class_=lambda c: c and "r-1jkjb" in c) or card.find(style=re.compile(r"-webkit-line-clamp:\s*2"))
            title_text = clean_text(title_el.get_text()) if title_el else ""

            # 3.3 Review Body Text
            text_el = card.find(class_=lambda c: c and "r-11f147o" in c) or card.find("span", class_="css-1jxf684")
            raw_text = clean_text(text_el.get_text()) if text_el else ""

            # 3.4 Author
            author_el = card.find(class_=lambda c: c and "r-1r2vb7i" in c)
            author = clean_text(author_el.get_text()) if author_el else "Certified Buyer"

            # 3.5 Date (e.g. "· Jun, 2019" or "X months ago")
            date_match = re.search(r"·?\s*([A-Za-z]{3},\s*\d{4}|\d+\s*(?:months?|years?|days?)\s*ago)", card.get_text())
            date_text = date_match.group(1) if date_match else ""

            if raw_text and len(raw_text) >= 3:
                norm_key = raw_text[:50].lower()
                if norm_key not in seen_texts:
                    seen_texts.add(norm_key)
                    extracted_reviews.append({
                        "review_text": raw_text,
                        "rating": rating,
                        "title": title_text,
                        "author": author,
                        "date": date_text
                    })

    # Strategy B: Classic Flipkart Card Selectors (.EPCmJX, .RcXBOT, ._27M-vq)
    if not extracted_reviews:
        classic_cards = soup.select("div.EPCmJX, div.RcXBOT, div._27M-vq, div.cPHDOP")
        if classic_cards:
            total_elements_found = len(classic_cards)
            for card in classic_cards:
                text_el = card.select_one("div.ZmyHeo, div.t-ZTKy, div._11pzQk")
                raw_text = clean_text(text_el.get_text()) if text_el else ""
                if not raw_text:
                    continue

                rating_el = card.select_one("div.XQDdHH, div._3LWZlK")
                rating_m = re.search(r"[1-5]", rating_el.get_text()) if rating_el else None
                rating = int(rating_m.group(0)) if rating_m else 5

                title_el = card.select_one("p._2-N8zT, p.z9E0qG")
                title_text = clean_text(title_el.get_text()) if title_el else ""

                author_el = card.select_one("p._2NsDsF, p._2sc7ZR")
                author = clean_text(author_el.get_text()) if author_el else "Certified Buyer"

                date_el = card.select_one("p.AwS1CA, p._2sc7ZR")
                date_text = clean_text(date_el.get_text()) if date_el else ""

                norm_key = raw_text[:50].lower()
                if norm_key not in seen_texts:
                    seen_texts.add(norm_key)
                    extracted_reviews.append({
                        "review_text": raw_text,
                        "rating": rating,
                        "title": title_text,
                        "author": author,
                        "date": date_text
                    })

    # Strategy C: Schema.org JSON-LD Structured Data
    if not extracted_reviews:
        ld_scripts = soup.find_all("script", type="application/ld+json")
        for script in ld_scripts:
            try:
                data = json.loads(script.get_text())
                items = data if isinstance(data, list) else [data]
                for item in items:
                    raw_reviews = item.get("review") or []
                    for r in raw_reviews:
                        raw_text = clean_text(r.get("reviewBody", ""))
                        if not raw_text:
                            continue
                        author = (r.get("author") or {}).get("name", "Certified Buyer")
                        rating_val = (r.get("reviewRating") or {}).get("ratingValue", 5)
                        norm_key = raw_text[:50].lower()
                        if norm_key not in seen_texts:
                            seen_texts.add(norm_key)
                            extracted_reviews.append({
                                "review_text": raw_text,
                                "rating": rating_val,
                                "title": clean_text(r.get("name", "")),
                                "author": author,
                                "date": r.get("datePublished", "")
                            })
            except Exception:
                pass
        total_elements_found = len(extracted_reviews)

    # 4. Report Counts
    print(f"Number of Review Elements Found : {total_elements_found}")
    print(f"Unique Non-Empty Review Texts   : {len(extracted_reviews)}")

    # 5. Up to three extracted review samples
    print("\n--- Extracted Review Samples (Up to 3) ---")
    if not extracted_reviews:
        print("No review texts extracted.")
    else:
        for idx, r in enumerate(extracted_reviews[:3], 1):
            stars_str = "*" * int(r['rating'])
            print(f"\n[Sample {idx}]")
            print(f"  Rating : {stars_str} ({r['rating']}/5)")
            print(f"  Title  : {r['title'] or '(No Title)'}")
            print(f"  Author : {r['author']}")
            print(f"  Date   : {r['date'] or '(Unknown Date)'}")
            print(f"  Text   : \"{r['review_text']}\"")

    print("\n" + "=" * 60)
    return True, extracted_reviews


if __name__ == "__main__":
    test_url = sys.argv[1] if len(sys.argv) > 1 else "https://www.flipkart.com/boat-bassheads-100-wired-earphones/product-reviews/itm3f39544d0b96c?pid=ACCEVQZABYWJHRHF"
    success, reviews = test_flipkart_scrape(test_url)
    sys.exit(0 if (success and len(reviews) > 0) else 1)
