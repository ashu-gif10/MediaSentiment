import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/flipkart_scraper.py');

/**
 * Determine the available Python executable path
 */
const getPythonPath = () => {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const winPy314 = 'C:\\Program Files\\Python314\\python.exe';
  if (fs.existsSync(winPy314)) {
    return winPy314;
  }
  return 'python';
};

/**
 * Clean and unescape text from Flipkart HTML
 */
const cleanText = (str) => {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.{3}\s*more$/i, '')
    .replace(/\bmore$/i, '')
    .trim();
};

/**
 * Convert any Flipkart product URL into its canonical /product-reviews/ URL
 */
export const toFlipkartReviewsUrl = (inputUrl, page = 1) => {
  try {
    let url = inputUrl.trim();
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    const parsed = new URL(url);
    const pid = parsed.searchParams.get('pid');

    let pathname = parsed.pathname;
    // Strip leading /dl/ if present
    if (pathname.startsWith('/dl/')) {
      pathname = pathname.substring(3);
    }
    if (pathname.includes('/p/')) {
      pathname = pathname.replace('/p/', '/product-reviews/');
    }

    const targetUrl = new URL(`https://www.flipkart.com${pathname}`);
    if (pid) {
      targetUrl.searchParams.set('pid', pid);
    }
    if (page > 1) {
      targetUrl.searchParams.set('page', String(page));
    }
    return targetUrl.toString();
  } catch {
    return inputUrl;
  }
};

/**
 * Fetch raw HTML from Flipkart using Axios with realistic headers and redirect following
 */
export const fetchFlipkartHtml = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true, // Capture all HTTP codes without throwing
    });

    const statusCode = response.status;
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || url;
    const contentType = response.headers?.['content-type'] || 'text/html';
    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');

    // Check for Akamai Bot Manager / PerimeterX / E002 challenges
    const isE002 = html.includes('errorCode">E002<') || html.includes('class="errorCode">E002') || (html.includes('Something went wrong!') && html.includes('retry_btn'));
    const isAccessDenied = statusCode === 403 || html.includes('Access Denied') || html.includes('Reference&#32;&#35;');
    const isRateLimited = statusCode === 429;
    const isBlocked = isE002 || isAccessDenied || isRateLimited;

    // Check if product is delisted or redirected to generic store category/home
    const isDelisted = html.includes('Buy Products Online at Best Price in India - All Categories') || statusCode === 404;

    let blockReason = null;
    if (isE002) {
      blockReason = 'Flipkart returned security challenge E002 (Akamai Bot Manager). Direct access restricted for this specific product page.';
    } else if (isAccessDenied) {
      blockReason = 'Flipkart access denied (HTTP 403 / Akamai shield). Direct scraping blocked.';
    } else if (isRateLimited) {
      blockReason = 'Flipkart rate limit reached (HTTP 429). Please wait before retrying.';
    } else if (isDelisted) {
      blockReason = 'This Flipkart product is delisted or discontinued and has no active customer reviews.';
    }

    return {
      statusCode,
      finalUrl,
      contentType,
      isBlocked,
      isE002,
      isDelisted,
      blockReason,
      html,
    };
  } catch (err) {
    return {
      statusCode: 500,
      finalUrl: url,
      contentType: 'text/html',
      isBlocked: false,
      isE002: false,
      isDelisted: false,
      blockReason: `Network error: ${err.message}`,
      html: '',
    };
  }
};

/**
 * Parse reviews from Flipkart HTML (Supports Modern UI, Classic Cards, and Schema.org JSON-LD)
 */
