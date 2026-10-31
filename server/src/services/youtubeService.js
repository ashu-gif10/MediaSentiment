import axios from 'axios';

/**
 * Service to interact with the official YouTube Data API v3
 * Handles video metadata, multi-page commentThreads pagination, and replies.
 */

/**
 * Fetch video metadata (title, channel, views, likes, commentCount, thumbnails)
 * @param {string} videoId - 11-char YouTube Video ID
 * @param {string} apiKey - YouTube Data API v3 key
 */
export const getVideoDetails = async (videoId, apiKey) => {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,statistics',
        id: videoId,
        key: apiKey,
      },
      timeout: 15000,
    });

    const item = response.data?.items?.[0];
    if (!item) {
      throw new Error('YouTube video not found or invalid video ID.');
    }

    return {
      id: videoId,
      title: item.snippet?.title || 'Unknown Title',
      channelTitle: item.snippet?.channelTitle || 'Unknown Channel',
      publishedAt: item.snippet?.publishedAt,
      description: item.snippet?.description?.slice(0, 200) || '',
      thumbnail: item.snippet?.thumbnails?.maxres?.url || 
                 item.snippet?.thumbnails?.high?.url || 
                 item.snippet?.thumbnails?.medium?.url || '',
      views: parseInt(item.statistics?.viewCount || '0', 10),
      likes: parseInt(item.statistics?.likeCount || '0', 10),
      commentCount: parseInt(item.statistics?.commentCount || '0', 10),
    };
  } catch (error) {
    if (error.response?.data?.error?.message) {
      throw new Error(`YouTube API Error: ${error.response.data.error.message}`);
    }
    throw error;
  }
};

/**
 * Fetch comments with full pagination and reply support
 * Uses YouTube Data API v3 commentThreads.list with part=snippet,replies
 * 
 * @param {string} videoId - 11-char YouTube Video ID
 * @param {string} apiKey - YouTube API Key
 * @param {Object} options - Pagination configuration
 * @param {number} options.maxPages - Maximum pages to retrieve (default 12 = up to 1,200 comment threads)
 * @param {number} options.maxComments - Total comments safety limit (default 1500)
 */
export const getVideoComments = async (videoId, apiKey, options = {}) => {
  const maxPages = options.maxPages || 12;
  const maxCommentsLimit = options.maxComments || 1500;

  const topLevelComments = [];
  const replyComments = [];
  let pageToken = '';
  let pageCount = 0;

  try {
    while (pageCount < maxPages) {
      pageCount++;

      const params = {
        part: 'snippet,replies',
        videoId: videoId,
        maxResults: 100, // Maximum per page allowed by YouTube Data API v3
        textFormat: 'plainText',
        order: 'relevance', // Most relevant comments first
        key: apiKey,
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      console.log(`[YouTubeService] Fetching page ${pageCount} of commentThreads for video ${videoId}...`);
      const response = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
        params,
        timeout: 20000,
      });

      const items = response.data?.items || [];
      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        // 1. Top-Level Comment
        const topSnippet = item.snippet?.topLevelComment?.snippet;
        if (topSnippet) {
          topLevelComments.push({
            id: item.id,
            author: topSnippet.authorDisplayName || 'Anonymous User',
            authorProfileImageUrl: topSnippet.authorProfileImageUrl || '',
            text: topSnippet.textDisplay || '',
            likeCount: topSnippet.likeCount || 0,
            publishedAt: topSnippet.publishedAt || new Date().toISOString(),
            isReply: false,
            parentId: null,
          });
        }

        // 2. Inline Replies from item.replies.comments (YouTube provides up to 5 inline replies)
        if (item.replies?.comments && Array.isArray(item.replies.comments)) {
          for (const rep of item.replies.comments) {
            const repSnippet = rep.snippet;
            if (repSnippet) {
              replyComments.push({
                id: rep.id,
                author: repSnippet.authorDisplayName || 'Anonymous User',
                authorProfileImageUrl: repSnippet.authorProfileImageUrl || '',
                text: repSnippet.textDisplay || '',
                likeCount: repSnippet.likeCount || 0,
                publishedAt: repSnippet.publishedAt || new Date().toISOString(),
                isReply: true,
                parentId: item.id,
              });
            }
          }
        }

        // Safety limit check
        if ((topLevelComments.length + replyComments.length) >= maxCommentsLimit) {
          console.log(`[YouTubeService] Reached safety limit of ${maxCommentsLimit} comments.`);
          break;
        }
      }

      // Check if another page exists
      pageToken = response.data?.nextPageToken || null;
      if (!pageToken || (topLevelComments.length + replyComments.length) >= maxCommentsLimit) {
        break;
      }
    }

    // Combine top-level and replies without duplicate counting
    const combinedComments = [...topLevelComments, ...replyComments];
    console.log(`[YouTubeService] Completed fetch: ${topLevelComments.length} top-level + ${replyComments.length} replies = ${combinedComments.length} total comments across ${pageCount} pages.`);

    return {
      comments: combinedComments,
      topLevelComments,
      replyComments,
      totalFetched: combinedComments.length,
      topLevelCount: topLevelComments.length,
      replyCount: replyComments.length,
      pagesFetched: pageCount,
      hasMore: Boolean(pageToken),
      commentsDisabled: false,
    };
  } catch (error) {
    const apiError = error.response?.data?.error;
    if (apiError) {
      const reason = apiError.errors?.[0]?.reason;
      if (reason === 'commentsDisabled') {
        return {
          comments: [],
          topLevelComments: [],
          replyComments: [],
          totalFetched: 0,
          topLevelCount: 0,
          replyCount: 0,
          pagesFetched: 0,
          hasMore: false,
          commentsDisabled: true,
          error: 'Comments are turned off/disabled for this video by the creator.',
        };
      }
      throw new Error(`YouTube API Error: ${apiError.message || 'Failed to fetch comment threads'}`);
    }
    throw error;
  }
};
