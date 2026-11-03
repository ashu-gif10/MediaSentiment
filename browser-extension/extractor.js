/**
 * MediaSentiment - Flipkart In-Page Review Extractor
 * Executes directly within the user's active Flipkart tab DOM.
 * Zero external dependencies. Safe, read-only extraction.
 * Supports both Modern Flipkart React-Native-Web UI and Classic Flipkart DOM.
 */

/**
 * Clean and normalize text extracted from DOM
 */
function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.{3}\s*more$/i, '')
    .replace(/\bmore$/i, '')
    .replace(/READ MORE\s*$/i, '')
    .replace(/READ LESS\s*$/i, '')
    .trim();
}

/**
 * Extract product name from Flipkart DOM
 */
function getFlipkartProductName() {
  const h1 = document.querySelector('h1') || 
             document.querySelector('span.VU-ZEz') || 
             document.querySelector('span.B_NuCI') ||
             document.querySelector('div._2W96wQ h1');
  if (h1 && h1.innerText && h1.innerText.trim()) {
    return cleanText(h1.innerText);
  }
  const metaTitle = document.querySelector('meta[property="og:title"]');
  if (metaTitle && metaTitle.content) {
    return cleanText(metaTitle.content.split('|')[0]);
  }
  const cleanTitle = document.title
    .split('|')[0]
    .replace(/reviews:?/i, '')
    .replace(/price in india/i, '')
    .replace(/latest review of/i, '')
    .trim();
  return cleanText(cleanTitle) || 'Flipkart Product';
}

/**
 * Safely expand truncated "READ MORE" / "more" review text in the loaded DOM
 * Only targets elements inside review cards that explicitly say "more" or "READ MORE".
 */
function expandReadMoreReviews() {
  let expandedCount = 0;
  const candidates = Array.from(document.querySelectorAll('span, button, div')).filter((el) => {
    const text = (el.innerText || el.textContent || '').trim();
    return text === 'more' || text === 'READ MORE' || text === '... more' || text === 'Read More';
  });

  candidates.forEach((el) => {
    try {
      el.click();
      expandedCount++;
    } catch (e) {
      // Safe ignore
    }
  });

  return expandedCount;
}

/**
 * Core extraction function: parses all rendered customer reviews from active DOM
 */
