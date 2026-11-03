import express from 'express';
import { analyzeProductReviews, validateFlipkartProductUrl, fetchFlipkartReviews } from '../controllers/reviewController.js';

const router = express.Router();

// POST /api/analyze/reviews
router.post('/', analyzeProductReviews);
router.post('/csv', analyzeProductReviews);

// POST /api/analyze/reviews/flipkart/validate
router.post('/flipkart/validate', validateFlipkartProductUrl);

// POST /api/analyze/reviews/flipkart/fetch-reviews
router.post('/flipkart/fetch-reviews', fetchFlipkartReviews);

export default router;

