import mongoose from 'mongoose';

/**
 * Sanitize MongoDB URI for safe logging without exposing passwords or credentials
 */
export const sanitizeMongoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  try {
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  } catch {
    return '***';
  }
};

/**
 * Check if the provided URI is a default placeholder or unconfigured
 */
export const isPlaceholderUri = (uri) => {
  if (!uri || typeof uri !== 'string') return true;
  const trimmed = uri.trim();
  return (
    trimmed === '' ||
    trimmed.includes('your_user') ||
    trimmed.includes('your_password') ||
    trimmed.includes('<username>') ||
    trimmed.includes('<password>')
  );
};

/**
 * Get current database connection status
 */
export const getDatabaseStatus = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateIndex = mongoose.connection.readyState;
  const statusStr = states[stateIndex] || 'disconnected';

  return {
    connected: stateIndex === 1,
    status: statusStr,
    readyState: stateIndex,
    host: stateIndex === 1 ? mongoose.connection.host : null,
    databaseName: stateIndex === 1 ? mongoose.connection.name : null,
  };
};

/**
 * Connect to MongoDB Atlas with robust error handling and non-blocking failure
 */
export const connectDB = async () => {
  const rawUri = process.env.MONGO_URI;

  if (isPlaceholderUri(rawUri)) {
    console.warn('\n================================================================');
    console.warn('⚠️  [MongoDB] Database running in DISCONNECTED mode.');
    console.warn('⚠️  MONGO_URI in server/.env is unconfigured or contains placeholder values.');
    console.warn('⚠️  The backend server and API routes will continue running normally.');
    console.warn('================================================================\n');
    return {
      success: false,
      connected: false,
      message: 'MongoDB URI is unconfigured or contains placeholder credentials in server/.env',
    };
  }

  // Register persistent lifecycle event listeners
  mongoose.connection.on('connected', () => {
    console.log(`[MongoDB] Connected successfully to host: ${mongoose.connection.host} | DB: ${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB] Runtime connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection disconnected.');
  });

  try {
    console.log(`[MongoDB] Connecting to MongoDB Atlas: ${sanitizeMongoUri(rawUri)} ...`);
    const conn = await mongoose.connect(rawUri, {
      dbName: 'media_sentiment', // Ensures data is stored in 'media_sentiment' database
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of hanging
      connectTimeoutMS: 10000,
    });

    console.log(`✅ [MongoDB] Atlas Connected: ${conn.connection.host} (${conn.connection.name})`);
    return {
      success: true,
      connected: true,
      host: conn.connection.host,
      name: conn.connection.name,
    };
  } catch (error) {
    console.error(`❌ [MongoDB] Connection Failed: ${error.message}`);
    console.warn('⚠️  Backend will continue operating in disconnected database mode.');
    return {
      success: false,
      connected: false,
      error: error.message,
    };
  }
};

export default connectDB;

