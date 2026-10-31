/**
 * Extract and validate 11-character YouTube Video ID on the backend
 * Accepts:
 * - youtu.be short URLs with any queries (?si=..., ?t=...)
 * - standard youtube.com/watch?v=...
 * - youtube.com/shorts/...
 * - youtube.com/embed/...
 * - direct 11-char videoId (e.g. FRkJ8uGCEEE)
 *
 * Rejects unrelated websites and malformed IDs.
 *
 * @param {string} input - YouTube URL or Video ID
 * @returns {string|null} - Exact 11-char video ID or null if invalid
 */
export const extractYouTubeVideoId = (input) => {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // If already an 11-character alphanumeric YouTube ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  let parsedUrl;
  try {
    const urlWithProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsedUrl = new URL(urlWithProtocol);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Hostname validation
  const isValidHost =
    hostname === 'youtu.be' ||
    hostname.endsWith('.youtu.be') ||
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com');

  if (!isValidHost) {
    return null;
  }

  let videoId = null;

  // Case 1: Short URL (youtu.be/<videoId>)
  if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      videoId = parts[0];
    }
  } 
  // Case 2: youtube.com (watch?v=, /shorts/, /embed/, /v/, /live/)
  else {
    if (parsedUrl.searchParams.has('v')) {
      videoId = parsedUrl.searchParams.get('v');
    } else {
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      const supportedPrefixes = ['shorts', 'embed', 'v', 'live'];
      if (parts.length >= 2 && supportedPrefixes.includes(parts[0].toLowerCase())) {
        videoId = parts[1];
      }
    }
  }

  // Validate 11-character ID format
  if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return videoId;
  }

  return null;
};

