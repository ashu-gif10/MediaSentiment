import { extractYouTubeVideoId } from '../utils/youtubeValidator.js';
import { getVideoDetails, getVideoComments } from '../services/youtubeService.js';
import { downloadYouTubeCommentsWithPython } from '../services/pythonDownloaderService.js';
import { analyzeCommentsWithVader } from '../services/vaderService.js';
import { analyzeComments as analyzeCommentsWithGemini } from '../services/geminiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Analysis from '../models/Analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is explicitly loaded if not already loaded in memory
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config();
}

/**
 * Controller to handle Dual Sentiment Analysis: VADER (all 1000+ comments) + Gemini AI (advanced contextual batches)
 * POST /api/analyze/youtube
 * POST /api/analyze/python
 */
export const analyzeYouTubeComments = async (req, res) => {
  // Set extended timeout for large comment batches
  req.setTimeout(300000); // 5 minutes

  try {
    const { 
      url, 
      videoId: rawVideoId, 
      maxAnalyze = 100, // Gemini batch analysis limit
      downloadLimit = 1000, // Fetch up to 1000 comments
      engine = 'python' 
    } = req.body;

    const input = (url || rawVideoId || '').trim();
    if (!input) {
      return res.status(400).json({
        success: false,
        message: 'YouTube URL or Video ID is required.',
      });
    }

    const videoId = extractYouTubeVideoId(input);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YouTube URL or unsupported format. Please provide a valid YouTube link (e.g., https://youtu.be/... or https://youtube.com/watch?v=...).',
      });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API Key is missing in server/.env configuration.',
      });
    }

    const youtubeApiKey = process.env.YOUTUBE_API_KEY;

    console.log(`[AnalysisController] Target Video ID: ${videoId} | Engine: ${engine} | Fetch Limit: ${downloadLimit} | Gemini Batch Limit: ${maxAnalyze}`);

    // Step 1: Fetch Video Metadata
    let videoDetails = {
      id: videoId,
      title: `YouTube Video (${videoId})`,
      channelTitle: 'YouTube Creator',
      publishedAt: new Date().toISOString(),
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      views: 0,
      likes: 0,
      commentCount: 0,
    };

    if (youtubeApiKey) {
      try {
        const fetchedDetails = await getVideoDetails(videoId, youtubeApiKey);
        videoDetails = fetchedDetails;
      } catch (err) {
        console.warn(`[AnalysisController] Could not fetch video details via YouTube API: ${err.message}. Using standard video metadata.`);
      }
    }

    // Step 2: Fetch Comments via selected Engine (Python Downloader vs YouTube Data API)
    let commentsResult = {
      comments: [],
      totalFetched: 0,
      topLevelCount: 0,
      replyCount: 0,
      commentsDisabled: false,
    };

    const targetFetchLimit = Math.max(10, Math.min(parseInt(downloadLimit, 10) || 1000, 2000));
    const chosenEngine = (engine === 'youtube_api' && youtubeApiKey) ? 'youtube_api' : 'python';

    if (chosenEngine === 'python') {
      console.log(`[AnalysisController] Fetching comments using Python youtube-comment-downloader (target limit: ${targetFetchLimit})...`);
      try {
        commentsResult = await downloadYouTubeCommentsWithPython(input, {
          limit: targetFetchLimit,
          sort: 0,
        });
      } catch (pyErr) {
        console.error('[AnalysisController] Python downloader failed:', pyErr.message);
        if (youtubeApiKey) {
          console.log('[AnalysisController] Falling back to YouTube Data API v3...');
          commentsResult = await getVideoComments(videoId, youtubeApiKey, {
            maxPages: Math.ceil(targetFetchLimit / 100),
            maxComments: targetFetchLimit,
          });
        } else {
          throw new Error(`Python downloader failed: ${pyErr.message}`);
        }
      }
    } else {
      console.log('[AnalysisController] Fetching comments using official YouTube Data API v3...');
      commentsResult = await getVideoComments(videoId, youtubeApiKey, {
        maxPages: Math.ceil(targetFetchLimit / 100),
        maxComments: targetFetchLimit,
      });
    }

    // Case A: Comments disabled on YouTube
    if (commentsResult.commentsDisabled) {
      return res.status(200).json({
        success: true,
        video: videoDetails,
        hasComments: false,
        commentsDisabled: true,
        message: 'Comments are turned off/disabled for this video by the creator.',
        metrics: {
          totalAvailable: videoDetails.commentCount || 0,
          totalFetched: 0,
          topLevelCount: 0,
          replyCount: 0,
          totalVaderAnalyzed: 0,
          totalGeminiAnalyzed: 0,
          failedCount: 0,
          engine: chosenEngine,
          sarcasticCount: 0,
          sarcasmRate: 0,
        },
        vader: {
          totalAnalyzed: 0,
          stats: { positive: 0, negative: 0, neutral: 0 },
          percentages: { positive: 0, negative: 0, neutral: 0 },
          pieChartData: [],
        },
        gemini: {
          totalAnalyzed: 0,
          stats: { positive: 0, negative: 0, neutral: 0 },
          percentages: { positive: 0, negative: 0, neutral: 0 },
          pieChartData: [],
          topKeywords: [],
          criticalFeedback: [],
          summary: 'Comments are disabled on YouTube for this video.',
        },
        sarcasmAnalytics: {
          totalAnalyzed: 0,
          sarcasticCount: 0,
          nonSarcasticCount: 0,
          uncertainCount: 0,
          sarcasmRate: 0,
          sarcasticComments: [],
        },
        comparison: {
          agreementRate: 100,
          agreementCount: 0,
          disagreementCount: 0,
          breakdown: {},
        },
        analysis: {
          totalAnalyzed: 0,
          failedCount: 0,
          stats: { positive: 0, negative: 0, neutral: 0 },
          percentages: { positive: 0, negative: 0, neutral: 0 },
          pieChartData: [],
          topKeywords: [],
          criticalFeedback: [],
          summary: 'Comments are disabled on YouTube for this video.',
          comments: [],
        },
        comments: [],
      });
    }

    // Case B: Video has 0 comments
    if (commentsResult.comments.length === 0) {
      return res.status(200).json({
        success: true,
        video: videoDetails,
        hasComments: false,
        commentsDisabled: false,
        message: 'This video currently has 0 comments on YouTube to analyze.',
        metrics: {
          totalAvailable: videoDetails.commentCount || 0,
          totalFetched: 0,
          topLevelCount: 0,
          replyCount: 0,
          totalVaderAnalyzed: 0,
          totalGeminiAnalyzed: 0,
          failedCount: 0,
          engine: chosenEngine,
          sarcasticCount: 0,
          sarcasmRate: 0,
        },
        vader: {
          totalAnalyzed: 0,
          stats: { positive: 0, negative: 0, neutral: 0 },
          percentages: { positive: 0, negative: 0, neutral: 0 },
          pieChartData: [],
        },
        gemini: {
          totalAnalyzed: 0,
          stats: { positive: 0, negative: 0, neutral: 0 },
          percentages: { positive: 0, negative: 0, neutral: 0 },
          pieChartData: [],
          topKeywords: [],
          criticalFeedback: [],
          summary: 'No audience comments have been posted on this video yet.',
        },
        sarcasmAnalytics: {
          totalAnalyzed: 0,
          sarcasticCount: 0,
          nonSarcasticCount: 0,
          uncertainCount: 0,
          sarcasmRate: 0,
          sarcasticComments: [],
        },
        comparison: {
          agreementRate: 100,
          agreementCount: 0,
          disagreementCount: 0,
          breakdown: {},
        },
        analysis: {
          totalAnalyzed: 0,
          failedCount: 0,
          stats: { positive: 0, negative: 0, neutral: 0 },
          percentages: { positive: 0, negative: 0, neutral: 0 },
          pieChartData: [],
          topKeywords: [],
          criticalFeedback: [],
          summary: 'No audience comments have been posted on this video yet.',
          comments: [],
        },
        comments: [],
      });
    }

    // Step 3: Run VADER Sentiment & Real Emoji Analysis on ALL successfully fetched comments
    console.log(`[AnalysisController] Running VADER sentiment & Emoji analysis on ALL ${commentsResult.comments.length} fetched comments...`);
    const vaderRes = await analyzeCommentsWithVader(commentsResult.comments, commentsResult.emojiAnalytics);
    const emojiAnalytics = vaderRes.emojiAnalytics || commentsResult.emojiAnalytics || {
      totalEmojisDetected: 0,
      uniqueEmojisCount: 0,
      commentsWithEmojisCount: 0,
      emojiUsagePercentage: 0,
      sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
      topEmojis: [],
      conflictingCommentsCount: 0,
      conflictingComments: [],
    };

    const vaderPieData = [
      {
        name: 'Positive',
        value: vaderRes.vaderAnalysis.stats.positive,
        percentage: vaderRes.vaderAnalysis.percentages.positive,
        color: '#10b981',
      },
      {
        name: 'Negative',
        value: vaderRes.vaderAnalysis.stats.negative,
        percentage: vaderRes.vaderAnalysis.percentages.negative,
        color: '#f43f5e',
      },
      {
        name: 'Neutral',
        value: vaderRes.vaderAnalysis.stats.neutral,
        percentage: vaderRes.vaderAnalysis.percentages.neutral,
        color: '#3b82f6',
      },
    ];

    // Step 4: Run Gemini AI Advanced Analysis in sequential batches of 25
    const requestedGeminiMax = parseInt(maxAnalyze, 10) || 100;
    const geminiAnalyzeLimit = Math.min(vaderRes.comments.length, requestedGeminiMax);

    console.log(`[AnalysisController] Running Gemini AI advanced analysis on ${geminiAnalyzeLimit} comments out of ${vaderRes.comments.length}...`);
    const aiAnalysis = await analyzeCommentsWithGemini(
      vaderRes.comments,
      videoDetails,
      geminiApiKey,
      geminiAnalyzeLimit
    );

    const geminiPieData = [
      {
        name: 'Positive',
        value: aiAnalysis.stats.positive,
        percentage: aiAnalysis.percentages.positive,
        color: '#10b981',
      },
      {
        name: 'Negative',
        value: aiAnalysis.stats.negative,
        percentage: aiAnalysis.percentages.negative,
        color: '#f43f5e',
      },
      {
        name: 'Neutral',
        value: aiAnalysis.stats.neutral,
        percentage: aiAnalysis.percentages.neutral,
        color: '#3b82f6',
      },
    ];

    // Step 5: Merge and Compute Model Agreement & Disagreement Statistics
    // Map Gemini analysis results by comment ID
    const geminiMap = new Map();
    (aiAnalysis.comments || []).forEach(gc => {
      geminiMap.set(gc.id, gc);
    });

    let agreementCount = 0;
    let disagreementCount = 0;
    const disagreementBreakdown = {
      'VADER Pos / Gemini Neu': 0,
      'VADER Pos / Gemini Neg': 0,
      'VADER Neu / Gemini Pos': 0,
      'VADER Neu / Gemini Neg': 0,
      'VADER Neg / Gemini Pos': 0,
      'VADER Neg / Gemini Neu': 0,
    };
    const sampleDisagreements = [];

    const finalComments = vaderRes.comments.map(c => {
      const gItem = geminiMap.get(c.id);
      const vaderSentiment = c.vader?.sentiment || 'Neutral';

      if (gItem) {
        const geminiSentiment = gItem.sentiment;
        const isAgreed = vaderSentiment === geminiSentiment;

        if (isAgreed) {
          agreementCount++;
        } else {
          disagreementCount++;
          const pairKey = `VADER ${vaderSentiment.slice(0, 3)} / Gemini ${geminiSentiment.slice(0, 3)}`;
          disagreementBreakdown[pairKey] = (disagreementBreakdown[pairKey] || 0) + 1;

          if (sampleDisagreements.length < 8) {
            sampleDisagreements.push({
              id: c.id,
              author: c.author,
              text: c.text,
              vaderSentiment,
              vaderCompound: c.vader?.compound,
              geminiSentiment,
              geminiReason: gItem.reason,
            });
          }
        }

        return {
          ...c,
          sentiment: geminiSentiment, // Primary display
          geminiSentiment,
          geminiReason: gItem.reason,
          keywords: gItem.keywords || [],
          isCritical: Boolean(gItem.isCritical),
          sarcasm: gItem.sarcasm || { verdict: 'Non-Sarcastic', explanation: 'Direct commentary without irony.' },
          isAgreed,
          hasGeminiAnalysis: true,
          emojis: c.emojis || [],
          emojiCount: c.emojiCount || 0,
          emojiSentiment: c.emojiSentiment || 'None',
          emojiConflict: c.emojiConflict || null,
        };
      }

      // Comment only analyzed by VADER
      return {
        ...c,
        sentiment: vaderSentiment,
        hasGeminiAnalysis: false,
        sarcasm: { verdict: 'Uncertain', explanation: 'Evaluated by VADER rule engine; requires Gemini AI for contextual sarcasm analysis.' },
        emojis: c.emojis || [],
        emojiCount: c.emojiCount || 0,
        emojiSentiment: c.emojiSentiment || 'None',
        emojiConflict: c.emojiConflict || null,
      };
    });

    const totalCompared = agreementCount + disagreementCount;
    const agreementRate = totalCompared > 0 ? Math.round((agreementCount / totalCompared) * 100) : 100;

    console.log(`[AnalysisController] Model Comparison on ${totalCompared} comments: ${agreementCount} Agreed (${agreementRate}%), ${disagreementCount} Disagreed.`);
    console.log(`[AnalysisController] Emojis Detected: ${emojiAnalytics.totalEmojisDetected} total across ${emojiAnalytics.commentsWithEmojisCount} comments (${emojiAnalytics.emojiUsagePercentage}%).`);
    console.log(`[AnalysisController] Contextual Sarcasm: ${aiAnalysis.sarcasmAnalytics?.sarcasticCount || 0} Sarcastic comments detected (${aiAnalysis.sarcasmAnalytics?.sarcasmRate || 0}% rate).`);

    const metricsData = {
      totalAvailable: videoDetails.commentCount || commentsResult.totalFetched,
      totalFetched: commentsResult.totalFetched,
      topLevelCount: commentsResult.topLevelCount,
      replyCount: commentsResult.replyCount,
      totalVaderAnalyzed: vaderRes.vaderAnalysis.totalAnalyzed,
      totalGeminiAnalyzed: aiAnalysis.totalAnalyzed,
      failedCount: aiAnalysis.failedCount,
      engine: chosenEngine,
      agreementRate,
      agreementCount,
      disagreementCount,
      totalCompared,
      totalEmojisDetected: emojiAnalytics.totalEmojisDetected,
      commentsWithEmojisCount: emojiAnalytics.commentsWithEmojisCount,
      conflictingCommentsCount: emojiAnalytics.conflictingCommentsCount,
      sarcasticCount: aiAnalysis.sarcasmAnalytics?.sarcasticCount || 0,
      sarcasmRate: aiAnalysis.sarcasmAnalytics?.sarcasmRate || 0,
    };

    const vaderData = {
      totalAnalyzed: vaderRes.vaderAnalysis.totalAnalyzed,
      stats: vaderRes.vaderAnalysis.stats,
      percentages: vaderRes.vaderAnalysis.percentages,
      averageCompound: vaderRes.vaderAnalysis.averageCompound,
      pieChartData: vaderPieData,
    };

    const geminiData = {
      totalAnalyzed: aiAnalysis.totalAnalyzed,
      stats: aiAnalysis.stats,
      percentages: aiAnalysis.percentages,
      pieChartData: geminiPieData,
      topKeywords: aiAnalysis.topKeywords,
      criticalFeedback: aiAnalysis.criticalFeedback,
      summary: aiAnalysis.summary,
      modelUsed: aiAnalysis.modelUsed,
    };

    const comparisonData = {
      totalCompared,
      agreementCount,
      disagreementCount,
      agreementRate,
      disagreementBreakdown,
      sampleDisagreements,
    };

    const sarcasmData = aiAnalysis.sarcasmAnalytics || {
      totalAnalyzed: aiAnalysis.totalAnalyzed || 0,
      sarcasticCount: 0,
      nonSarcasticCount: aiAnalysis.totalAnalyzed || 0,
      uncertainCount: 0,
      sarcasmRate: 0,
      sarcasticComments: [],
    };

    // Persist analysis to MongoDB Atlas if connected (non-blocking)
    let savedRecordId = null;
    try {
      if (mongoose.connection.readyState === 1) {
        const savedDoc = await Analysis.create({
          videoId,
          url: url || `https://youtu.be/${videoId}`,
          engine: chosenEngine,
          hasComments: true,
          video: videoDetails,
          metrics: metricsData,
          vader: vaderData,
          gemini: geminiData,
          comparison: comparisonData,
          emojiAnalytics: emojiAnalytics || {},
          sarcasmAnalytics: sarcasmData,
          comments: finalComments,
          analyzedAt: new Date(),
        });
        savedRecordId = savedDoc._id;
        console.log(`✅ [AnalysisController] Analysis saved to MongoDB Atlas history (ID: ${savedRecordId})`);
      } else {
        console.warn('⚠️  [AnalysisController] MongoDB disconnected; skipping history persistence.');
      }
    } catch (saveErr) {
      console.error('❌ [AnalysisController] Failed to persist analysis record to MongoDB:', saveErr.message);
    }

    return res.status(200).json({
      success: true,
      hasComments: true,
      _id: savedRecordId,
      video: videoDetails,
      metrics: metricsData,
      vader: vaderData,
      gemini: geminiData,
      comparison: comparisonData,
      emojiAnalytics,
      sarcasmAnalytics: sarcasmData,
      // Backward-compatible analysis key for older dashboard parts
      analysis: {
        ...aiAnalysis,
        pieChartData: geminiPieData,
        comments: finalComments,
      },
      comments: finalComments,
    });
  } catch (error) {
    console.error('[AnalysisController] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while analyzing YouTube comments.',
    });
  }
};
