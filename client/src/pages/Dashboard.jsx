import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Smile,
  Frown,
  MinusCircle,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Menu,
  Loader2,
  RefreshCw,
  ThumbsUp,
  Eye,
  Info,
  Layers,
  CornerDownRight,
  Terminal,
  Scale,
  Cpu,
  Activity,
  Check,
  AlertCircle,
  Zap,
  Flame,
  Heart,
  TrendingUp,
  MessageCircle,
  FileDown
} from 'lucide-react';
import StatCard from '../components/StatCard';
import SentimentPieChart from '../components/SentimentPieChart';
import KeywordBarChart from '../components/KeywordBarChart';
import YouTubeInputCard from '../components/YouTubeInputCard';
import HealthCheckBadge from '../components/HealthCheckBadge';
import { analyzeYouTubeComments } from '../services/api';
import { generatePdfReport } from '../services/reportGenerator';

// Demo data for initial preview state
const DEMO_METRICS = {
  totalAvailable: 2800,
  totalFetched: 1000,
  topLevelCount: 720,
  replyCount: 280,
  totalVaderAnalyzed: 1000,
  totalGeminiAnalyzed: 100,
  failedCount: 0,
  agreementRate: 82,
  agreementCount: 82,
  disagreementCount: 18,
  totalCompared: 100,
  engine: 'python',
};

const DEMO_VADER = {
  totalAnalyzed: 1000,
  stats: { positive: 650, negative: 140, neutral: 210 },
  percentages: { positive: 65, negative: 14, neutral: 21 },
  averageCompound: 0.4285,
  pieChartData: [
    { name: 'Positive', value: 650, percentage: 65, color: '#10b981' },
    { name: 'Negative', value: 140, percentage: 14, color: '#f43f5e' },
    { name: 'Neutral', value: 210, percentage: 21, color: '#3b82f6' },
  ],
};

const DEMO_GEMINI = {
  totalAnalyzed: 100,
  stats: { positive: 76, negative: 14, neutral: 10 },
  percentages: { positive: 76, negative: 14, neutral: 10 },
  pieChartData: [
    { name: 'Positive', value: 76, percentage: 76, color: '#10b981' },
    { name: 'Negative', value: 14, percentage: 14, color: '#f43f5e' },
    { name: 'Neutral', value: 10, percentage: 10, color: '#3b82f6' },
  ],
  topKeywords: [
    { keyword: 'Humor', count: 42 },
    { keyword: 'Performance', count: 35 },
    { keyword: 'Acting', count: 28 },
    { keyword: 'Delivery', count: 19 },
    { keyword: 'Timing', count: 15 },
  ],
  summary: 'Audience reaction is overwhelmingly positive, praising comedic timing, stage presence and acting skills.',
  modelUsed: 'gemini-3.1-flash-lite',
};

const DEMO_COMPARISON = {
  totalCompared: 100,
  agreementRate: 82,
  agreementCount: 82,
  disagreementCount: 18,
  disagreementBreakdown: {
    'VADER Pos / Gemini Neu': 4,
    'VADER Neu / Gemini Pos': 8,
    'VADER Neg / Gemini Neu': 4,
    'VADER Pos / Gemini Neg': 2,
  },
};

const DEMO_EMOJI_ANALYTICS = {
  totalEmojisDetected: 485,
  uniqueEmojisCount: 22,
  commentsWithEmojisCount: 275,
  emojiUsagePercentage: 68,
  sentimentDistribution: { positive: 360, negative: 45, neutral: 80 },
  topEmojis: [
    { char: '😂', name: 'Face With Tears Of Joy', count: 195, sentiment: 'Positive' },
    { char: '🔥', name: 'Fire', count: 92, sentiment: 'Positive' },
    { char: '❤️', name: 'Red Heart', count: 68, sentiment: 'Positive' },
    { char: '👏', name: 'Clapping Hands', count: 35, sentiment: 'Positive' },
    { char: '💀', name: 'Skull', count: 28, sentiment: 'Neutral' },
    { char: '😭', name: 'Loudly Crying Face', count: 22, sentiment: 'Negative' },
    { char: '🙌', name: 'Raising Hands', count: 16, sentiment: 'Positive' },
    { char: '😍', name: 'Smiling Face With Heart-Eyes', count: 15, sentiment: 'Positive' },
  ],
  conflictingCommentsCount: 6,
  conflictingComments: [
    {
      id: 'demo-2',
      author: '@tech_critique',
      text: 'Audio me thoda background noise tha bhai mic check kar lena next show me baaki jokes mast the 😂',
      vaderSentiment: 'Negative',
      emojiSentiment: 'Positive',
      conflictType: 'Text-Emoji Conflict (Negative Text + Positive Emoji)',
      explanation: 'Negative textual wording contrasted with laughing emoji(s).',
      emojis: [{ char: '😂', name: 'Face With Tears Of Joy', count: 1, sentiment: 'Positive' }],
    }
  ]
};

const DEMO_SARCASM_ANALYTICS = {
  totalAnalyzed: 100,
  sarcasticCount: 12,
  nonSarcasticCount: 82,
  uncertainCount: 6,
  sarcasmRate: 12,
  sarcasticComments: [
    {
      id: 'demo-4',
      author: '@rohit_memer',
      text: 'Arre bhai itni jaldi upload kar di, abhi toh bas 2 saal hi hue the wait karte karte 😂🙌',
      sentiment: 'Negative',
      verdict: 'Sarcastic',
      explanation: 'Ironic mock praise ("itni jaldi") satirizing a long 2-year upload delay.',
      emojis: [
        { char: '😂', name: 'Face With Tears Of Joy' },
        { char: '🙌', name: 'Raising Hands' }
      ]
    },
    {
      id: 'demo-sarcasm-2',
      author: '@standup_fanatic',
      text: 'Waah bhai kya camera angle rakha hai, poora show cameraman ka talent dekhne me nikal gaya 👏🤦‍♂️',
      sentiment: 'Negative',
      verdict: 'Sarcastic',
      explanation: 'Sarcastic praise of camera work to mock distracting camera angles during the live set.',
      emojis: [
        { char: '👏', name: 'Clapping Hands' },
        { char: '🤦‍♂️', name: 'Man Facepalming' }
      ]
    }
  ]
};

