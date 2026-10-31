import axios from 'axios';

// Read backend API URL with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes timeout for 1000 comments Python fetch + multi-batch Gemini AI analysis
});

/**
 * Express backend health check
 * Endpoint: GET /api/health
 */
export const checkBackendHealth = async () => {
  try {
    const response = await api.get('/health', {
      params: { _t: Date.now() },
      timeout: 10000,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Cannot reach backend server',
    };
  }
};

/**
 * Send YouTube URL to backend for comment fetch (Python or YouTube API) & batched Gemini AI sentiment analysis
 * Endpoint: POST /api/analyze/youtube
 * 
 * @param {string} url - YouTube URL or videoId
 * @param {number} maxAnalyze - Number of comments to analyze with Gemini (e.g. 50, 100, 250, 500)
 * @param {Object} options - Engine & limit options
 * @param {string} options.engine - 'python' (default) or 'youtube_api'
 * @param {number} options.downloadLimit - Max comments to download via Python (default 1000)
 */
export const analyzeYouTubeComments = async (url, maxAnalyze = 100, options = {}) => {
  try {
    const { engine = 'python', downloadLimit = 1000 } = options;
    const response = await api.post('/analyze/youtube', {
      url,
      maxAnalyze,
      downloadLimit,
      engine,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to analyze YouTube comments',
    };
  }
};

/**
 * Fetch saved analysis history from MongoDB Atlas
 * Endpoint: GET /api/history
 */
export const fetchAnalysisHistory = async (params = {}) => {
  try {
    const response = await api.get('/history', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch analysis history',
    };
  }
};

/**
 * Fetch a single saved analysis by MongoDB ID
 * Endpoint: GET /api/history/:id
 */
export const fetchAnalysisById = async (id) => {
  try {
    const response = await api.get(`/history/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to load analysis record',
    };
  }
};

/**
 * Delete a saved analysis by MongoDB ID
 * Endpoint: DELETE /api/history/:id
 */
export const deleteAnalysisRecord = async (id) => {
  try {
    const response = await api.delete(`/history/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to delete analysis record',
    };
  }
};

export default api;