function extractReviewsFromDom() {
  const productName = getFlipkartProductName();
  const cleanUrl = window.location.href.split('&marketplace')[0];
  const extractedReviews = [];
  const seenReviewKeys = new Set();

  // Helper to add unique review
  function addReview(r) {
    if (!r.review_text || r.review_text.length < 3) return;
    const authorKey = (r.author || 'buyer').toLowerCase().slice(0, 20);
    const textKey = r.review_text.slice(0, 40).toLowerCase();
    const dedupKey = `${textKey}_${authorKey}`;
    if (seenReviewKeys.has(dedupKey)) return;
    seenReviewKeys.add(dedupKey);
    extractedReviews.push({
      review_text: r.review_text,
      rating: r.rating || '',
      date: r.date || '',
      author: r.author || 'Certified Buyer',
      title: r.title || ''
    });
  }

  // Strategy A: Modern Flipkart React Native for Web DOM (2024-2026 UI)
  const starContainers = Array.from(document.querySelectorAll('.r-rehuqn, div[class*="rehuqn"]'));
  if (starContainers.length > 0) {
    starContainers.forEach((sc) => {
      // Walk up to find review card container
      let card = sc;
      for (let i = 0; i < 8 && card && card !== document.body; i++) {
        card = card.parentElement;
        if (card && card.innerText && card.innerText.includes('Verified Purchase')) {
          break;
        }
      }
      if (!card) return;

      // 1. Star Rating
      let rating = '5';
      const stars = Array.from(sc.children);
      if (stars.length === 5) {
        let filled = 0;
        stars.forEach((s) => {
          const cls = s.className || '';
          if (!cls.includes('r-1pcdyqj') && !cls.includes('r-1x6tx0e')) {
            filled++;
          }
        });
        if (filled > 0) rating = String(filled);
      }

      // 2. Title
      let title = '';
      const titleEl = card.querySelector('.r-1jkjb, [style*="-webkit-line-clamp"]') ||
                      sc.parentElement?.querySelector('.css-146c3p1:not(.r-rehuqn)');
      if (titleEl) {
        title = cleanText(titleEl.innerText);
      }

      // 3. Review Body
      let review_text = '';
      const textEl = card.querySelector('.r-11f147o, span.css-1jxf684');
      if (textEl) {
        const clone = textEl.cloneNode(true);
        clone.querySelectorAll('span, div').forEach((s) => {
          if ((s.innerText || '').trim().toLowerCase() === 'more') s.remove();
        });
        review_text = cleanText(clone.innerText || clone.textContent);
      }

      // Fallback review body from raw card lines
      if (!review_text) {
        const lines = (card.innerText || '').split('\n').map((l) => l.trim()).filter(Boolean);
        for (const l of lines) {
          if (l === title || l.startsWith('Review for:') || l === 'Verified Purchase') continue;
          if (/^·?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(l)) continue;
          if (/^\d+\s*(days?|months?|years?|weeks?|hours?)\s*ago/i.test(l)) continue;
          if (/^\d+K?$/.test(l) || l.startsWith(',')) continue;
          if (l.length > 10) {
            review_text = cleanText(l);
            break;
          }
        }
      }

      // 4. Author
      let author = 'Certified Buyer';
      const authorEl = card.querySelector('.r-1r2vb7i');
      if (authorEl && authorEl.innerText.trim()) {
        author = cleanText(authorEl.innerText);
      } else {
        const locEl = card.querySelector('.r-p0wfk4');
        if (locEl && locEl.previousElementSibling) {
          author = cleanText(locEl.previousElementSibling.innerText);
        }
      }

      // 5. Date
      let date = '';
      const cardText = card.innerText || '';
      const dateMatch = cardText.match(/·?\s*([A-Za-z]{3},\s*\d{4}|\d+\s*(months?|years?|days?|weeks?|hours?)\s*ago)/);
      if (dateMatch) {
        date = dateMatch[1];
      }

      addReview({ review_text, rating, date, author, title });
    });
  }

  // Strategy B: Classic Flipkart DOM (div.EPCmJX, div.RcXBOT, div._27M-vq)
  const classicCards = Array.from(document.querySelectorAll(
    'div.EPCmJX, div.RcXBOT, div.col.EPCmJX, div._27M-vq, div.cPHDOP'
  ));

  classicCards.forEach((card) => {
    const textEl = card.querySelector('div.ZmyHeo, div.t-ZTKy, div._11pzQk') || card;
    let rawText = '';
    if (textEl) {
      const clone = textEl.cloneNode(true);
      clone.querySelectorAll('span, button').forEach((s) => {
        const sText = (s.innerText || '').trim().toUpperCase();
        if (sText === 'READ MORE' || sText === 'READ LESS') s.remove();
      });
      rawText = cleanText(clone.innerText || clone.textContent);
    }

    if (!rawText || rawText.length < 3) return;

    let rating = '';
    const ratingEl = card.querySelector('div.XQDdHH, div._3LWZlK, div[class*="XQDdHH"]');
    if (ratingEl) {
      const match = ratingEl.innerText.match(/\b[1-5]\b/);
      if (match) rating = match[0];
    }

    let title = '';
    const titleEl = card.querySelector('p._2-N8zT, p.z9E0qG, p[class*="_2-N8zT"]');
    if (titleEl) {
      title = cleanText(titleEl.innerText);
    }

    let author = 'Certified Buyer';
    const authorEl = card.querySelector('p._2NsDsF, p._2sc7ZR, p[class*="_2NsDsF"]');
    if (authorEl && authorEl.innerText.trim()) {
      author = cleanText(authorEl.innerText);
    }

    let date = '';
    const allMetaPs = Array.from(card.querySelectorAll('p._2NsDsF, p.AwS1CA, p._2sc7ZR, p[class*="AwS1CA"]'));
    for (const p of allMetaPs) {
      const pText = cleanText(p.innerText);
      if (/\b(\d+\s+(days?|months?|years?|weeks?|hours?)\s+ago|[A-Z][a-z]{2},?\s+\d{4})\b/i.test(pText)) {
        date = pText;
        break;
      }
    }

    addReview({ review_text: rawText, rating, date, author, title });
  });

  // Strategy C: Schema.org JSON-LD structured data (standard on Flipkart product pages)
  if (extractedReviews.length === 0) {
    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    ldScripts.forEach((s) => {
      try {
        const data = JSON.parse(s.innerText);
        const items = Array.isArray(data) ? data : [data];
        items.forEach((item) => {
          const reviews = item.review || [];
          reviews.forEach((r) => {
            const rawText = cleanText(r.reviewBody);
            if (!rawText) return;
            addReview({
              review_text: rawText,
              rating: r.reviewRating?.ratingValue ? String(r.reviewRating.ratingValue) : '',
              date: r.datePublished || '',
              author: r.author?.name || 'Certified Buyer',
              title: cleanText(r.name || '')
            });
          });
        });
      } catch (e) {
        // Safe ignore
      }
    });
  }

  return {
    success: extractedReviews.length > 0,
    productName: productName,
    productUrl: cleanUrl,
    totalExtracted: extractedReviews.length,
    reviews: extractedReviews
  };
}

/**
 * Generate RFC-4180 compliant CSV string with UTF-8 BOM
 * Columns: review_text,rating,date,author,title
 */
function generateReviewsCsv(reviews) {
  const BOM = '\uFEFF';
  const header = 'review_text,rating,date,author,title\n';

  const escapeCell = (str) => {
    if (str === null || str === undefined) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = reviews.map((r) => {
    return [
      escapeCell(r.review_text),
      r.rating !== undefined && r.rating !== null ? r.rating : '',
      escapeCell(r.date),
      escapeCell(r.author),
      escapeCell(r.title)
    ].join(',');
  });

  return BOM + header + rows.join('\n');
}

// Export for module/Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cleanText,
    getFlipkartProductName,
    expandReadMoreReviews,
    extractReviewsFromDom,
    generateReviewsCsv
  };
}