const DEMO_COMMENTS = [
  {
    id: 'demo-1',
    author: '@AakashGupta',
    text: 'Ye mera favourite set raha hai last 2 years se & bahot saare logo ne isko mere live show mei bhi dekha hoga. Hope aap sabko maza aaya ❤️😀',
    sentiment: 'Positive',
    geminiSentiment: 'Positive',
    vader: { sentiment: 'Positive', compound: 0.9716, pos: 0.299, neg: 0.0, neu: 0.701 },
    geminiReason: 'Creator expressing heartfelt gratitude and pride in their craft.',
    keywords: ['favourite', 'performance', 'love'],
    publishedAt: '17 hours ago',
    likeCount: 2300,
    isReply: false,
    isAgreed: true,
    hasGeminiAnalysis: true,
    sarcasm: {
      verdict: 'Non-Sarcastic',
      explanation: 'Direct heartfelt message from video creator without irony.'
    },
    emojis: [
      { char: '❤️', name: 'Red Heart', count: 1, sentiment: 'Positive' },
      { char: '😀', name: 'Grinning Face', count: 1, sentiment: 'Positive' }
    ],
    emojiCount: 2,
    emojiSentiment: 'Positive',
    emojiConflict: {
      hasConflict: false,
      type: 'Positive Reinforcement',
      explanation: 'Positive statement is enthusiastically reinforced by positive emojis.'
    }
  },
  {
    id: 'demo-2',
    author: '@tech_critique',
    text: 'Audio me thoda background noise tha bhai mic check kar lena next show me baaki jokes mast the 😂',
    sentiment: 'Neutral',
    geminiSentiment: 'Neutral',
    vader: { sentiment: 'Negative', compound: -0.296, pos: 0.0, neg: 0.12, neu: 0.88 },
    geminiReason: 'Constructive mixed comment with technical audio feedback balanced by joke appreciation.',
    keywords: ['audio', 'mic', 'background noise'],
    publishedAt: '19 hours ago',
    likeCount: 520,
    isCritical: true,
    isReply: false,
    isAgreed: false,
    hasGeminiAnalysis: true,
    sarcasm: {
      verdict: 'Non-Sarcastic',
      explanation: 'Constructive audio critique paired with genuine humor appreciation.'
    },
    emojis: [
      { char: '😂', name: 'Face With Tears Of Joy', count: 1, sentiment: 'Positive' }
    ],
    emojiCount: 1,
    emojiSentiment: 'Positive',
    emojiConflict: {
      hasConflict: true,
      type: 'Text-Emoji Conflict (Negative Text + Positive Emoji)',
      explanation: 'Negative textual wording is contrasted by positive or laughing emoji(s).'
    }
  },
  {
    id: 'demo-3',
    author: '@chiragrv218',
    text: 'I think you should try to become an actor because your acting is phenomenal 👏🔥',
    sentiment: 'Positive',
    geminiSentiment: 'Positive',
    vader: { sentiment: 'Neutral', compound: 0.0, pos: 0.0, neg: 0.0, neu: 1.0 },
    geminiReason: 'Strong compliment suggesting transition into mainstream acting.',
    keywords: ['acting', 'phenomenal', 'actor'],
    publishedAt: '20 hours ago',
    likeCount: 5300,
    isReply: false,
    isAgreed: false,
    hasGeminiAnalysis: true,
    sarcasm: {
      verdict: 'Non-Sarcastic',
      explanation: 'Sincere admiration of performance and acting talent.'
    },
    emojis: [
      { char: '👏', name: 'Clapping Hands', count: 1, sentiment: 'Positive' },
      { char: '🔥', name: 'Fire', count: 1, sentiment: 'Positive' }
    ],
    emojiCount: 2,
    emojiSentiment: 'Positive',
    emojiConflict: {
      hasConflict: false,
      type: 'Positive Reinforcement',
      explanation: 'Positive sentiment is reinforced by enthusiastic praise emojis.'
    }
  },
  {
    id: 'demo-4',
    author: '@rohit_memer',
    text: 'Arre bhai itni jaldi upload kar di, abhi toh bas 2 saal hi hue the wait karte karte 😂🙌',
    sentiment: 'Negative',
    geminiSentiment: 'Negative',
    vader: { sentiment: 'Neutral', compound: 0.0, pos: 0.0, neg: 0.0, neu: 1.0 },
    geminiReason: 'Playful mocking of the delayed upload schedule.',
    keywords: ['upload', 'delay', 'wait'],
    publishedAt: '1 day ago',
    likeCount: 420,
    isReply: false,
    isAgreed: false,
    hasGeminiAnalysis: true,
    sarcasm: {
      verdict: 'Sarcastic',
      explanation: 'Ironic mock praise ("itni jaldi") satirizing a long 2-year upload delay.'
    },
    emojis: [
      { char: '😂', name: 'Face With Tears Of Joy', count: 1, sentiment: 'Positive' },
      { char: '🙌', name: 'Raising Hands', count: 1, sentiment: 'Positive' }
    ],
    emojiCount: 2,
    emojiSentiment: 'Positive',
    emojiConflict: {
      hasConflict: false,
      type: 'Positive Reinforcement',
      explanation: 'Laughing emojis accompanying humorous satire.'
    }
  },
];

