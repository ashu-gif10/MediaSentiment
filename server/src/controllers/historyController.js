import mongoose from 'mongoose';
import Analysis from '../models/Analysis.js';

/**
 * GET /api/history
 * List saved analysis records (paginated, latest first, excluding full comments array for efficiency)
 */
export const getHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const query = {};
    if (search) {
      query.$or = [
        { 'video.title': { $regex: search, $options: 'i' } },
        { 'video.channelTitle': { $regex: search, $options: 'i' } },
        { videoId: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, records] = await Promise.all([
      Analysis.countDocuments(query),
      Analysis.find(query)
        .select('-comments') // Exclude heavy comments array for list performance
        .sort({ analyzedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      count: records.length,
      total,
      page,
      totalPages,
      data: records,
    });
  } catch (error) {
    console.error('[HistoryController] Error fetching history:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve analysis history.',
    });
  }
};

/**
 * GET /api/history/:id
 * Retrieve a single saved analysis in its entirety, including full comments and all analytics
 */
export const getHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid analysis record ID format.',
      });
    }

    const record = await Analysis.findById(id).lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Analysis record not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error(`[HistoryController] Error fetching record ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve analysis record.',
    });
  }
};

/**
 * DELETE /api/history/:id
 * Delete a specific analysis record by ID
 */
export const deleteHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid analysis record ID format.',
      });
    }

    const deleted = await Analysis.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Analysis record not found or already deleted.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Analysis record deleted successfully.',
      id,
    });
  } catch (error) {
    console.error(`[HistoryController] Error deleting record ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete analysis record.',
    });
  }
};

