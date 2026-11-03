import mongoose from 'mongoose';

const videoDetailsSchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    title: { type: String, default: 'Untitled Video' },
    channelTitle: { type: String, default: 'Unknown Channel' },
    publishedAt: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: [true, 'Video ID is required'],
      index: true,
      trim: true,
    },
    url: {
      type: String,
      default: '',
      trim: true,
    },
    engine: {
      type: String,
      enum: ['python', 'youtube_api', 'csv_product_review', 'flipkart_review'],
      default: 'python',
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
    product: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    hasComments: {
      type: Boolean,
      default: true,
    },
    video: {
      type: videoDetailsSchema,
      default: () => ({}),
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    vader: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    gemini: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    comparison: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    emojiAnalytics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sarcasmAnalytics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    comments: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'analyses',
  }
);

// Compound index for fast queries by video and recency
analysisSchema.index({ videoId: 1, analyzedAt: -1 });

const Analysis = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);

export default Analysis;