const Dashboard = ({ onOpenSidebar, loadedAnalysis, onClearLoadedAnalysis }) => {
  const [activeModelTab, setActiveModelTab] = useState('comparison'); // 'comparison' | 'vader' | 'gemini' | 'emojis'
  const [commentFilter, setCommentFilter] = useState('All');
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Real analysis state (null means demo mode)
  const [realAnalysis, setRealAnalysis] = useState(loadedAnalysis || null);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    if (loadedAnalysis) {
      setRealAnalysis(loadedAnalysis);
    }
  }, [loadedAnalysis]);

  const handleDownloadReport = async () => {
    const dataToExport = realAnalysis || (activeVideo ? {
      video: activeVideo,
      metrics: activeMetrics,
      vader: activeVader,
      gemini: activeGemini,
      comparison: activeComparison,
      emojiAnalytics: activeEmojiAnalytics,
      sarcasmAnalytics: activeSarcasmAnalytics,
      comments: allComments,
    } : null);

    if (!dataToExport) {
      alert('Please analyze a YouTube video first to download its report.');
      return;
    }

    try {
      setGeneratingReport(true);
      const res = await generatePdfReport(dataToExport);
      if (!res.success) {
        alert(`Failed to generate report: ${res.error}`);
      }
    } catch (err) {
      alert(`Report error: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Trigger live backend analysis with batch limit and engine options
  const handleAnalyzeUrl = async (videoId, originalUrl, maxAnalyze = 100, options = {}) => {
    setAnalyzing(true);
    setErrorMessage('');

    const engineLabel = options.engine === 'youtube_api' ? 'YouTube Data API v3' : 'Python Downloader (1000 limit)';
    setLoadingStep(`Step 1/3: Fetching up to ${options.downloadLimit || 1000} comments via ${engineLabel}...`);

    const step2Timer = setTimeout(() => {
      setLoadingStep(`Step 2/3: Running VADER Sentiment & Real Emoji Detection across all comments...`);
    }, 4000);

    const step3Timer = setTimeout(() => {
      setLoadingStep(`Step 3/3: Running Gemini AI deep contextual reasoning in batches (${maxAnalyze} limit)...`);
    }, 9000);

    try {
      const result = await analyzeYouTubeComments(originalUrl || videoId, maxAnalyze, options);
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);

      if (result.success && result.data) {
        setRealAnalysis(result.data);
      } else {
        setErrorMessage(result.error || 'Failed to analyze YouTube comments.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred during analysis.');
    } finally {
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      setAnalyzing(false);
      setLoadingStep('');
    }
  };

  const handleResetAnalysis = () => {
    setRealAnalysis(null);
    if (onClearLoadedAnalysis) {
      onClearLoadedAnalysis();
    }
    setErrorMessage('');
    setCommentFilter('All');
  };

  // Determine active dataset
  const isRealData = Boolean(realAnalysis);
  const activeVideo = realAnalysis?.video || null;
  const activeMetrics = realAnalysis?.metrics || DEMO_METRICS;
  const activeVader = realAnalysis?.vader || DEMO_VADER;
  const activeGemini = realAnalysis?.gemini || DEMO_GEMINI;
  const activeComparison = realAnalysis?.comparison || DEMO_COMPARISON;
  const activeEmojiAnalytics = realAnalysis?.emojiAnalytics || DEMO_EMOJI_ANALYTICS;
  const activeSarcasmAnalytics = realAnalysis?.sarcasmAnalytics || DEMO_SARCASM_ANALYTICS;
  const hasComments = isRealData ? realAnalysis.hasComments : true;

  // Selected tab counts
  const currentTotalVader = activeVader.totalAnalyzed || 0;
  const currentTotalGemini = activeGemini.totalAnalyzed || 0;

  // Stats to display based on active model tab
  const displayStats = activeModelTab === 'vader'
    ? activeVader.stats
    : activeModelTab === 'gemini'
      ? activeGemini.stats
      : {
        positive: activeVader.stats.positive,
        negative: activeVader.stats.negative,
        neutral: activeVader.stats.neutral,
      };

  const displayPercentages = activeModelTab === 'vader'
    ? activeVader.percentages
    : activeModelTab === 'gemini'
      ? activeGemini.percentages
      : activeVader.percentages;

  const currentPieData = activeModelTab === 'gemini'
    ? (activeGemini.pieChartData || [])
    : (activeVader.pieChartData || []);

  const currentKeywords = activeGemini.topKeywords || [];
  const allComments = isRealData ? (realAnalysis.comments || []) : DEMO_COMMENTS;
  const criticalComments = activeGemini.criticalFeedback || [];

  const filteredComments = allComments.filter((c) => {
    if (commentFilter === 'All') return true;
    if (commentFilter === 'Replies') return c.isReply === true;
    if (commentFilter === 'Agreed') return c.isAgreed === true;
    if (commentFilter === 'Disagreed') return c.isAgreed === false;
    if (commentFilter === 'Has Emojis') return c.emojiCount > 0;
    if (commentFilter === 'Text-Emoji Conflict' || commentFilter === 'Conflict (⚡)') return c.emojiConflict?.hasConflict === true;
    if (commentFilter === 'Sarcastic' || commentFilter === 'Sarcastic (🎭)') return c.sarcasm?.verdict === 'Sarcastic';
    if (commentFilter === 'Non-Sarcastic') return c.sarcasm?.verdict === 'Non-Sarcastic';
    if (commentFilter === 'Uncertain') return c.sarcasm?.verdict === 'Uncertain';

    // Sentiment filter according to active model view
    if (activeModelTab === 'vader') {
      return c.vader?.sentiment === commentFilter;
    }
    return (c.geminiSentiment || c.sentiment) === commentFilter;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-dark-bg text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 h-20 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 rounded-xl bg-dark-card border border-dark-border text-dark-muted hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg lg:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Dashboard Overview
            </h1>
            <p className="text-xs text-dark-muted hidden sm:block">
              Multi-Model Analytics: VADER (1000+ comments), Real Emojis & Gemini AI Reasoning
            </p>
          </div>
        </div>

        {/* Live Backend Health Check Component */}
        <div className="flex items-center gap-3">
          <HealthCheckBadge />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Banner: Real Analysis Active or Demo Mode */}
        {isRealData ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {realAnalysis?.analyzedAt
                    ? `Saved Analysis (Analyzed on ${new Date(realAnalysis.analyzedAt).toLocaleString()})`
                    : 'Live Multi-Model, Emoji & Sarcasm Analysis Complete'}
                </p>
                <p className="text-xs text-dark-muted">
                  VADER analyzed {activeVader.totalAnalyzed} comments, detected {activeEmojiAnalytics.totalEmojisDetected} real emojis ({activeEmojiAnalytics.emojiUsagePercentage}% usage rate), detected {activeSarcasmAnalytics.sarcasticCount || 0} sarcastic comments ({activeSarcasmAnalytics.sarcasmRate || 0}% rate), and Gemini AI classified {activeGemini.totalAnalyzed} comments ({activeComparison.agreementRate}% agreement).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleDownloadReport}
                disabled={generatingReport}
                className="text-xs font-semibold text-white bg-brand-purple hover:bg-purple-600 px-3.5 py-1.5 rounded-xl shadow-md shadow-purple-900/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                title="Download formatted PDF report"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download Report</span>
                  </>
                )}
              </button>
              <button
                onClick={handleResetAnalysis}
                className="text-xs font-semibold text-slate-300 hover:text-white bg-dark-surface hover:bg-dark-card px-3 py-1.5 rounded-xl border border-dark-border transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Analyze Another</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-blue/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-brand-blue" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Demonstration Mode (VADER + Real Emoji + Gemini Preview)
                </p>
                <p className="text-xs text-dark-muted">
                  Displaying simulated multi-model results. Paste any YouTube URL below to run live 1000-comment analysis.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-brand-cyan bg-dark-surface px-3 py-1 rounded-full border border-dark-border self-start sm:self-auto">
              Ready for Input
            </span>
          </div>
        )}

        {/* Error notification banner if API fails */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-4 py-3.5 rounded-xl flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* YouTube URL Input Section with VADER & Gemini controls */}
        <YouTubeInputCard onAnalyze={handleAnalyzeUrl} isLoading={analyzing} />

        {/* Loading Progress State */}
        {analyzing && (
          <div className="bg-dark-card border border-brand-purple/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-brand-purple animate-spin" />
            <div>
              <h3 className="text-base font-bold text-white">
                Fetching & Analyzing Comments...
              </h3>
              <p className="text-xs text-brand-cyan mt-1 font-mono">
                {loadingStep || 'Connecting to Python Downloader, VADER, Emoji Extractor & Gemini AI...'}
              </p>
            </div>
          </div>
        )}

        {/* Real Video Details Header Card */}
        {activeVideo && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg flex flex-col md:flex-row gap-5 items-start md:items-center">
            {activeVideo.thumbnail && (
              <img
                src={activeVideo.thumbnail}
                alt={activeVideo.title}
                className="w-full md:w-48 h-28 object-cover rounded-xl border border-dark-border shadow-md shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 inline-block">
                  YouTube Video Details
                </span>
                {activeMetrics.engine && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${activeMetrics.engine === 'python'
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    }`}>
                    <Terminal className="w-3 h-3" />
                    <span>{activeMetrics.engine === 'python' ? 'Python Downloader Subprocess' : 'YouTube Data API v3'}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Activity className="w-3 h-3" />
                  <span>VADER + Gemini AI</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span>😊 Emoji Detection Active</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  <span>🎭 Sarcasm AI Active</span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white truncate" title={activeVideo.title}>
                {activeVideo.title}
              </h2>
              <p className="text-xs text-dark-muted mt-0.5">
                Channel: <strong className="text-slate-300 font-semibold">{activeVideo.channelTitle}</strong>
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 bg-dark-bg/80 px-2.5 py-1 rounded-lg border border-dark-border">
                  <Eye className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>{activeVideo.views?.toLocaleString() || 0} views</span>
                </span>
                <span className="flex items-center gap-1.5 bg-dark-bg/80 px-2.5 py-1 rounded-lg border border-dark-border">
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{activeVideo.likes?.toLocaleString() || 0} likes</span>
                </span>
                <span className="flex items-center gap-1.5 bg-dark-bg/80 px-2.5 py-1 rounded-lg border border-dark-border">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-purple" />
                  <span>{activeVideo.commentCount?.toLocaleString() || 0} on YouTube</span>
                </span>
                <button
                  onClick={handleDownloadReport}
                  disabled={generatingReport}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-90 text-white font-medium shadow-md shadow-purple-900/20 text-xs ml-auto transition-all disabled:opacity-50"
                  title="Download full analysis PDF report"
                >
                  {generatingReport ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Download Report</span>
                    </>
                  )}
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${activeVideo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-brand-purple hover:underline text-xs"
                >
                  <span>Open Video</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Model Metrics Grid (7 Metric Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="bg-dark-card border border-dark-border rounded-xl p-3.5">
            <span className="text-[10px] font-semibold uppercase text-dark-muted block">Available On YT</span>
            <span className="text-lg font-bold text-white mt-1 block">
              {activeMetrics.totalAvailable?.toLocaleString() || 0}
            </span>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-xl p-3.5">
            <span className="text-[10px] font-semibold uppercase text-brand-cyan block">Total Fetched</span>
            <span className="text-lg font-bold text-brand-cyan mt-1 block">
              {activeMetrics.totalFetched?.toLocaleString() || 0}
            </span>
          </div>

          <div className="bg-dark-card border border-emerald-500/40 rounded-xl p-3.5">
            <span className="text-[10px] font-semibold uppercase text-emerald-400 block">VADER Analyzed</span>
            <span className="text-lg font-bold text-emerald-300 mt-1 block">
              {currentTotalVader.toLocaleString()}
            </span>
          </div>

          <div className="bg-dark-card border border-brand-purple/40 rounded-xl p-3.5">
            <span className="text-[10px] font-semibold uppercase text-brand-purple block">Gemini Analyzed</span>
            <span className="text-lg font-bold text-white mt-1 block">
              {currentTotalGemini.toLocaleString()}
            </span>
          </div>

          <div className="bg-dark-card border border-amber-500/40 rounded-xl p-3.5">
            <span className="text-[10px] font-semibold uppercase text-amber-400 block">Real Emojis</span>
            <span className="text-lg font-bold text-amber-300 mt-1 block">
              {activeEmojiAnalytics.totalEmojisDetected?.toLocaleString() || 0}
            </span>
          </div>

          <div className="bg-dark-card border border-purple-500/40 rounded-xl p-3.5">
            <span className="text-[10px] font-semibold uppercase text-purple-400 block">Sarcasm (🎭)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-purple-300">
                {activeSarcasmAnalytics.sarcasticCount || 0}
              </span>
              <span className="text-[10px] text-purple-400/80 font-medium">
                ({activeSarcasmAnalytics.sarcasmRate || 0}%)
              </span>
            </div>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-xl p-3.5">
            <span className="text-[10px] font-semibold uppercase text-brand-cyan block">Model Agreement</span>
            <span className="text-lg font-bold text-brand-cyan mt-1 block">
              {activeComparison.agreementRate}%
            </span>
          </div>
        </div>

        {/* Model Tabs Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-dark-card border border-dark-border p-2 rounded-2xl">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveModelTab('comparison')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${activeModelTab === 'comparison'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
                }`}
            >
              <Scale className="w-4 h-4" />
              <span>Model Agreement</span>
            </button>
            <button
              onClick={() => setActiveModelTab('vader')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${activeModelTab === 'vader'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
                }`}
            >
              <Activity className="w-4 h-4" />
              <span>VADER ({currentTotalVader})</span>
            </button>
            <button
              onClick={() => setActiveModelTab('gemini')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${activeModelTab === 'gemini'
                  ? 'bg-brand-blue text-white shadow-md'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
                }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Gemini AI ({currentTotalGemini})</span>
            </button>
            <button
              onClick={() => setActiveModelTab('emojis')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${activeModelTab === 'emojis'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
                }`}
            >
              <span>😊</span>
              <span>Emoji Analytics ({activeEmojiAnalytics.totalEmojisDetected})</span>
            </button>
            <button
              onClick={() => setActiveModelTab('sarcasm')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${activeModelTab === 'sarcasm'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
                }`}
            >
              <span>🎭</span>
              <span>Sarcasm ({activeSarcasmAnalytics.sarcasticCount || 0})</span>
            </button>
          </div>

          <div className="text-xs text-dark-muted px-2">
            Viewing: <strong className="text-slate-200">
              {activeModelTab === 'comparison'
                ? 'Cross-Model Agreement Analysis'
                : activeModelTab === 'vader'
                  ? 'VADER Rule-Based Sentiment'
                  : activeModelTab === 'gemini'
                    ? 'Gemini AI Deep Reasoning'
                    : activeModelTab === 'emojis'
                      ? 'Actual Emojis Extracted from Comments'
                      : 'Contextual Sarcasm Detection (Gemini AI)'}
            </strong>
          </div>
        </div>

        {/* SARCASM ANALYTICS DEDICATED SECTION */}
        {activeModelTab === 'sarcasm' ? (
          <div className="space-y-6">
            {/* Top 4 Sarcasm Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-dark-card border border-purple-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Sarcastic Comments</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-bold text-purple-300">{activeSarcasmAnalytics.sarcasticCount || 0}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                      {activeSarcasmAnalytics.sarcasmRate || 0}% Sarcasm Rate
                    </span>
                  </div>
                  <p className="text-[11px] text-dark-muted mt-0.5">Irony, mock praise & hyperbole</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center text-2xl select-none">
                  🎭
                </div>
              </div>

              <div className="bg-dark-card border border-emerald-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Non-Sarcastic Comments</span>
                  <h3 className="text-2xl font-bold text-emerald-400 mt-1">{activeSarcasmAnalytics.nonSarcasticCount || 0}</h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">Sincere appreciation or direct feedback</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center text-2xl select-none">
                  ✅
                </div>
              </div>

              <div className="bg-dark-card border border-blue-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Uncertain Context</span>
                  <h3 className="text-2xl font-bold text-blue-400 mt-1">{activeSarcasmAnalytics.uncertainCount || 0}</h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">Ambiguous phrasing or neutral inquiry</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center text-2xl select-none">
                  ❓
                </div>
              </div>

              <div className="bg-dark-card border border-brand-cyan/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Context Depth</span>
                  <h3 className="text-2xl font-bold text-brand-cyan mt-1">{activeSarcasmAnalytics.totalAnalyzed || 0}</h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">Evaluated with Gemini AI LLM</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-brand-cyan/15 flex items-center justify-center text-2xl select-none">
                  🧠
                </div>
              </div>
            </div>

            {/* Architecture Clarity Box: Contextual Sarcasm vs Text-Emoji Conflict */}
            <div className="bg-gradient-to-r from-purple-950/30 via-dark-card to-amber-950/20 border border-brand-purple/30 rounded-2xl p-5 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-brand-purple/20 text-brand-purple mt-0.5 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    How Contextual Sarcasm Detection Works in MediaSentiment
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Contextual Sarcasm Detection uses <strong>Gemini AI</strong> to evaluate semantic irony, mocking praise ("waah kya acting hai"), insincere compliments, and hyperbolic statements in full conversational and emoji context.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="bg-dark-bg/80 border border-purple-500/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-purple-300 font-bold mb-1">
                        <span>🎭 Contextual Sarcasm (Gemini AI)</span>
                      </div>
                      <p className="text-[11px] text-dark-muted">
                        Semantic understanding of irony, satire, and insincerity. Evaluates text and emojis together without relying solely on polarity mismatches.
                      </p>
                    </div>
                    <div className="bg-dark-bg/80 border border-cyan-500/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-bold mb-1">
                        <span>⚡ Text-Emoji Conflict (VADER Polarity)</span>
                      </div>
                      <p className="text-[11px] text-dark-muted">
                        Rule-based check flagging when VADER word score and emoji polarity oppose each other (e.g. negative words paired with laughing emojis).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sarcastic Comments Highlight Section */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎭</span>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Identified Sarcastic Comments ({activeSarcasmAnalytics.sarcasticComments?.length || 0})
                    </h3>
                  </div>
                  <p className="text-xs text-dark-muted mt-0.5">
                    Comments classified as sarcastic with Gemini AI contextual explanations.
                  </p>
                </div>
                <button
                  onClick={() => setCommentFilter('Sarcastic (🎭)')}
                  className="text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/30 transition-colors self-start sm:self-auto"
                >
                  View All Sarcastic in Feed Filter
                </button>
              </div>

              {activeSarcasmAnalytics.sarcasticComments && activeSarcasmAnalytics.sarcasticComments.length > 0 ? (
                <div className="space-y-3">
                  {activeSarcasmAnalytics.sarcasticComments.map((item, idx) => (
                    <div key={item.id || idx} className="bg-dark-bg/80 border border-purple-500/40 rounded-xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                        <span className="font-semibold text-brand-blue">{item.author}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] flex items-center gap-1">
                            <span>🎭 Sarcastic</span>
                          </span>
                          {item.sentiment && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.sentiment === 'Positive'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : item.sentiment === 'Negative'
                                  ? 'bg-rose-500/15 text-rose-400'
                                  : 'bg-blue-500/15 text-blue-400'
                              }`}>
                              Sentiment: {item.sentiment}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-200">"{item.text}"</p>
                      {item.emojis && item.emojis.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-dark-muted">Emojis:</span>
                          {item.emojis.map((em, eIdx) => (
                            <span key={eIdx} className="text-xs px-1.5 py-0.5 bg-dark-card rounded border border-dark-border">
                              {em.char} {em.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-purple-300 mt-2 bg-purple-500/10 border border-purple-500/20 p-2 rounded-lg">
                        💡 <strong>Gemini Sarcasm Rationale:</strong> {item.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-dark-muted text-center py-8">
                  No sarcastic comments were detected in the analyzed sample.
                </p>
              )}
            </div>
          </div>
        ) : activeModelTab === 'emojis' ? (
          <div className="space-y-6">
            {/* Top 4 Emoji Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-dark-card border border-amber-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Total Emojis Detected</span>
                  <h3 className="text-2xl font-bold text-amber-400 mt-1">{activeEmojiAnalytics.totalEmojisDetected}</h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">{activeEmojiAnalytics.uniqueEmojisCount} unique emoji symbols</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-2xl">
                  🎭
                </div>
              </div>

              <div className="bg-dark-card border border-brand-cyan/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Emoji Usage Rate</span>
                  <h3 className="text-2xl font-bold text-brand-cyan mt-1">{activeEmojiAnalytics.emojiUsagePercentage}%</h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">{activeEmojiAnalytics.commentsWithEmojisCount} of {activeMetrics.totalFetched} comments</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-brand-cyan/15 flex items-center justify-center text-2xl">
                  📊
                </div>
              </div>

              <div className="bg-dark-card border border-emerald-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Positive Emojis</span>
                  <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                    {activeEmojiAnalytics.sentimentDistribution?.positive || 0}
                  </h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">
                    vs {activeEmojiAnalytics.sentimentDistribution?.negative || 0} Neg / {activeEmojiAnalytics.sentimentDistribution?.neutral || 0} Neu
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center text-2xl">
                  ❤️
                </div>
              </div>

              <div className="bg-dark-card border border-rose-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-dark-muted uppercase">Text-Emoji Conflicts</span>
                  <h3 className="text-2xl font-bold text-rose-400 mt-1">
                    {activeEmojiAnalytics.conflictingCommentsCount || 0}
                  </h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">Emotional polarity divergence</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center text-2xl">
                  ⚡
                </div>
              </div>
            </div>

            {/* Most Frequently Used Emojis Leaderboard */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Most Frequently Used Emojis in Comments
                    </h3>
                  </div>
                  <p className="text-xs text-dark-muted mt-0.5">
                    Extracted directly from user comment text and identified with Python emoji library.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-300 bg-dark-bg px-3 py-1 rounded-xl border border-dark-border">
                  Ranked by Popularity
                </span>
              </div>

              {activeEmojiAnalytics.topEmojis && activeEmojiAnalytics.topEmojis.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {activeEmojiAnalytics.topEmojis.map((em, idx) => (
                    <div
                      key={idx}
                      className="bg-dark-bg/80 border border-dark-border hover:border-amber-500/40 rounded-xl p-3 flex items-center gap-3 transition-all"
                    >
                      <span className="text-2xl select-none">{em.char}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-white truncate" title={em.name}>
                            {em.name}
                          </span>
                          <span className="text-xs font-bold text-amber-400">
                            {em.count}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-dark-muted">#{idx + 1} most used</span>
                          <span className={`px-1.5 py-0.2 rounded font-semibold ${em.sentiment === 'Positive'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : em.sentiment === 'Negative'
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-blue-500/15 text-blue-400'
                            }`}>
                            {em.sentiment}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-dark-muted text-center py-6">
                  No emojis were detected in the fetched comments for this video.
                </p>
              )}
            </div>

            {/* Text-Emoji Emotional Conflict Highlight Section */}
            {activeEmojiAnalytics.conflictingComments && activeEmojiAnalytics.conflictingComments.length > 0 && (
              <div className="bg-gradient-to-br from-dark-card to-amber-950/20 border border-amber-500/40 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Text vs Emoji Emotional Conflict Detector
                    </h3>
                    <p className="text-xs text-dark-muted">
                      Comments where textual polarity clashes with emoji emotion (e.g. negative criticism paired with positive emojis)
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {activeEmojiAnalytics.conflictingComments.map((item, idx) => (
                    <div key={idx} className="bg-dark-bg/80 border border-dark-border rounded-xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                        <span className="font-semibold text-slate-300">{item.author}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 font-medium">
                            Text: {item.vaderSentiment}
                          </span>
                          <span className="text-dark-muted">vs</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                            Emoji: {item.emojiSentiment}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                            ⚡ {item.conflictType}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-200">"{item.text}"</p>
                      <p className="text-[11px] text-amber-300/90 mt-2 italic">
                        💡 Insight: {item.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD MODEL TABS (Comparison, VADER, Gemini) */
          <>
            {/* Model Agreement Stats Card (Shown in Comparison Tab) */}
            {activeModelTab === 'comparison' && (
              <div className="bg-gradient-to-br from-dark-card via-dark-surface to-dark-card border border-brand-purple/30 rounded-2xl p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-brand-purple" />
                      <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                        VADER vs Gemini Model Agreement Breakdown
                      </h3>
                    </div>
                    <p className="text-xs text-dark-muted mt-0.5">
                      Comparison evaluated on the {activeComparison.totalCompared} comments analyzed by both systems.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-dark-bg px-3 py-1.5 rounded-xl border border-dark-border">
                    <span className="text-xs text-dark-muted">Agreement Rate:</span>
                    <span className="text-sm font-bold text-emerald-400">{activeComparison.agreementRate}%</span>
                  </div>
                </div>

                {/* Agreement Progress Bar */}
                <div className="w-full bg-dark-bg h-3 rounded-full overflow-hidden border border-dark-border flex mb-4">
                  <div
                    style={{ width: `${activeComparison.agreementRate}%` }}
                    className="bg-emerald-500 h-full transition-all duration-500"
                    title={`Agreed: ${activeComparison.agreementCount} comments (${activeComparison.agreementRate}%)`}
                  />
                  <div
                    style={{ width: `${100 - activeComparison.agreementRate}%` }}
                    className="bg-rose-500 h-full transition-all duration-500"
                    title={`Disagreed: ${activeComparison.disagreementCount} comments (${100 - activeComparison.agreementRate}%)`}
                  />
                </div>

                {/* Breakdown Tags Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="bg-dark-bg/80 border border-dark-border p-2.5 rounded-xl">
                    <span className="text-[10px] text-dark-muted block">Total Agreed</span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {activeComparison.agreementCount} ({activeComparison.agreementRate}%)
                    </span>
                  </div>

                  <div className="bg-dark-bg/80 border border-dark-border p-2.5 rounded-xl">
                    <span className="text-[10px] text-dark-muted block">Total Disagreed</span>
                    <span className="text-base font-bold text-rose-400 mt-0.5 block flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {activeComparison.disagreementCount} ({100 - activeComparison.agreementRate}%)
                    </span>
                  </div>

                  <div className="bg-dark-bg/80 border border-dark-border p-2.5 rounded-xl">
                    <span className="text-[10px] text-dark-muted block">VADER Avg Compound</span>
                    <span className="text-base font-bold text-brand-cyan mt-0.5 block">
                      {activeVader.averageCompound !== undefined ? activeVader.averageCompound : '0.00'}
                    </span>
                  </div>

                  <div className="bg-dark-bg/80 border border-dark-border p-2.5 rounded-xl">
                    <span className="text-[10px] text-dark-muted block">Gemini Model Used</span>
                    <span className="text-xs font-mono font-bold text-purple-300 mt-1 block truncate" title={activeGemini.modelUsed}>
                      {activeGemini.modelUsed || 'gemini-3.1-flash-lite'}
                    </span>
                  </div>
                </div>

                {/* Disagreement Patterns */}
                {activeComparison.disagreementBreakdown && Object.keys(activeComparison.disagreementBreakdown).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dark-border/60 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-dark-muted text-[11px]">Divergence Patterns:</span>
                    {Object.entries(activeComparison.disagreementBreakdown).map(([key, val]) => (
                      val > 0 && (
                        <span key={key} className="bg-dark-bg px-2 py-0.5 rounded-lg border border-dark-border text-slate-300 text-[11px]">
                          {key}: <strong className="text-rose-400">{val}</strong>
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4 Summary Sentiment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={activeModelTab === 'vader' ? 'VADER Analyzed' : activeModelTab === 'gemini' ? 'Gemini Analyzed' : 'Total Evaluated'}
                value={activeModelTab === 'vader' ? currentTotalVader : activeModelTab === 'gemini' ? currentTotalGemini : currentTotalVader}
                percentage={100}
                icon={MessageSquare}
                color="purple"
              />
              <StatCard
                title="Positive Comments"
                value={displayStats.positive}
                percentage={displayPercentages.positive}
                icon={Smile}
                color="emerald"
              />
              <StatCard
                title="Negative Comments"
                value={displayStats.negative}
                percentage={displayPercentages.negative}
                icon={Frown}
                color="rose"
              />
              <StatCard
                title="Neutral Comments"
                value={displayStats.neutral}
                percentage={displayPercentages.neutral}
                icon={MinusCircle}
                color="blue"
              />
            </div>

            {/* AI Overall Summary Banner (Shown in Comparison & Gemini tabs) */}
            {activeGemini?.summary && activeModelTab !== 'vader' && (
              <div className="bg-gradient-to-r from-brand-purple/15 via-dark-card to-brand-blue/15 border border-brand-purple/30 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-brand-purple" />
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                    Gemini AI Audience Perception Summary
                  </h3>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  "{activeGemini.summary}"
                </p>
              </div>
            )}

            {/* Two Visual Charts: Pie Chart & Keyword Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SentimentPieChart data={currentPieData} />
              <KeywordBarChart data={currentKeywords} />
            </div>

            {/* Critical Negative Feedback Highlight Section */}
            {criticalComments.length > 0 && activeModelTab !== 'vader' && (
              <div className="bg-dark-card border border-rose-500/30 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Critical Feedback Highlights
                    </h3>
                    <p className="text-xs text-dark-muted">
                      Constructive criticism flagged across all batches for creator improvement
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {criticalComments.map((crit, idx) => (
                    <div key={crit.id || idx} className="bg-dark-bg/60 border border-dark-border rounded-xl p-4">
                      <div className="flex items-center justify-between text-xs text-dark-muted mb-2">
                        <span className="font-semibold text-slate-300">{crit.author}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-medium flex items-center gap-1">
                          {crit.isReply && <CornerDownRight className="w-3 h-3" />}
                          <span>Negative {crit.keywords?.[0] ? `• #${crit.keywords[0]}` : ''}</span>
                        </span>
                      </div>
                      <p className="text-sm text-slate-200">
                        "{crit.text}"
                      </p>
                      <p className="text-[11px] text-brand-purple mt-2">
                        💡 <span className="font-medium">AI Reason:</span> {crit.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Processed Comments Feed Section */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Processed Comments Feed ({filteredComments.length})
              </h3>
              <p className="text-xs text-dark-muted">
                Showing comments with dual VADER, real detected emojis, and Gemini AI sentiment
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-dark-bg p-1 rounded-xl border border-dark-border">
              {[
                { label: 'All', count: allComments.length },
                { label: 'Positive', count: displayStats.positive },
                { label: 'Negative', count: displayStats.negative },
                { label: 'Neutral', count: displayStats.neutral },
                { label: 'Sarcastic (🎭)', count: activeSarcasmAnalytics.sarcasticCount },
                { label: 'Text-Emoji Conflict', count: activeEmojiAnalytics.conflictingCommentsCount },
                { label: 'Has Emojis', count: activeEmojiAnalytics.commentsWithEmojisCount },
                { label: 'Agreed', count: activeComparison.agreementCount },
                { label: 'Disagreed', count: activeComparison.disagreementCount },
                { label: 'Replies', count: activeMetrics.replyCount },
              ].map(({ label, count }) => (
                <button
                  key={label}
                  onClick={() => setCommentFilter(label)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${commentFilter === label
                      ? 'bg-dark-surface text-white shadow border border-dark-border'
                      : 'text-dark-muted hover:text-white'
                    }`}
                >
                  {label} {count !== undefined && `(${count})`}
                </button>
              ))}
            </div>
          </div>

          {filteredComments.length > 0 ? (
            <div className="space-y-3">
              {filteredComments.map((comment) => {
                const vaderSent = comment.vader?.sentiment || 'Neutral';
                const geminiSent = comment.geminiSentiment || comment.sentiment;
                const isDisagreed = comment.hasGeminiAnalysis && !comment.isAgreed;
                const hasConflict = comment.emojiConflict?.hasConflict;
                const isSarcastic = comment.sarcasm?.verdict === 'Sarcastic';

                return (
                  <div
                    key={comment.id}
                    className={`p-4 rounded-xl bg-dark-bg/60 border transition-all ${isSarcastic
                        ? 'border-purple-500/50 bg-purple-500/5'
                        : hasConflict
                          ? 'border-amber-500/50 bg-amber-500/5'
                          : isDisagreed
                            ? 'border-cyan-500/40 bg-cyan-500/5'
                            : 'border-dark-border hover:border-dark-muted/30'
                      }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-brand-blue">
                          {comment.author}
                        </span>
                        {comment.isReply && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/20 flex items-center gap-0.5">
                            <CornerDownRight className="w-2.5 h-2.5" /> Reply
                          </span>
                        )}
                        {comment.likeCount > 0 && (
                          <span className="text-[10px] text-dark-muted flex items-center gap-1">
                            <ThumbsUp className="w-2.5 h-2.5" /> {comment.likeCount}
                          </span>
                        )}
                      </div>

                      {/* Badges: VADER + Gemini + Sarcasm + Agreement Tag + Conflict Tag */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* VADER Badge */}
                        {comment.vader && (
                          <span
                            title={`VADER Compound Score: ${comment.vader.compound}`}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${vaderSent === 'Positive'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : vaderSent === 'Negative'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              }`}
                          >
                            VADER: {vaderSent} ({comment.vader.compound > 0 ? `+${comment.vader.compound}` : comment.vader.compound})
                          </span>
                        )}

                        {/* Gemini Badge */}
                        {comment.hasGeminiAnalysis ? (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${geminiSent === 'Positive'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : geminiSent === 'Negative'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              }`}
                          >
                            Gemini: {geminiSent}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-dark-muted px-2 py-0.5 bg-dark-card rounded border border-dark-border">
                            VADER-Only
                          </span>
                        )}

                        {/* Contextual Sarcasm Badge */}
                        {isSarcastic ? (
                          <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/40 flex items-center gap-1">
                            <span>🎭 Sarcastic</span>
                          </span>
                        ) : comment.sarcasm?.verdict === 'Uncertain' && comment.hasGeminiAnalysis ? (
                          <span className="text-[10px] font-medium text-slate-400 bg-dark-card px-2 py-0.5 rounded-full border border-dark-border flex items-center gap-1">
                            <span>🎭 Sarcasm: Uncertain</span>
                          </span>
                        ) : null}

                        {/* Agreement Status Indicator */}
                        {comment.hasGeminiAnalysis && (
                          comment.isAgreed ? (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Agreed
                            </span>
                          ) : (
                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30 flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5" /> Diverged
                            </span>
                          )
                        )}

                        {/* Text-Emoji Conflict Badge */}
                        {hasConflict && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5 text-amber-400" /> Text-Emoji Conflict
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-slate-200">{comment.text}</p>

                    {/* Detected Actual Emojis Pill Row */}
                    {comment.emojis && comment.emojis.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-dark-border/50">
                        <span className="text-[10px] font-semibold text-dark-muted uppercase mr-1">
                          Detected Emojis:
                        </span>
                        {comment.emojis.map((em, eIdx) => (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-dark-card border border-dark-border text-xs"
                            title={`${em.name} (${em.sentiment} sentiment)`}
                          >
                            <span className="text-sm select-none">{em.char}</span>
                            <span className="text-[10px] font-bold text-slate-200">x{em.count}</span>
                            <span className="text-[10px] text-dark-muted hidden sm:inline truncate max-w-[120px]">
                              {em.name}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Sarcasm Explanation Pill */}
                    {isSarcastic && comment.sarcasm?.explanation && (
                      <div className="mt-2 text-[11px] bg-purple-500/10 border border-purple-500/30 text-purple-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                        <span className="text-sm select-none">🎭</span>
                        <span><strong>Contextual Sarcasm Insight:</strong> {comment.sarcasm.explanation}</span>
                      </div>
                    )}

                    {/* Conflict Explanation Pill */}
                    {hasConflict && comment.emojiConflict?.explanation && (
                      <div className="mt-2 text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span><strong>Text-Emoji Conflict:</strong> {comment.emojiConflict.explanation}</span>
                      </div>
                    )}

                    {/* Gemini Reasoning */}
                    {comment.geminiReason && (
                      <p className="text-[11px] text-slate-400 mt-2 bg-dark-bg/80 p-2 rounded-lg border border-dark-border/60">
                        <span className="text-brand-purple font-semibold">Gemini AI Reasoning:</span> {comment.geminiReason}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-dark-border/60 text-[11px] text-dark-muted">
                      <div className="flex items-center gap-1.5">
                        <span>Keywords:</span>
                        {comment.keywords?.length > 0 ? (
                          comment.keywords.map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-dark-card rounded text-slate-300">
                              #{kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-dark-muted">N/A</span>
                        )}
                      </div>
                      {comment.publishedAt && (
                        <span>{comment.publishedAt}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-dark-muted bg-dark-bg/40 rounded-xl">
              No comments match the selected "{commentFilter}" filter.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
