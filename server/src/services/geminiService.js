import axios from 'axios';

// Fast, stable Gemini models in verified priority order
const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

/**
 * Call Gemini REST API with model fallback and automatic retry
 */
const callGeminiWithFallback = async (prompt, apiKey) => {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // Low temperature for deterministic classification
            responseMimeType: 'application/json',
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 40000,
        }
      );

      const candidate = response.data?.candidates?.[0];
      const rawText = candidate?.content?.parts?.[0]?.text;
      if (rawText) {
        return { text: rawText, modelUsed: model };
      }
    } catch (err) {
      lastError = err;
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[GeminiService] Model ${model} encountered: ${errorMsg}. Trying next candidate...`);
    }
  }

  throw new Error(`Gemini AI service error: ${lastError?.response?.data?.error?.message || lastError?.message || 'Request failed'}`);
};

/**
 * Analyze a single batch of comments (20–30 comments)
 * @param {Array} batch - Slice of comments
 * @param {number} batchIndex - Batch number for logging
 * @param {string} apiKey - Gemini API Key
 */
const analyzeSingleBatch = async (batch, batchIndex, apiKey) => {
  const formattedComments = batch.map((c, i) => {
    const cleanText = (c.text || '').replace(/\r?\n|\r/g, ' ').slice(0, 250);
    const replyTag = c.isReply ? ' [REPLY]' : '';
    const emojiDetails = (c.emojis && c.emojis.length > 0)
      ? ` | Emojis: ${c.emojis.map(e => `${e.char}${e.name ? ` (${e.name})` : ''}`).join(', ')}`
      : '';
    return `[#${i + 1}] Author: ${c.author}${replyTag} | Comment: "${cleanText}"${emojiDetails}`;
  }).join('\n');

  const prompt = `
You are an expert Social Media Natural Language Sentiment and Contextual Sarcasm Analyst.
Analyze each YouTube comment below with its text and any detected emojis.

For each comment, you MUST provide:
1. "sentiment": Exactly one of "Positive", "Negative", or "Neutral".
2. "reason": Concise 1-sentence explanation of the sentiment.
3. "keywords": Array of 1-3 relevant topical keywords.
4. "isCritical": Boolean (true if constructive criticism or technical issue flagged).
5. "sarcasm": Contextual Sarcasm Detection object with:
   - "verdict": Exactly one of "Sarcastic", "Non-Sarcastic", or "Uncertain".
     * "Sarcastic": The comment expresses irony, mocking praise, backhanded compliment, satire, or saying the opposite of what is genuinely meant (e.g. mocking praise "kya acting hai", laughing emojis mixed with bitter derision, hyperbole, or praising something obviously flawed).
     * "Non-Sarcastic": Clear and unambiguous genuine appreciation, earnest criticism, direct factual observation, or straightforward sincere commentary without irony.
     * "Uncertain": The comment is ambiguous, an isolated fragment, a slang or rhetorical query without enough conversational context (e.g. "Bhai, brother, bro?? 😂", "wait what?", "kya chal raha hai??"), or where the viewer's sincere intent cannot be confidently determined.
   - "explanation": Concise 1-sentence reason detailing why it is Sarcastic, Non-Sarcastic, or Uncertain.

CRITICAL INSTRUCTIONS:
- Comprehend Hindi, Hinglish (e.g. "bhai kya acting kar raha hai", "mast tha", "waah kya scene hai", "ab rulaoge kya"), English, slang, and emoji context together.
- DO NOT treat emoji presence alone as sarcasm. Sarcasm requires true semantic irony or mockery.

COMMENTS TO CLASSIFY:
${formattedComments}

Return ONLY a valid JSON object in this exact schema:
{
  "classifications": [
    {
      "index": 1,
      "sentiment": "Positive" | "Negative" | "Neutral",
      "reason": "short 1-sentence reason",
      "keywords": ["keyword1", "keyword2"],
      "isCritical": false,
      "sarcasm": {
        "verdict": "Sarcastic" | "Non-Sarcastic" | "Uncertain",
        "explanation": "short 1-sentence contextual sarcasm explanation"
      }
    }
  ]
}
`;

  try {
    const { text, modelUsed } = await callGeminiWithFallback(prompt, apiKey);
    let cleanJson = text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(cleanJson);
    return {
      results: parsed.classifications || [],
      modelUsed,
      failed: false,
    };
  } catch (err) {
    console.error(`[GeminiService] Batch ${batchIndex} failed:`, err.message);
    return {
      results: [],
      modelUsed: 'none',
      failed: true,
      error: err.message,
    };
  }
};

