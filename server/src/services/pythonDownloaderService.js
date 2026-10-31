import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/download_comments.py');

/**
 * Determine the available Python executable path
 */
const getPythonPath = () => {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  // Common Windows location or system PATH
  const winPy314 = 'C:\\Program Files\\Python314\\python.exe';
  if (fs.existsSync(winPy314)) {
    return winPy314;
  }
  return 'python'; // Defaults to PATH
};

/**
 * Download YouTube comments using python-comment-downloader subprocess
 * 
 * @param {string} videoUrlOrId - Full YouTube URL or 11-char Video ID
 * @param {Object} options - Download options
 * @param {number} options.limit - Max comments to fetch (default 1000)
 * @param {number} options.sort - 0 for popular (default), 1 for recent
 * @param {number} options.timeoutMs - Max execution time in ms (default 90000)
 * @returns {Promise<Object>} Formatted comment results with counts
 */
export const downloadYouTubeCommentsWithPython = async (videoUrlOrId, options = {}) => {
  const {
    limit = 1000,
    sort = 0,
    timeoutMs = 90000, // 90 seconds
  } = options;

  return new Promise((resolve, reject) => {
    const pythonExe = getPythonPath();

    if (!fs.existsSync(SCRIPT_PATH)) {
      return reject(new Error(`Python downloader script not found at ${SCRIPT_PATH}`));
    }

    console.log(`[PythonDownloader] Spawning Python subprocess: "${pythonExe}" "${SCRIPT_PATH}" --limit ${limit}`);

    const args = [
      SCRIPT_PATH,
      '--url', videoUrlOrId,
      '--limit', String(limit),
      '--sort', String(sort),
    ];

    const child = spawn(pythonExe, args, {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let isFinished = false;

    // Timeout watchdog
    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        child.kill();
        reject(new Error(`Python comment downloader timed out after ${timeoutMs / 1000} seconds.`));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      console.error('[PythonDownloader] Spawn error:', err);
      reject(new Error(`Failed to start Python process (${pythonExe}): ${err.message}`));
    });

    child.on('close', (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);

      if (code !== 0) {
        console.error(`[PythonDownloader] Python process exited with code ${code}. Stderr: ${stderrBuffer}`);
        // Attempt to parse JSON error from stderr if available
        try {
          const errObj = JSON.parse(stderrBuffer);
          return reject(new Error(errObj.error || `Python downloader failed with exit code ${code}`));
        } catch {
          return reject(new Error(stderrBuffer.trim() || `Python process failed with exit code ${code}`));
        }
      }

      try {
        const cleanStdout = stdoutBuffer.trim();
        if (!cleanStdout) {
          return reject(new Error('Python comment downloader returned empty output.'));
        }

        const data = JSON.parse(cleanStdout);
        console.log(`[PythonDownloader] Successfully fetched ${data.totalFetched} comments (${data.topLevelCount} top-level, ${data.replyCount} replies).`);

        resolve({
          success: true,
          videoId: data.videoId,
          totalFetched: data.totalFetched || 0,
          topLevelCount: data.topLevelCount || 0,
          replyCount: data.replyCount || 0,
          commentsDisabled: Boolean(data.commentsDisabled),
          vaderAnalysis: data.vaderAnalysis || null,
          emojiAnalytics: data.emojiAnalytics || null,
          comments: Array.isArray(data.comments) ? data.comments : [],
        });
      } catch (parseErr) {
        console.error('[PythonDownloader] JSON parse error:', parseErr, 'Raw output:', stdoutBuffer.slice(0, 300));
        reject(new Error(`Failed to parse comments from Python script: ${parseErr.message}`));
      }
    });
  });
};

