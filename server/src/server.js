import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractYouTubeVideoId } from './utils/youtubeValidator.js';
import analysisRoutes from './routes/analysisRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import connectDB, { getDatabaseStatus, isPlaceholderUri } from './config/db.js';

// Resolve current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load server/.env relative to this file location (guarantees correct loading)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Fallback: Also load from current working directory
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed origins for CORS (default dev ports + any custom configured CLIENT_URL)
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
];

const configuredOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
  : [];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));

// Dynamic CORS configuration allowing localhost dev ports and configured domains
app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow configured origins or any localhost port in development
    if (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error(`CORS Error: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health Check Route (includes database status)
app.get('/api/health', (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.status(200).json({
    status: 'success',
    message: 'MediaSentiment Backend Server is running perfectly! 🚀',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbStatus.connected,
      status: dbStatus.status,
      configured: !isPlaceholderUri(process.env.MONGO_URI),
    },
  });
});

// Dedicated Database Status & Connection Health Route
app.get('/api/db/status', (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.status(200).json({
    success: true,
    database: dbStatus,
    configured: !isPlaceholderUri(process.env.MONGO_URI),
  });
});

// Mount Sentiment Analysis Routes (/api/analyze/youtube, etc.)
app.use('/api/analyze', analysisRoutes);

// Mount Analysis History Routes (/api/history, /api/analyze/history)
app.use('/api/history', historyRoutes);
app.use('/api/analyze/history', historyRoutes);

// YouTube URL Validation Route (accepts full URLs, short URLs, or direct video IDs)
app.post('/api/validate-url', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'YouTube URL or Video ID is required'
    });
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid YouTube URL or unsupported format'
    });
  }

  return res.status(200).json({
    success: true,
    videoId,
    message: 'Valid YouTube Video ID extracted successfully'
  });
});

// Root Route
app.get('/', (req, res) => {
  res.send('<h3>YouTube Sentiment Analysis API is Active</h3><p>Health check at <a href="/api/health">/api/health</a></p>');
});

// Start Server
app.listen(PORT, async () => {
  const isDbConfigured = !isPlaceholderUri(process.env.MONGO_URI);
  console.log(`===============================================`);
  console.log(`🚀 Server successfully started on port: ${PORT}`);
  console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
  console.log(`🔑 YouTube API Key: ${Boolean(process.env.YOUTUBE_API_KEY) ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🤖 Gemini API Key: ${Boolean(process.env.GEMINI_API_KEY) ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`💾 MongoDB Atlas: ${isDbConfigured ? 'Connecting ⏳' : 'Disconnected / Unconfigured ⚠️'}`);
  console.log(`🌐 Allowed Origins: ${allowedOrigins.join(', ')} + localhost:*`);
  console.log(`===============================================`);

  // Initialize MongoDB connection (non-blocking, will not crash server on failure)
  await connectDB();
});
