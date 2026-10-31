import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/vader_analyzer.py');

const getPythonPath = () => {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const winPy314 = 'C:\\Program Files\\Python314\\python.exe';
  if (fs.existsSync(winPy314)) {
    return winPy314;
  }
  return 'python';
};

/**
 * Run VADER Sentiment & Emoji Analysis on an array of comments
 * @param {Array} comments - Array of comment objects with at least `{ text: string }`
 * @param {Object} [existingEmojiAnalytics] - Precomputed emoji analytics if available
 * @returns {Promise<Object>} { vaderAnalysis, emojiAnalytics, comments }
 */
export const analyzeCommentsWithVader = async (comments = [], existingEmojiAnalytics = null) => {
  if (!comments || comments.length === 0) {
    return {
      vaderAnalysis: {
        totalAnalyzed: 0,
        stats: { positive: 0, negative: 0, neutral: 0 },
        percentages: { positive: 0, negative: 0, neutral: 0 },
        averageCompound: 0,
      },
      emojiAnalytics: {
        totalEmojisDetected: 0,
        uniqueEmojisCount: 0,
        commentsWithEmojisCount: 0,
        emojiUsagePercentage: 0,
        sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        topEmojis: [],
        conflictingCommentsCount: 0,
        conflictingComments: [],
      },
      comments: [],
    };
  }

  // If comments already contain vader scores and emoji info (from download_comments.py), aggregate directly
  const alreadyAnalyzed = comments.every(c => c.vader && typeof c.vader.compound === 'number' && c.emojis !== undefined);
  if (alreadyAnalyzed) {
    let pos = 0, neg = 0, neu = 0, compSum = 0;
    comments.forEach(c => {
      compSum += c.vader.compound;
      if (c.vader.sentiment === 'Positive') pos++;
      else if (c.vader.sentiment === 'Negative') neg++;
      else neu++;
    });

    const total = comments.length;
    const posPct = total > 0 ? Math.round((pos / total) * 100) : 0;
    const negPct = total > 0 ? Math.round((neg / total) * 100) : 0;
    const neuPct = total > 0 ? Math.max(0, 100 - posPct - negPct) : 0;

    return {
      vaderAnalysis: {
        totalAnalyzed: total,
        stats: { positive: pos, negative: neg, neutral: neu },
        percentages: { positive: posPct, negative: negPct, neutral: neuPct },
        averageCompound: total > 0 ? Math.round((compSum / total) * 10000) / 10000 : 0,
      },
      emojiAnalytics: existingEmojiAnalytics || {
        totalEmojisDetected: 0,
        uniqueEmojisCount: 0,
        commentsWithEmojisCount: 0,
        emojiUsagePercentage: 0,
        sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        topEmojis: [],
        conflictingCommentsCount: 0,
        conflictingComments: [],
      },
      comments,
    };
  }

  // Otherwise, invoke Python vader_analyzer.py via stdin
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonPath();
    const child = spawn(pythonExe, [SCRIPT_PATH], {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', chunk => {
      stdoutBuffer += chunk.toString('utf-8');
    });

    child.stderr.on('data', chunk => {
      stderrBuffer += chunk.toString('utf-8');
    });

    child.on('error', err => {
      console.error('[VaderService] Process spawn error:', err);
      reject(err);
    });

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`VADER analyzer failed with code ${code}: ${stderrBuffer}`));
      }

      try {
        const result = JSON.parse(stdoutBuffer.trim());
        resolve({
          vaderAnalysis: result.vaderAnalysis,
          emojiAnalytics: result.emojiAnalytics,
          comments: result.comments,
        });
      } catch (parseErr) {
        reject(new Error(`Failed to parse VADER JSON output: ${parseErr.message}`));
      }
    });

    child.stdin.write(JSON.stringify(comments));
    child.stdin.end();
  });
};
