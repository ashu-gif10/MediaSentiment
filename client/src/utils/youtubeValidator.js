/**
 * Extract and validate 11-character YouTube Video ID from any valid YouTube URL
 * Handles:
 * - Short URLs: https://youtu.be/FRkJ8uGCEEE?si=9BJOG8FcUu1fDuxP
 * - Standard Watch: https://www.youtube.com/watch?v=FRkJ8uGCEEE&feature=share
 * - YouTube Shorts: https://youtube.com/shorts/FRkJ8uGCEEE
 * - Embed / Live: https://www.youtube.com/embed/FRkJ8uGCEEE, https://youtube.com/live/FRkJ8uGCEEE
 * - Raw 11-char Video ID directly: FRkJ8uGCEEE
 *
 * Uses the Web standard URL API instead of a restrictive regex.
 * Validates hostname to prevent SSRF and unrelated domains.
 *
 * @param {string} input - YouTube URL or Video ID
 * @returns {string|null} - 11-character Video ID or null if invalid
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
    // If URL lacks protocol, prepend https://
    const urlWithProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsedUrl = new URL(urlWithProtocol);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Validate hostname strictly to prevent arbitrary websites
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

  // Final check: Video ID must be exactly 11 characters
  if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return videoId;
  }

  return null;
};

