/**
 * Robust RFC-4180 compliant CSV Parser and Validator for Product Reviews
 * Supports quoted cells, multiline text, commas inside quotes, escaped quotes (""), and BOM removal.
 * Pure JavaScript - zero external dependencies.
 */

// Supported header aliases (case-insensitive, trimmed)
const REVIEW_TEXT_ALIASES = [
  'review',
  'review_text',
  'review text',
  'review_body',
  'review body',
  'review_content',
  'review content',
  'text',
  'comment',
  'comments',
  'content',
  'feedback',
  'body',
  'user_review',
  'user review',
  'customer_review',
  'customer review',
];

const RATING_ALIASES = [
  'rating',
  'ratings',
  'score',
  'scores',
  'star',
  'stars',
  'star_rating',
  'star rating',
  'user_rating',
  'user rating',
  'overall',
  'grade',
];

const DATE_ALIASES = [
  'date',
  'dates',
  'review_date',
  'review date',
  'created_at',
  'timestamp',
  'time',
  'post_date',
  'posted_at',
  'date_posted',
];

const AUTHOR_ALIASES = [
  'author',
  'authors',
  'reviewer',
  'reviewer_name',
  'reviewer name',
  'user',
  'username',
  'name',
  'customer',
  'customer_name',
  'profile_name',
];

const TITLE_ALIASES = [
  'title',
  'headline',
  'review_title',
  'review title',
  'summary',
  'subject',
];

/**
 * Parse raw CSV string into a 2D array of cells conforming to RFC 4180
 * @param {string} rawText - Raw CSV text
 * @returns {Array<Array<string>>}
 */
export const parseRawCsv = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return [];

  // Remove UTF-8 Byte Order Mark (BOM) if present
  let text = rawText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped double-quote inside quoted cell ("" -> ")
        currentField += '"';
        i++; // skip the escaped quote
      } else {
        // Toggle quotes mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      // Handle \r\n or standalone \r or \n
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = '';

      // Only push non-empty rows
      if (currentRow.some(cell => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Push last field & row if remaining
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(cell => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
};

/**
 * Normalize header name for reliable matching
 */
const normalizeHeader = (header) => {
  if (!header || typeof header !== 'string') return '';
  return header
    .toLowerCase()
    .trim()
    .replace(/^["']|["']$/g, '') // remove surrounding quotes
    .replace(/[\s_-]+/g, ' ')     // collapse delimiters to single space
    .trim();
};

/**
 * Extract numerical rating (1 to 5) from flexible string formats
 * Examples: "5", "5.0", "4 out of 5", "3.5 stars", "1/5"
 */
export const normalizeRating = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return Math.max(1, Math.min(5, Math.round(val)));
  }

  const str = String(val).trim();
  // Match first decimal or integer in string
  const match = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;

  // Clamp rating between 1 and 5
  return Math.max(1, Math.min(5, Math.round(num)));
};

/**
 * Validate and parse product reviews CSV content
 * @param {string} csvContent - Raw CSV text
 * @returns {Object} { valid: boolean, error?: string, reviews?: Array, columnsDetected?: Object, totalRows?: number, skippedBlankCount?: number }
 */
export const validateAndParseReviewsCsv = (csvContent) => {
  if (!csvContent || typeof csvContent !== 'string' || !csvContent.trim()) {
    return {
      valid: false,
      error: 'The uploaded CSV file is empty. Please select a valid CSV file with product reviews.',
      reviews: [],
    };
  }

  const rawRows = parseRawCsv(csvContent);

  if (rawRows.length === 0) {
    return {
      valid: false,
      error: 'No readable data rows found in the CSV file.',
      reviews: [],
    };
  }

  const rawHeaders = rawRows[0];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  // Detect column indices
  let textIndex = -1;
  let ratingIndex = -1;
  let dateIndex = -1;
  let authorIndex = -1;
  let titleIndex = -1;

  normalizedHeaders.forEach((hdr, idx) => {
    const rawHdrName = rawHeaders[idx].trim();
    const cleanHdr = hdr.replace(/_/g, ' ');

    if (textIndex === -1 && (REVIEW_TEXT_ALIASES.includes(hdr) || REVIEW_TEXT_ALIASES.includes(cleanHdr))) {
      textIndex = idx;
    } else if (ratingIndex === -1 && (RATING_ALIASES.includes(hdr) || RATING_ALIASES.includes(cleanHdr))) {
      ratingIndex = idx;
    } else if (dateIndex === -1 && (DATE_ALIASES.includes(hdr) || DATE_ALIASES.includes(cleanHdr))) {
      dateIndex = idx;
    } else if (authorIndex === -1 && (AUTHOR_ALIASES.includes(hdr) || AUTHOR_ALIASES.includes(cleanHdr))) {
      authorIndex = idx;
    } else if (titleIndex === -1 && (TITLE_ALIASES.includes(hdr) || TITLE_ALIASES.includes(cleanHdr))) {
      titleIndex = idx;
    }
  });

  // Check required review text column
  if (textIndex === -1) {
    const detectedNames = rawHeaders.filter(h => h.trim().length > 0).join(', ');
    return {
      valid: false,
      error: `Missing required review text column. CSV must contain a 'review' or 'review_text' column. Found columns: [${detectedNames || 'none'}].`,
      columnsDetected: {
        textColumn: null,
        detectedHeaders: rawHeaders,
      },
      reviews: [],
    };
  }

  if (rawRows.length < 2) {
    return {
      valid: false,
      error: 'The CSV file contains only a header row and no review data entries.',
      reviews: [],
    };
  }

  const columnsDetected = {
    textColumn: rawHeaders[textIndex]?.trim() || 'review',
    ratingColumn: ratingIndex !== -1 ? rawHeaders[ratingIndex]?.trim() : null,
    dateColumn: dateIndex !== -1 ? rawHeaders[dateIndex]?.trim() : null,
    authorColumn: authorIndex !== -1 ? rawHeaders[authorIndex]?.trim() : null,
    titleColumn: titleIndex !== -1 ? rawHeaders[titleIndex]?.trim() : null,
  };

  const reviews = [];
  let skippedBlankCount = 0;

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rawText = (row[textIndex] || '').trim();

    if (!rawText) {
      skippedBlankCount++;
      continue;
    }

    const title = titleIndex !== -1 ? (row[titleIndex] || '').trim() : '';
    const fullText = title ? `${title}. ${rawText}` : rawText;

    const rating = ratingIndex !== -1 ? normalizeRating(row[ratingIndex]) : null;
    const date = dateIndex !== -1 ? (row[dateIndex] || '').trim() : null;
    const author = authorIndex !== -1 && (row[authorIndex] || '').trim()
      ? row[authorIndex].trim()
      : `Customer #${reviews.length + 1}`;

    reviews.push({
      id: `rev-${reviews.length + 1}`,
      text: fullText,
      rawReview: rawText,
      title: title || undefined,
      author,
      rating,
      date: date || undefined,
    });
  }

  if (reviews.length === 0) {
    return {
      valid: false,
      error: `No valid reviews found. All ${rawRows.length - 1} data rows contained empty review text.`,
      columnsDetected,
      reviews: [],
    };
  }

  return {
    valid: true,
    reviews,
    columnsDetected,
    totalRows: rawRows.length - 1,
    validCount: reviews.length,
    skippedBlankCount,
  };
};