export const parseFlipkartReviewsHtml = (html) => {
  const reviews = [];
  const seen = new Set();

  let productName = '';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    productName = cleanText(titleMatch[1].split('|')[0]
      .replace(/reviews:?/i, '')
      .replace(/latest review of/i, '')
      .replace(/price in india/i, ''));
  }

  // Strategy A: Modern React-Native-Web cards (anchored by star rating container in class attribute)
  const regex = /class="[^"]*r-rehuqn[^"]*"/g;
  let match;
  const cardIndices = [];
  while ((match = regex.exec(html)) !== null) {
    cardIndices.push(match.index);
  }

  cardIndices.forEach((sIdx, i) => {
    const nextIdx = (i + 1 < cardIndices.length) ? cardIndices[i + 1] : sIdx + 12000;
    const cardHtml = html.slice(sIdx, Math.min(html.length, nextIdx));

    // Skip overall rating summary widget
    if ((cardHtml.includes('ratings and') || cardHtml.includes('ratings &')) && !cardHtml.includes('r-11f147o')) {
      return;
    }

    // Extract Rating (numerical indicator or filled star count)
    let rating = 5;
    const rateTextMatch = cardHtml.match(/([1-5])\s*★/) || cardHtml.match(/([1-5](?:\.0)?)\s*•/);
    if (rateTextMatch) {
      rating = Math.round(parseFloat(rateTextMatch[1]));
    } else {
      const firstDivEnd = cardHtml.indexOf('</div></div></div>');
      if (firstDivEnd !== -1) {
        const starChunk = cardHtml.slice(0, firstDivEnd);
        const unfilled = (starChunk.match(/r-1pcdyqj|r-1x6tx0e/g) || []).length;
        rating = Math.max(1, 5 - unfilled);
      }
    }

    // Extract Title
    let title = '';
    const titleMatch = cardHtml.match(/style="-webkit-line-clamp:2"[^>]*>([\s\S]*?)<\/div>/i) ||
                       cardHtml.match(/class="[^"]*r-1jkjb[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       cardHtml.match(/<(?:p|div) class="[^"]*(?:_2-N8zT|z9E0IG)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i);
    if (titleMatch) {
      title = cleanText(titleMatch[1]);
    }

    // Extract Review Text
    let review_text = '';
    const textMatch = cardHtml.match(/class="[^"]*r-11f147o[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      cardHtml.match(/<div class="[^"]*(?:t-ZTKy|ZmyHeo|_6K-7Co)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (textMatch) {
      review_text = cleanText(textMatch[1]);
    }
    if (!review_text) {
      const spanMatch = cardHtml.match(/<span class="css-1jxf684"[^>]*>([\s\S]*?)<\/span>/i);
      if (spanMatch) {
        review_text = cleanText(spanMatch[1]);
      }
    }

    // Extract Author
    let author = 'Certified Buyer';
    const authorMatch = cardHtml.match(/class="[^"]*r-1r2vb7i[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        cardHtml.match(/<(?:p|div) class="[^"]*(?:_2sc7ZR|_2NsDsF)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i);
    if (authorMatch) {
      author = cleanText(authorMatch[1]);
    }

    // Extract Date
    let date = '';
    const dateMatch = cardHtml.match(/([A-Za-z]{3},\s*\d{4}|\d+\s*(?:months?|years?|days?)\s*ago)/i);
    if (dateMatch) {
      date = dateMatch[1];
    }

    if (review_text && review_text.length >= 3) {
      const key = `${review_text.slice(0, 40).toLowerCase()}_${author.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        reviews.push({
          review_text,
          rating,
          date,
          author,
          title,
        });
      }
    }
  });

  // Strategy B: Classic Desktop Flipkart review cards (_27M-vq, col _2wzgFH, EPCmJX, _16PBlm)
  if (reviews.length === 0) {
    const cardRegex = /<div class="[^"]*(?:_27M-vq|col _2wzgFH|EPCmJX|_16PBlm)[^"]*"[^>]*>([\s\S]*?)(?=<div class="[^"]*(?:_27M-vq|col _2wzgFH|EPCmJX|_16PBlm)[^"]*"|$)/gi;
    let cardMatch;
    while ((cardMatch = cardRegex.exec(html)) !== null) {
      const cardHtml = cardMatch[1];

      // Extract review text
      let review_text = '';
      const textMatch = cardHtml.match(/<div class="[^"]*(?:t-ZTKy|ZmyHeo|_6K-7Co)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (textMatch) {
        review_text = cleanText(textMatch[1]);
      }

      // Extract rating
      let rating = 5;
      const rateMatch = cardHtml.match(/<div class="[^"]*(?:_3LWZlK|XDXdRA)[^"]*"[^>]*>([1-5])\s*★?<\/div>/i);
      if (rateMatch) {
        rating = parseInt(rateMatch[1], 10);
      }

      // Extract title
      let title = '';
      const tMatch = cardHtml.match(/<(?:p|div) class="[^"]*(?:_2-N8zT|z9E0IG)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i);
      if (tMatch) {
        title = cleanText(tMatch[1]);
      }

      // Extract author
      let author = 'Certified Buyer';
      const aMatch = cardHtml.match(/<(?:p|div) class="[^"]*(?:_2sc7ZR|_2NsDsF)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i);
      if (aMatch) {
        author = cleanText(aMatch[1]);
      }

      // Extract date
      let date = '';
      const dMatch = cardHtml.match(/<(?:p|div) class="[^"]*(?:_2sc7ZR|_2NsDsF)[^"]*"[^>]*>.*?([A-Za-z]{3},\s*\d{4}|\d+\s*(?:months?|years?|days?)\s*ago)<\/(?:p|div)>/i);
      if (dMatch) {
        date = dMatch[1];
      }

      if (review_text && review_text.length >= 3) {
        const key = `${review_text.slice(0, 40).toLowerCase()}_${author.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          reviews.push({
            review_text,
            rating,
            date,
            author,
            title,
          });
        }
      }
    }
  }

  // Strategy C: Schema.org JSON-LD fallback (Product Reviews structured schema)
  if (reviews.length === 0) {
    const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (ldMatch) {
      try {
        const parsed = JSON.parse(ldMatch[1]);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item.name && !productName) productName = cleanText(item.name);
          const rawReviews = item.review || [];
          rawReviews.forEach(r => {
            const rawText = cleanText(r.reviewBody);
            if (!rawText) return;
            const author = r.author?.name || 'Certified Buyer';
            const key = `${rawText.slice(0, 40).toLowerCase()}_${author.toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              reviews.push({
                review_text: rawText,
                rating: r.reviewRating?.ratingValue || 5,
                date: r.datePublished || '',
                author,
                title: cleanText(r.name || ''),
              });
            }
          });
        }
      } catch (e) {
        // Safe ignore
      }
    }
  }

  return { productName, reviews };
};

/**
 * Free, direct HTTPS-based review fetcher for Flipkart URLs
 * Fetches reviews page-by-page directly without requiring external tokens.
 *
 * @param {string} productUrl - Pasted Flipkart product URL
 * @param {number} [maxReviews=30] - Maximum reviews to fetch
 * @returns {Promise<Object>} Object with success, reviews, productName, totalFetched, errorType, etc.
 */
export const fetchDirectFlipkartReviews = async (productUrl, maxReviews = 30) => {
  const allReviews = [];
  let detectedProductName = '';
  const seen = new Set();
  const targetMax = Math.max(5, Math.min(parseInt(maxReviews, 10) || 30, 100));
  const maxPages = Math.min(6, Math.ceil(targetMax / 10));

  let lastStatus = 200;
  let lastFinalUrl = productUrl;
  let lastContentType = 'text/html';
  let isBlocked = false;
  let isDelisted = false;
  let failureReason = null;
  let canonicalBaseUrl = productUrl;

  // Step 1: Pre-resolve the URL if it is a shortlink
  if (productUrl.includes('/s/') || productUrl.includes('dl.flipkart.com/s/')) {
    console.log(`[FlipkartScraperService] Resolving short URL: ${productUrl}`);
    const initRes = await fetchFlipkartHtml(productUrl);
    if (initRes.finalUrl && initRes.finalUrl !== productUrl) {
      canonicalBaseUrl = initRes.finalUrl;
      console.log(`[FlipkartScraperService] Resolved short URL to: ${canonicalBaseUrl}`);
    }
  }

  for (let page = 1; page <= maxPages; page++) {
    const targetUrl = toFlipkartReviewsUrl(canonicalBaseUrl, page);
    console.log(`[FlipkartScraperService] Direct fetching page ${page}: ${targetUrl}`);

    const res = await fetchFlipkartHtml(targetUrl);
    lastStatus = res.statusCode;
    lastFinalUrl = res.finalUrl;
    lastContentType = res.contentType;

    if (res.isBlocked) {
      isBlocked = true;
      failureReason = res.blockReason;
      console.warn(`[FlipkartScraperService] Page ${page} blocked by Flipkart: ${res.blockReason}`);
      break;
    }

    if (res.isDelisted) {
      isDelisted = true;
      failureReason = res.blockReason;
      console.warn(`[FlipkartScraperService] Product appears delisted: ${res.blockReason}`);
      break;
    }

    if (res.statusCode !== 200 || !res.html) {
      console.log(`[FlipkartScraperService] Page ${page} responded with status ${res.statusCode}`);
      break;
    }

    const { productName, reviews } = parseFlipkartReviewsHtml(res.html);
    if (productName && !detectedProductName) {
      detectedProductName = productName;
    }

    if (!reviews || reviews.length === 0) {
      // If page 1 returned 0, try fetching the canonical product URL directly
      if (page === 1 && targetUrl !== canonicalBaseUrl) {
        console.log(`[FlipkartScraperService] Attempting direct fetch on canonical product URL: ${canonicalBaseUrl}`);
        const origRes = await fetchFlipkartHtml(canonicalBaseUrl);
        if (origRes.isBlocked) {
          isBlocked = true;
          failureReason = origRes.blockReason;
          break;
        }
        if (origRes.isDelisted) {
          isDelisted = true;
          failureReason = origRes.blockReason;
          break;
        }
        if (origRes.statusCode === 200 && origRes.html) {
          const origParsed = parseFlipkartReviewsHtml(origRes.html);
          if (origParsed.productName && !detectedProductName) detectedProductName = origParsed.productName;
          if (origParsed.reviews && origParsed.reviews.length > 0) {
            origParsed.reviews.forEach(r => {
              const k = `${r.review_text.slice(0, 40).toLowerCase()}_${r.author.toLowerCase()}`;
              if (!seen.has(k)) {
                seen.add(k);
                allReviews.push(r);
              }
            });
          }
        }
      }
      break;
    }

    for (const r of reviews) {
      const key = `${r.review_text.slice(0, 40).toLowerCase()}_${r.author.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        allReviews.push(r);
        if (allReviews.length >= targetMax) break;
      }
    }

    if (allReviews.length >= targetMax) break;
  }

  let errorType = null;
  let message = '';

  if (allReviews.length > 0) {
    message = `Successfully retrieved ${allReviews.length} genuine customer reviews from Flipkart.`;
  } else if (isBlocked) {
    errorType = 'access_blocked';
    message = failureReason || 'Flipkart security protection (Akamai Bot Manager / Error E002) restricted direct access to this product page.';
  } else if (isDelisted) {
    errorType = 'delisted_product';
    message = failureReason || 'This Flipkart product is delisted or discontinued and has no active customer reviews.';
  } else {
    errorType = 'no_reviews';
    message = 'No customer reviews found on this Flipkart product page or the product has not received customer reviews yet.';
  }

  return {
    success: allReviews.length > 0,
    errorType,
    message,
    statusCode: lastStatus,
    finalUrl: lastFinalUrl,
    contentType: lastContentType,
    isBlocked,
    isDelisted,
    productName: detectedProductName || 'Flipkart Product',
    productUrl: toFlipkartReviewsUrl(canonicalBaseUrl, 1),
    totalFetched: allReviews.length,
    reviews: allReviews,
  };
};

/**
 * Execute flipkart_scraper.py child process to scrape reviews via flipkart-scraping & Scrape.do (Fallback)
 */
export const scrapeFlipkartReviews = async (productUrl, options = {}) => {
  const { maxItems = 50, maxPages = 3, timeoutMs = 90000 } = options;

  return new Promise((resolve, reject) => {
    const pythonExe = getPythonPath();

    if (!fs.existsSync(SCRIPT_PATH)) {
      return reject(new Error(`Flipkart review scraper script not found at ${SCRIPT_PATH}`));
    }

    const args = [
      SCRIPT_PATH,
      '--url', productUrl,
      '--max-items', String(maxItems),
      '--max-pages', String(maxPages),
    ];

    const child = spawn(pythonExe, args, {
      env: {
        ...process.env,
        SCRAPEDO_TOKEN: process.env.SCRAPEDO_TOKEN || '',
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let isFinished = false;

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        child.kill();
        reject(new Error(`Flipkart review scraper timed out after ${timeoutMs / 1000} seconds.`));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      console.error('[FlipkartScraperService] Spawn error:', err);
      reject(new Error(`Failed to start Python process (${pythonExe}): ${err.message}`));
    });

    child.on('close', (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);

      try {
        const cleanStdout = stdoutBuffer.trim();
        if (!cleanStdout) {
          return resolve({
            success: false,
            error: stderrBuffer.trim() || `Scraper exited with code ${code} without output`,
            totalFetched: 0,
            reviews: [],
          });
        }

        const data = JSON.parse(cleanStdout);
        resolve(data);
      } catch (parseErr) {
        console.error('[FlipkartScraperService] JSON parse error:', parseErr, 'Raw output:', stdoutBuffer.slice(0, 300));
        resolve({
          success: false,
          error: `Failed to parse output from scraper: ${parseErr.message}`,
          totalFetched: 0,
          reviews: [],
        });
      }
    });
  });
};
