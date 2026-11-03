import { analyzeCommentsWithVader } from '../services/vaderService.js';
import { analyzeComments as analyzeCommentsWithGemini } from '../services/geminiService.js';
import { fetchDirectFlipkartReviews, scrapeFlipkartReviews } from '../services/flipkartScraperService.js';
import { validateAndParseReviewsCsv } from '../utils/csvParser.js';
import { validateFlipkartUrl } from '../utils/flipkartValidator.js';
import Analysis from '../models/Analysis.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config();
}

/**
 * Controller to handle CSV Product Review Sentiment & Contextual Analysis
 * POST /api/analyze/reviews
 * POST /api/analyze/product-reviews
 */
export const analyzeProductReviews = async (req, res) => {
  req.setTimeout(300000); // 5 minutes timeout for large batches

  try {
    const {
      reviews: rawReviews,
      csvText,
      metadata = {},
      maxAnalyze = 100,
    } = req.body;

    let targetReviews = [];
    let detectedCols = null;

    // 1. Process either raw CSV text or pre-parsed reviews array
    if (csvText && typeof csvText === 'string') {
      const parsed = validateAndParseReviewsCsv(csvText);
      if (!parsed.valid) {
        return res.status(400).json({
          success: false,
          message: parsed.error,
          columnsDetected: parsed.columnsDetected,
        });
      }
      targetReviews = parsed.reviews;
      detectedCols = parsed.columnsDetected;
    } else if (Array.isArray(rawReviews) && rawReviews.length > 0) {
      targetReviews = rawReviews
        .filter(r => r && (r.text || r.review || r.review_text))
        .map((r, i) => ({
          id: r.id || `rev-${i + 1}`,
          text: (r.text || r.review || r.review_text || '').trim(),
          rawReview: (r.text || r.review || r.review_text || '').trim(),
          author: r.author || r.reviewer || `Customer #${i + 1}`,
          rating: typeof r.rating === 'number' ? r.rating : (r.rating ? parseFloat(r.rating) : null),
          date: r.date || undefined,
        }))
        .filter(r => r.text.length > 0);

      if (targetReviews.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV validation failed: All provided rows contained empty review text.',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'No review data provided. Please upload a CSV file with product reviews.',
      });
    }

    // Safety limit: up to 2000 reviews
    if (targetReviews.length > 2000) {
      targetReviews = targetReviews.slice(0, 2000);
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API Key is missing in server/.env configuration.',
      });
    }

    const productName = (metadata.productName || '').trim() || 'Product Reviews Dataset';
    const productUrl = (metadata.productUrl || '').trim();
    const isDemo = metadata.isDemo === true || metadata.dataSource === 'sample_demo';
    const dataSource = isDemo ? 'sample_demo' : (metadata.dataSource || 'user_csv');
    const dataSourceLabel = isDemo ? 'Sample / Benchmark Dataset (Demo)' : 'Live User-Imported Reviews (CSV)';

    console.log(`[ReviewController] Analyzing ${targetReviews.length} product reviews for "${productName}" (Gemini batch limit: ${maxAnalyze}, Mode: ${dataSourceLabel})`);

    // 2. Compute Star Rating Statistics (if rating data is available)
    const ratedReviews = targetReviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating) && r.rating >= 1 && r.rating <= 5);
    let ratingStats = {
      hasRatings: ratedReviews.length > 0,
      totalRated: ratedReviews.length,
      averageRating: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      percentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    if (ratedReviews.length > 0) {
      let ratingSum = 0;
      ratedReviews.forEach(r => {
        const star = Math.round(r.rating);
        if (ratingStats.distribution[star] !== undefined) {
          ratingStats.distribution[star]++;
          ratingSum += r.rating;
        }
      });
      ratingStats.averageRating = Math.round((ratingSum / ratedReviews.length) * 10) / 10;
      Object.keys(ratingStats.distribution).forEach(star => {
        ratingStats.percentages[star] = Math.round((ratingStats.distribution[star] / ratedReviews.length) * 100);
      });
    }

    // 3. Step 1: Run VADER Sentiment & Emoji Analytics on ALL reviews
    console.log(`[ReviewController] Running VADER & Emoji analysis across all ${targetReviews.length} reviews...`);
    const vaderRes = await analyzeCommentsWithVader(targetReviews);
    const emojiAnalytics = vaderRes.emojiAnalytics || {
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

    // 4. Step 2: Run Gemini AI Advanced Contextual Analysis in sequential batches of 25
    const requestedGeminiMax = parseInt(maxAnalyze, 10) || 100;
    const geminiAnalyzeLimit = Math.min(vaderRes.comments.length, requestedGeminiMax);

    console.log(`[ReviewController] Running Gemini AI advanced analysis on ${geminiAnalyzeLimit} reviews...`);
    const productDetailsForGemini = {
      title: productName,
      channelTitle: productUrl ? 'Amazon Reference Product' : 'CSV Dataset',
    };

    const aiAnalysis = await analyzeCommentsWithGemini(
      vaderRes.comments,
      productDetailsForGemini,
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

    // 5. Merge and compute Model Agreement
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

    const finalReviews = vaderRes.comments.map(c => {
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
              rating: c.rating,
              vaderSentiment,
              vaderCompound: c.vader?.compound,
              geminiSentiment,
              geminiReason: gItem.reason,
            });
          }
        }

        return {
          ...c,
          sentiment: geminiSentiment,
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

    const metricsData = {
      totalAvailable: targetReviews.length,
      totalFetched: targetReviews.length,
      topLevelCount: targetReviews.length,
      replyCount: 0,
      totalVaderAnalyzed: vaderRes.vaderAnalysis.totalAnalyzed,
      totalGeminiAnalyzed: aiAnalysis.totalAnalyzed,
      failedCount: aiAnalysis.failedCount,
      engine: 'csv_product_review',
      dataSource,
      dataSourceLabel,
      isDemo,
      agreementRate,
      agreementCount,
      disagreementCount,
      totalCompared,
      totalEmojisDetected: emojiAnalytics.totalEmojisDetected,
      commentsWithEmojisCount: emojiAnalytics.commentsWithEmojisCount,
      conflictingCommentsCount: emojiAnalytics.conflictingCommentsCount,
      sarcasticCount: aiAnalysis.sarcasmAnalytics?.sarcasticCount || 0,
      sarcasmRate: aiAnalysis.sarcasmAnalytics?.sarcasmRate || 0,
      averageRating: ratingStats.averageRating,
      ratingDistribution: ratingStats.distribution,
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

    // Virtual video details structure for 100% backward compatibility with charts & PDF exporter
    const virtualVideoDetails = {
      id: `product_${Date.now()}`,
      title: productName,
      channelTitle: isDemo
        ? 'Demo Benchmark Dataset'
        : (productUrl ? (productUrl.includes('flipkart') ? 'Flipkart Reference' : 'Reference Product') : 'User CSV Dataset'),
      publishedAt: new Date().toISOString(),
      thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80',
      views: targetReviews.length,
      likes: vaderRes.vaderAnalysis.stats.positive,
      commentCount: targetReviews.length,
      productUrl: productUrl || undefined,
    };

    // 6. Persist to MongoDB Atlas if connected (non-blocking)
    let savedRecordId = null;
    try {
      if (mongoose.connection.readyState === 1) {
        const savedDoc = await Analysis.create({
          videoId: `product_${Date.now()}`,
          url: productUrl || '',
          engine: 'csv_product_review',
          isDemo,
          product: {
            name: productName,
            url: productUrl,
            dataSource,
            dataSourceLabel,
            isDemo,
          },
          hasComments: true,
          video: virtualVideoDetails,
          metrics: metricsData,
          vader: vaderData,
          gemini: geminiData,
          comparison: comparisonData,
          emojiAnalytics: emojiAnalytics || {},
          sarcasmAnalytics: sarcasmData,
          comments: finalReviews,
          analyzedAt: new Date(),
        });
        savedRecordId = savedDoc._id;
        console.log(`✅ [ReviewController] Product review analysis saved to MongoDB Atlas (ID: ${savedRecordId})`);
      } else {
        console.warn('⚠️  [ReviewController] MongoDB disconnected; skipping history persistence.');
      }
    } catch (saveErr) {
      console.error('❌ [ReviewController] Failed to persist product review analysis to MongoDB:', saveErr.message);
    }

    return res.status(200).json({
      success: true,
      hasComments: true,
      _id: savedRecordId,
      engine: 'csv_product_review',
      isDemo,
      product: {
        name: productName,
        url: productUrl,
        dataSource,
        dataSourceLabel,
        isDemo,
      },
      video: virtualVideoDetails,
      metrics: metricsData,
      vader: vaderData,
      gemini: geminiData,
      comparison: comparisonData,
      emojiAnalytics,
      sarcasmAnalytics: sarcasmData,
      ratingStats,
      comments: finalReviews,
      columnsDetected: detectedCols,
      analysis: {
        ...aiAnalysis,
        pieChartData: geminiPieData,
        comments: finalReviews,
      },
    });
  } catch (error) {
    console.error('[ReviewController] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while analyzing product reviews.',
    });
  }
};

