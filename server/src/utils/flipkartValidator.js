/**
 * Flipkart Product URL Validator and Metadata Extractor
 * Validates Flipkart product URLs and extracts slug, product title, item ID, and FSN (pid).
 * Pure JavaScript - zero external dependencies.
 */

/**
 * Format a slug into a human-readable product title
 * e.g. "boat-airdopes-131-bluetooth-headset" -> "Boat Airdopes 131 Bluetooth Headset"
 */
export const slugToTitle = (slug) => {
  if (!slug || typeof slug !== 'string') return 'Flipkart Product';
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Validate Flipkart URL and extract product identifiers
 * @param {string} input - Flipkart URL
 * @returns {Object} { valid: boolean, error?: string, productName?: string, productId?: string, fsn?: string, cleanUrl?: string, slug?: string }
 */
export const validateFlipkartUrl = (input) => {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      error: 'Flipkart product URL is required.',
    };
  }

  const trimmed = input.trim();
  let parsedUrl;

  try {
    const urlWithProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsedUrl = new URL(urlWithProtocol);
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format. Please provide a complete URL starting with https://www.flipkart.com',
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const validHostnames = [
    'flipkart.com',
    'www.flipkart.com',
    'dl.flipkart.com',
    'm.flipkart.com',
    '2.flipkart.com',
  ];

  const isFlipkartHost = validHostnames.some(
    host => hostname === host || hostname.endsWith(`.${host}`)
  );

  if (!isFlipkartHost) {
    return {
      valid: false,
      error: `Unsupported domain "${hostname}". Please paste a valid Flipkart product link (e.g., https://www.flipkart.com/.../p/...).`,
    };
  }

  const pathname = parsedUrl.pathname;
  const pathParts = pathname.split('/').filter(Boolean);

  // Flipkart URL patterns:
  // 1. /<product-slug>/p/<product-id>
  // 2. /<product-slug>/product-reviews/<product-id>
  // 3. /dl/<product-slug>/p/<product-id>
  // 4. /s/<shortcode>
  // 5. Query parameter pid=<FSN> (e.g. pid=ACCFBZ3VHN9NGRYY)

  const isShortLink = pathParts[0] === 's' && pathParts.length >= 2;
  const pIndex = pathParts.indexOf('p');
  const reviewIndex = pathParts.indexOf('product-reviews');

  let slug = null;
  let productId = null;
  const fsn = parsedUrl.searchParams.get('pid') || null;

  if (pIndex !== -1 && pIndex > 0) {
    slug = pathParts[pIndex - 1];
    productId = pathParts[pIndex + 1] || null;
  } else if (reviewIndex !== -1 && reviewIndex > 0) {
    slug = pathParts[reviewIndex - 1];
    productId = pathParts[reviewIndex + 1] || null;
  } else if (isShortLink) {
    slug = 'flipkart-shortlink';
    productId = pathParts[1];
  } else if (fsn) {
    // If has pid parameter but unusual path
    slug = pathParts[0] || 'flipkart-product';
    productId = fsn;
  }

  // If none of the product path patterns match
  if (!slug && !productId && !fsn && !isShortLink) {
    return {
      valid: false,
      error: 'The provided link is not a Flipkart product page. Please copy the link from a specific product page (must contain "/p/" or product identifier).',
    };
  }

  const cleanProductName = slug && slug !== 'flipkart-shortlink' && slug !== 'flipkart-product'
    ? slugToTitle(slug)
    : 'Flipkart Product';

  return {
    valid: true,
    cleanUrl: parsedUrl.origin + parsedUrl.pathname + (fsn ? `?pid=${fsn}` : ''),
    rawUrl: trimmed,
    productName: cleanProductName,
    productId: productId || fsn || 'Unknown',
    fsn: fsn || (productId && productId.startsWith('itm') ? productId : null),
    slug: slug || 'flipkart-product',
  };
};