/**
 * Generate an overall summary and top keywords from aggregated sentiment results
 */
const generateOverallSummary = async (stats, topNegative, videoDetails, apiKey) => {
  const prompt = `
Provide an objective, 2-sentence summary of audience perception for the video "${videoDetails?.title || 'YouTube Video'}".
Statistics:
- Total Analyzed: ${stats.total}
- Positive: ${stats.positive} (${stats.positivePct}%)
- Negative: ${stats.negative} (${stats.negativePct}%)
- Neutral: ${stats.neutral} (${stats.neutralPct}%)
${topNegative.length > 0 ? `Key negative highlights:\n${topNegative.map(n => `- "${n.text}" (${n.reason})`).join('\n')}` : ''}

Return ONLY a valid JSON object:
{
  "summary": "2-sentence overall summary of audience sentiment."
}
`;

  try {
    const { text } = await callGeminiWithFallback(prompt, apiKey);
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    const data = JSON.parse(clean);
    return data.summary || 'Audience sentiment analyzed across all comments.';
  } catch {
    return `Audience perception is ${stats.positivePct}% positive, ${stats.neutralPct}% neutral, and ${stats.negativePct}% negative across ${stats.total} analyzed comments.`;
  }
};

/**
 * Analyze sentiment of YouTube comments in sequential batches of 25
 * Combines all batch results and computes overall metrics.
 * 
 * @param {Array} comments - Full array of comments to analyze
 * @param {Object} videoDetails - Title, channel, statistics
 * @param {string} apiKey - Gemini API Key
 * @param {number} maxToAnalyze - Maximum comments to process (default: all provided)
 */
