import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Trash2,
  ExternalLink,
  PieChart,
  Calendar,
  Clock,
  Layers,
  Sparkles,
  Smile,
  AlertTriangle,
  Menu,
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  Film,
  FileDown
} from 'lucide-react';
import { fetchAnalysisHistory, fetchAnalysisById, deleteAnalysisRecord } from '../services/api';
import { generatePdfReport } from '../services/reportGenerator';

const AnalysisHistory = ({ onOpenSidebar, onViewAnalysis, onNewAnalysis }) => {
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [loadingViewId, setLoadingViewId] = useState(null);
  const [downloadingReportId, setDownloadingReportId] = useState(null);

  const handleDownloadReport = async (item, e) => {
    if (e) e.stopPropagation();
    setDownloadingReportId(item._id);

    try {
      let fullRecord = item;
      // Fetch full document with all comments if not already loaded (history list excludes comments)
      if (!Array.isArray(item.comments) || item.comments.length === 0) {
        const res = await fetchAnalysisById(item._id);
        if (res.success && res.data?.data) {
          fullRecord = res.data.data;
        }
      }

      const res = await generatePdfReport(fullRecord);
      if (!res.success) {
        alert(`Failed to generate report: ${res.error}`);
      }
    } catch (err) {
      alert(`Report error: ${err.message}`);
    } finally {
      setDownloadingReportId(null);
    }
  };

  const loadHistory = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const res = await fetchAnalysisHistory({ limit: 50 });
    if (res.success && res.data) {
      setHistoryItems(res.data.data || []);
    } else {
      setError(res.error || 'Failed to load analysis history from database.');
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this saved analysis from history?')) {
      return;
    }

    setDeletingId(id);
    const res = await deleteAnalysisRecord(id);
    if (res.success) {
      setHistoryItems((prev) => prev.filter((item) => item._id !== id));
    } else {
      alert(`Delete failed: ${res.error}`);
    }
    setDeletingId(null);
  };

  const handleView = async (item) => {
    setLoadingViewId(item._id);
    // Fetch full document with all comments if not already populated
    const res = await fetchAnalysisById(item._id);
    setLoadingViewId(null);

    if (res.success && res.data?.data) {
      if (onViewAnalysis) {
        onViewAnalysis(res.data.data);
      }
    } else {
      // Fallback to item itself if already available
      if (onViewAnalysis) {
        onViewAnalysis(item);
      }
    }
  };

  // Filter items by search query
  const filteredItems = historyItems.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const title = item.video?.title?.toLowerCase() || '';
    const channel = item.video?.channelTitle?.toLowerCase() || '';
    const vid = item.videoId?.toLowerCase() || '';
    return title.includes(term) || channel.includes(term) || vid.includes(term);
  });

  // Calculate summary stats
  const totalSaved = historyItems.length;
  const totalCommentsAcrossAll = historyItems.reduce((acc, curr) => {
    return acc + (curr.metrics?.totalVaderAnalyzed || curr.metrics?.totalFetched || 0);
  }, 0);
  const totalSarcasmDetected = historyItems.reduce((acc, curr) => {
    return acc + (curr.sarcasmAnalytics?.sarcasticCount || curr.metrics?.sarcasticCount || 0);
  }, 0);
  const totalEmojisAcrossAll = historyItems.reduce((acc, curr) => {
    return acc + (curr.emojiAnalytics?.totalEmojisDetected || curr.metrics?.totalEmojisDetected || 0);
  }, 0);

  return (
    <div className="flex-1 min-h-screen bg-dark-bg text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 h-16 bg-dark-surface/80 backdrop-blur-md border-b border-dark-border px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 rounded-xl text-dark-muted hover:text-white hover:bg-dark-card transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center text-brand-purple">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Analysis History</h2>
              <p className="text-[10px] text-dark-muted hidden sm:block">MongoDB Atlas Persistent Storage</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadHistory(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-cyan' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Saved Videos</p>
              <p className="text-lg font-bold text-white mt-0.5">{totalSaved}</p>
            </div>
          </div>

          <div className="bg-dark-surface border border-dark-border rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Comments Analyzed</p>
              <p className="text-lg font-bold text-white mt-0.5">{totalCommentsAcrossAll.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-dark-surface border border-dark-border rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Emojis Extracted</p>
              <p className="text-lg font-bold text-white mt-0.5">{totalEmojisAcrossAll.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-dark-surface border border-dark-border rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-amber/10 border border-brand-amber/20 flex items-center justify-center text-brand-amber shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Sarcasm Tracked</p>
              <p className="text-lg font-bold text-white mt-0.5">{totalSarcasmDetected.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-dark-surface border border-dark-border rounded-xl p-3">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by video title, channel, or video ID..."
              className="w-full pl-9 pr-4 py-2 bg-dark-card border border-dark-border rounded-lg text-xs text-slate-100 placeholder-dark-muted focus:outline-none focus:border-brand-purple transition-colors"
            />
          </div>
          <span className="text-xs text-dark-muted self-end sm:self-center">
            Showing <strong className="text-white">{filteredItems.length}</strong> of {totalSaved} entries
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="w-8 h-8 text-brand-purple animate-spin" />
            <p className="text-sm text-dark-muted">Loading your saved analyses from MongoDB Atlas...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Unable to Load History</h3>
            <p className="text-xs text-rose-300 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => loadHistory(false)}
              className="px-4 py-2 bg-dark-card hover:bg-dark-surface border border-dark-border text-xs font-semibold text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && historyItems.length === 0 && (
          <div className="py-16 bg-dark-surface border border-dark-border rounded-2xl p-8 text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple mx-auto">
              <History className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No Analysis History Yet</h3>
              <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                Whenever you analyze a YouTube video, its sentiment breakdown, emoji stats, and sarcasm analytics will automatically be saved to MongoDB Atlas here.
              </p>
            </div>
            {onNewAnalysis && (
              <button
                onClick={onNewAnalysis}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/20 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Analyze a YouTube Video
              </button>
            )}
          </div>
        )}

        {/* Filtered Empty State */}
        {!loading && !error && historyItems.length > 0 && filteredItems.length === 0 && (
          <div className="py-12 text-center text-dark-muted text-xs">
            No saved analyses match "<span className="text-white">{searchTerm}</span>". Try another search keyword.
          </div>
        )}

        {/* History List */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const video = item.video || {};
              const metrics = item.metrics || {};
              const vader = item.vader || {};
              const gemini = item.gemini || {};
              const sarcasm = item.sarcasmAnalytics || {};
              const emojis = item.emojiAnalytics || {};
              const analyzedDate = item.analyzedAt ? new Date(item.analyzedAt).toLocaleString() : 'Recent';
              const isDeleting = deletingId === item._id;
              const isLoadingThis = loadingViewId === item._id;

              return (
                <div
                  key={item._id}
                  className="bg-dark-surface border border-dark-border hover:border-slate-700/80 rounded-xl p-4 sm:p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Video Info */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="relative w-28 h-18 sm:w-36 sm:h-20 rounded-lg overflow-hidden bg-black shrink-0 border border-dark-border">
                      <img
                        src={video.thumbnail || `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                        alt={video.title || 'Video Thumbnail'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
                        }}
                      />
                      <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                        {item.engine === 'youtube_api' ? 'API' : 'PY'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-brand-purple">
                          {video.channelTitle || 'YouTube Creator'}
                        </span>
                        <span className="text-[11px] text-dark-muted">•</span>
                        <span className="text-[11px] text-dark-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {analyzedDate}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-white line-clamp-1 mt-0.5 hover:text-brand-cyan transition-colors">
                        {video.title || `YouTube Video (${item.videoId})`}
                      </h4>

                      {/* Analytics Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* VADER Score */}
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-dark-card border border-dark-border text-[11px]">
                          <span className="font-semibold text-dark-muted">VADER:</span>
                          <span className="text-emerald-400 font-medium">+{vader.percentages?.positive || 0}%</span>
                          <span className="text-rose-400 font-medium">-{vader.percentages?.negative || 0}%</span>
                          <span className="text-blue-400 font-medium">~{vader.percentages?.neutral || 0}%</span>
                        </div>

                        {/* Gemini Contextual */}
                        {gemini.totalAnalyzed > 0 && (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-purple/10 border border-brand-purple/20 text-[11px]">
                            <span className="font-semibold text-brand-purple">Gemini:</span>
                            <span className="text-emerald-400 font-medium">+{gemini.percentages?.positive || 0}%</span>
                            <span className="text-rose-400 font-medium">-{gemini.percentages?.negative || 0}%</span>
                          </div>
                        )}

                        {/* Comments count */}
                        <span className="text-[11px] text-dark-muted">
                          {metrics.totalVaderAnalyzed || metrics.totalFetched || 0} comments
                        </span>

                        {/* Sarcasm count */}
                        {(sarcasm.sarcasticCount || metrics.sarcasticCount) > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-amber/10 border border-brand-amber/20 text-[10px] font-semibold text-brand-amber">
                            <Sparkles className="w-2.5 h-2.5" />
                            {sarcasm.sarcasticCount || metrics.sarcasticCount} Sarcastic
                          </span>
                        )}

                        {/* Emojis count */}
                        {(emojis.totalEmojisDetected || metrics.totalEmojisDetected) > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-dark-card border border-dark-border text-[10px] text-slate-300">
                            <Smile className="w-2.5 h-2.5 text-emerald-400" />
                            {emojis.totalEmojisDetected || metrics.totalEmojisDetected} emojis
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-dark-border">
                    <a
                      href={`https://www.youtube.com/watch?v=s${item.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-dark-muted hover:text-white hover:bg-dark-card transition-colors"
                      title="Open on YouTube"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      onClick={(e) => handleDelete(item._id, e)}
                      disabled={isDeleting}
                      className="p-2 rounded-xl text-dark-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      title="Delete saved analysis"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleDownloadReport(item, e)}
                      disabled={downloadingReportId === item._id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-card hover:bg-dark-surface border border-dark-border hover:border-slate-600 text-slate-200 text-xs font-semibold transition-all disabled:opacity-50"
                      title="Download PDF Report"
                    >
                      {downloadingReportId === item._id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-purple" />
                          <span className="hidden sm:inline">Generating...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="w-3.5 h-3.5 text-brand-cyan" />
                          <span className="hidden sm:inline">PDF Report</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleView(item)}
                      disabled={isLoadingThis}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-purple hover:bg-purple-600 text-white text-xs font-semibold shadow-md shadow-purple-900/20 transition-all disabled:opacity-50"
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Results</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AnalysisHistory;

