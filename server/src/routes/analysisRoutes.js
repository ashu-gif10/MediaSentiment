import express from 'express';
import { analyzeYouTubeComments } from '../controllers/analysisController.js';
import { extractYouTubeVideoId } from '../utils/youtubeValidator.js';

const router = express.Router();

// POST /api/analyze/youtube - Perform end-to-end YouTube sentiment analysis (supports engine: 'python' | 'youtube_api')
router.post('/youtube', analyzeYouTubeComments);

// POST /api/analyze/python - Explicit endpoint for Python-based analysis
router.post('/python', (req, res, next) => {
  req.body.engine = 'python';
  return analyzeYouTubeComments(req, res, next);
});

// POST /api/analyze/validate-url - Quick validation endpoint
router.post('/validate-url', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required.' });
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return res.status(400).json({ success: false, message: 'Invalid YouTube URL.' });
  }

  return res.status(200).json({
    success: true,
    videoId,
    message: 'Valid YouTube Video ID extracted successfully.',
  });
});

export default router;
