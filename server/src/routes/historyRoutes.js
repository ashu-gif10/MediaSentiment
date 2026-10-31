import express from 'express';
import {
  getHistory,
  getHistoryById,
  deleteHistoryById,
} from '../controllers/historyController.js';

const router = express.Router();

// GET /api/history - List analysis history (paginated, latest first)
router.get('/', getHistory);

// GET /api/history/:id - Get full details of a saved analysis
router.get('/:id', getHistoryById);

// DELETE /api/history/:id - Delete a saved analysis by ID
router.delete('/:id', deleteHistoryById);

export default router;