/**
 * Controller to validate Flipkart Product URLs and extract product metadata
 * POST /api/analyze/flipkart/validate
 */
export const validateFlipkartProductUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Flipkart product URL is required.',
      });
    }

    const validation = validateFlipkartUrl(url);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        url: validation.cleanUrl,
        productName: validation.productName,
        productId: validation.productId,
        fsn: validation.fsn,
        slug: validation.slug,
        hasScrapeDoToken: Boolean(process.env.SCRAPEDO_TOKEN && process.env.SCRAPEDO_TOKEN.trim()),
        message: 'Valid Flipkart product link confirmed.',
        automatedScrapingSupported: true,
        notice: 'Direct live review fetching is active. Click "Analyze Reviews" to extract genuine customer reviews and run sentiment analysis automatically.',
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while validating Flipkart URL.',
    });
  }
};

/**
 * Controller to fetch live Flipkart customer reviews using free direct HTTPS fetcher
 * (with optional fallback to flipkart-scraping & Scrape.do proxy)
 * POST /api/analyze/flipkart/fetch-reviews
 */
export const fetchFlipkartReviews = async (req, res) => {
  try {
    const { url, maxItems = 50 } = req.body;
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Flipkart product URL is required.',
      });
    }

    const validation = validateFlipkartUrl(url);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const targetMax = parseInt(maxItems, 10) || 50;

    // 1. Primary Strategy: Free, direct HTTPS review extraction from Flipkart
    console.log(`[ReviewController] Attempting free direct review fetch for: ${validation.cleanUrl} (max: ${targetMax})`);
    let directResult = null;
    try {
      directResult = await fetchDirectFlipkartReviews(validation.cleanUrl, targetMax);
    } catch (directErr) {
      console.warn('[ReviewController] Direct fetch warning:', directErr.message);
    }

    if (directResult && directResult.success && directResult.reviews.length > 0) {
      const reviews = directResult.reviews;
      const csvHeader = 'review_text,rating,date,author,title\n';
      const csvRows = reviews.map((r) => {
        const cleanText = (r.review_text || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
        const cleanTitle = (r.title || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
        const cleanAuthor = (r.author || 'Certified Buyer').replace(/"/g, '""');
        const rating = r.rating !== null && r.rating !== undefined ? r.rating : '';
        const date = r.date || '';
        return `"${cleanText}",${rating},"${date}","${cleanAuthor}","${cleanTitle}"`;
      }).join('\n');
      const csvText = csvHeader + csvRows;

      console.log(`[ReviewController] Successfully fetched ${reviews.length} reviews directly from Flipkart`);

      return res.status(200).json({
        success: true,
        errorType: null,
        productName: directResult.productName || validation.productName,
        productUrl: validation.cleanUrl,
        totalFetched: reviews.length,
        reviews,
        csvText,
        source: 'direct_https',
        statusCode: directResult.statusCode || 200,
        finalUrl: directResult.finalUrl || validation.cleanUrl,
        contentType: directResult.contentType || 'text/html',
        message: `Successfully retrieved ${reviews.length} genuine customer reviews from Flipkart!`,
      });
    }

    // 2. Secondary Fallback: If direct fetch returned 0 reviews, check if SCRAPEDO_TOKEN is present
    const token = (process.env.SCRAPEDO_TOKEN || '').trim();
    if (token) {
      console.log(`[ReviewController] Direct fetch returned 0 reviews; falling back to flipkart-scraping proxy`);
      const scrapeResult = await scrapeFlipkartReviews(validation.cleanUrl, {
        maxItems: targetMax,
        maxPages: 3,
      });

      if (scrapeResult && scrapeResult.success && scrapeResult.reviews?.length > 0) {
        const reviews = scrapeResult.reviews;
        const csvHeader = 'review_text,rating,date,author,title\n';
        const csvRows = reviews.map((r) => {
          const cleanText = (r.review_text || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
          const cleanTitle = (r.title || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
          const cleanAuthor = (r.author || 'Certified Buyer').replace(/"/g, '""');
          const rating = r.rating !== null && r.rating !== undefined ? r.rating : '';
          const date = r.date || '';
          return `"${cleanText}",${rating},"${date}","${cleanAuthor}","${cleanTitle}"`;
        }).join('\n');
        const csvText = csvHeader + csvRows;

        return res.status(200).json({
          success: true,
          errorType: null,
          productName: scrapeResult.productTitle || validation.productName,
          productUrl: validation.cleanUrl,
          totalFetched: reviews.length,
          reviews,
          csvText,
          source: 'scrapedo_proxy',
          statusCode: 200,
          finalUrl: validation.cleanUrl,
          contentType: 'text/html',
          message: `Successfully fetched ${reviews.length} customer reviews from Flipkart via proxy!`,
        });
      }
    }

    // 3. If zero reviews found, return specific error category and diagnostics
    return res.status(200).json({
      success: false,
      errorType: directResult?.errorType || 'no_reviews',
      message: directResult?.message || 'No customer reviews found on this Flipkart product page or the product has not received customer reviews yet.',
      statusCode: directResult?.statusCode || 200,
      finalUrl: directResult?.finalUrl || validation.cleanUrl,
      contentType: directResult?.contentType || 'text/html',
      isBlocked: Boolean(directResult?.isBlocked),
      isDelisted: Boolean(directResult?.isDelisted),
      totalFetched: 0,
      reviews: [],
    });
  } catch (error) {
    console.error('[ReviewController] Error in fetchFlipkartReviews:', error);
    return res.status(500).json({
      success: false,
      errorType: 'server_error',
      message: error.message || 'An unexpected error occurred while fetching reviews from Flipkart.',
      totalFetched: 0,
      reviews: [],
    });
  }
};