export const analyzeComments = async (comments, videoDetails, apiKey, maxToAnalyze = null) => {
  if (!comments || comments.length === 0) {
    return {
      totalAnalyzed: 0,
      failedCount: 0,
      stats: { positive: 0, negative: 0, neutral: 0 },
      percentages: { positive: 0, negative: 0, neutral: 0 },
      sarcasmAnalytics: {
        totalAnalyzed: 0,
        sarcasticCount: 0,
        nonSarcasticCount: 0,
        uncertainCount: 0,
        sarcasmRate: 0,
        sarcasticComments: [],
      },
      comments: [],
      topKeywords: [],
      criticalFeedback: [],
      summary: 'No comments found for this video to analyze.',
    };
  }

  // Determine items to analyze (no hardcoded 60-limit)
  const itemsToProcess = maxToAnalyze ? comments.slice(0, maxToAnalyze) : comments;
  const BATCH_SIZE = 25; // 20-30 comments per request as recommended
  const batches = [];

  for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
    batches.push(itemsToProcess.slice(i, i + BATCH_SIZE));
  }

  console.log(`[GeminiService] Processing ${itemsToProcess.length} comments across ${batches.length} batches...`);

  const enrichedComments = [];
  const keywordFrequency = {};
  let failedCount = 0;
  let lastModelUsed = 'gemini-3.1-flash-lite';

  // Process batches sequentially to respect API rate limits
  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    console.log(`[GeminiService] Processing batch ${bIdx + 1}/${batches.length} (${batch.length} comments)...`);

    const batchRes = await analyzeSingleBatch(batch, bIdx + 1, apiKey);
    if (batchRes.modelUsed !== 'none') {
      lastModelUsed = batchRes.modelUsed;
    }

    const resultMap = new Map();
    (batchRes.results || []).forEach(r => resultMap.set(r.index, r));

    batch.forEach((orig, idx) => {
      const ai = resultMap.get(idx + 1);

      if (ai && ['Positive', 'Negative', 'Neutral'].includes(ai.sentiment)) {
        const sarcasmVerdict = ['Sarcastic', 'Non-Sarcastic', 'Uncertain'].includes(ai.sarcasm?.verdict)
          ? ai.sarcasm.verdict
          : 'Non-Sarcastic';
        const sarcasmExplanation = ai.sarcasm?.explanation
          || (sarcasmVerdict === 'Sarcastic' ? 'Identified ironic or satirical tone in expression.' : 'Direct commentary without irony.');

        const enriched = {
          ...orig,
          sentiment: ai.sentiment,
          reason: ai.reason || 'Classified based on viewer tone.',
          keywords: Array.isArray(ai.keywords) ? ai.keywords : [],
          isCritical: Boolean(ai.isCritical),
          sarcasm: {
            verdict: sarcasmVerdict,
            explanation: sarcasmExplanation,
          },
        };

        // Aggregate keywords
        if (Array.isArray(ai.keywords)) {
          ai.keywords.forEach(kw => {
            const cleanKw = kw.toLowerCase().trim();
            if (cleanKw.length > 2) {
              keywordFrequency[cleanKw] = (keywordFrequency[cleanKw] || 0) + 1;
            }
          });
        }

        enrichedComments.push(enriched);
      } else {
        // Fallback for unclassified comment
        failedCount++;
        enrichedComments.push({
          ...orig,
          sentiment: 'Neutral',
          reason: 'General observation or inquiry.',
          keywords: [],
          isCritical: false,
          sarcasm: {
            verdict: 'Uncertain',
            explanation: 'Unable to evaluate sarcasm contextually via AI fallback.',
          },
          analysisNote: 'Processed via fallback',
        });
      }
    });

    // Small inter-batch delay to prevent rapid-fire spikes
    if (bIdx < batches.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  // Calculate final counts and percentages
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let sarcasticCount = 0;
  let nonSarcasticCount = 0;
  let uncertainCount = 0;
  const criticalFeedback = [];
  const sarcasticComments = [];

  enrichedComments.forEach(c => {
    if (c.sentiment === 'Positive') positiveCount++;
    else if (c.sentiment === 'Negative') {
      negativeCount++;
      if (c.isCritical || criticalFeedback.length < 5) {
        criticalFeedback.push(c);
      }
    } else {
      neutralCount++;
    }

    if (c.sarcasm?.verdict === 'Sarcastic') {
      sarcasticCount++;
      if (sarcasticComments.length < 10) {
        sarcasticComments.push({
          id: c.id,
          author: c.author,
          text: c.text,
          sentiment: c.sentiment,
          verdict: 'Sarcastic',
          explanation: c.sarcasm.explanation,
          emojis: c.emojis || [],
        });
      }
    } else if (c.sarcasm?.verdict === 'Uncertain') {
      uncertainCount++;
    } else {
      nonSarcasticCount++;
    }
  });

  const total = enrichedComments.length;
  const positivePercentage = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
  const negativePercentage = total > 0 ? Math.round((negativeCount / total) * 100) : 0;
  const neutralPercentage = total > 0 ? Math.max(0, 100 - positivePercentage - negativePercentage) : 0;
  const sarcasmRate = total > 0 ? Math.round((sarcasticCount / total) * 100) : 0;

  const sarcasmAnalytics = {
    totalAnalyzed: total,
    sarcasticCount,
    nonSarcasticCount,
    uncertainCount,
    sarcasmRate,
    sarcasticComments,
  };

  // Format top keywords
  const sortedKeywords = Object.entries(keywordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([keyword, count]) => ({
      keyword: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      count,
    }));

  // Generate overall summary
  const summary = await generateOverallSummary(
    {
      total,
      positive: positiveCount,
      negative: negativeCount,
      neutral: neutralCount,
      positivePct: positivePercentage,
      negativePct: negativePercentage,
      neutralPct: neutralPercentage,
    },
    criticalFeedback.slice(0, 3),
    videoDetails,
    apiKey
  );

  return {
    totalAnalyzed: total,
    failedCount,
    stats: {
      positive: positiveCount,
      negative: negativeCount,
      neutral: neutralCount,
    },
    percentages: {
      positive: positivePercentage,
      negative: negativePercentage,
      neutral: neutralPercentage,
    },
    sarcasmAnalytics,
    comments: enrichedComments,
    criticalFeedback: criticalFeedback.slice(0, 5),
    topKeywords: sortedKeywords,
    summary,
    modelUsed: lastModelUsed,
  };
};
