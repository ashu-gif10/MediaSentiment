/**
 * Flipkart Product URL Validator and Metadata Extractor (Client-side)
 * Validates Flipkart product URLs and extracts slug, product title, item ID, and FSN (pid).
 * Pure JavaScript - zero external dependencies.
 */

export const slugToTitle = (slug) => {
  if (!slug || typeof slug !== 'string') return 'Flipkart Product';
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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
    slug = pathParts[0] || 'flipkart-product';
    productId = fsn;
  }

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

