import React, { useState } from 'react';
import { Youtube, Sparkles, AlertCircle, ArrowRight, CheckCircle2, Layers, Terminal, Database, Activity } from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtubeValidator';

const YouTubeInputCard = ({ onAnalyze, isLoading }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [detectedId, setDetectedId] = useState('');
  const [maxAnalyze, setMaxAnalyze] = useState(100); // Gemini batches
  const [engine, setEngine] = useState('python'); // 'python' or 'youtube_api'
  const [downloadLimit, setDownloadLimit] = useState(1000); // VADER & Fetch limit

  const handleInputChange = (e) => {
    const val = e.target.value;
    setUrl(val);
    if (error) setError('');

    if (val.trim()) {
      const extracted = extractYouTubeVideoId(val);
      setDetectedId(extracted || '');
    } else {
      setDetectedId('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Kripya ek valid YouTube URL enter karein.');
      setDetectedId('');
      return;
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      setError('Valid YouTube URL provide karein (e.g., https://youtu.be/... ya https://www.youtube.com/watch?v=...)');
      setDetectedId('');
      return;
    }

    setError('');
    setDetectedId(videoId);
    if (onAnalyze) {
      onAnalyze(videoId, url.trim(), maxAnalyze, { engine, downloadLimit });
    }
  };

  const handleQuickPaste = (exampleUrl) => {
    setUrl(exampleUrl);
    setError('');
    const extracted = extractYouTubeVideoId(exampleUrl);
    setDetectedId(extracted || '');
  };

  return (
    <div className="bg-gradient-to-br from-dark-card via-dark-surface to-dark-card border border-dark-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -right-16 -top-16 w-52 h-52 bg-brand-purple/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-purple/15 text-brand-purple border border-brand-purple/30 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Dual-Model Sentiment Engine (VADER + Gemini)
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Analyze YouTube Comments
          </h2>
          <p className="text-xs text-dark-muted mt-1 max-w-2xl leading-relaxed">
            Python <code className="text-brand-cyan">youtube-comment-downloader</code> se bina quota limits ke <strong>1,000+ comments</strong> fetch karke <span className="text-emerald-400 font-semibold">VADER</span> (all comments) aur <span className="text-brand-purple font-semibold">Gemini AI</span> (batched deep semantic analysis) dono se evaluate karein.
          </p>
        </div>

        {/* Engine Switcher & Limit Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Engine Selector */}
          <div className="flex items-center gap-1 bg-dark-bg/80 border border-dark-border p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setEngine('python')}
              title="Python subprocess: No quota limits, fetches 1,000+ comments easily"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                engine === 'python'
                  ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-sm'
                  : 'text-dark-muted hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Python Downloader</span>
            </button>
            <button
              type="button"
              onClick={() => setEngine('youtube_api')}
              title="Official YouTube Data API v3"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                engine === 'youtube_api'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                  : 'text-dark-muted hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>YouTube API</span>
            </button>
          </div>

          {/* VADER & Fetch Scope Limit */}
          <div className="flex items-center gap-1 bg-dark-bg/80 border border-dark-border p-1 rounded-xl shrink-0">
            <Activity className="w-3.5 h-3.5 text-emerald-400 ml-1.5" />
            <span className="text-[11px] text-dark-muted font-medium" title="Comments downloaded and analyzed with VADER">Fetch & VADER:</span>
            {[
              { value: 250, label: '250' },
              { value: 500, label: '500' },
              { value: 1000, label: '1000' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDownloadLimit(opt.value)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  downloadLimit === opt.value
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow'
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Gemini AI Batch Limit */}
          <div className="flex items-center gap-1 bg-dark-bg/80 border border-dark-border p-1 rounded-xl shrink-0">
            <Layers className="w-3.5 h-3.5 text-brand-purple ml-1.5" />
            <span className="text-[11px] text-dark-muted font-medium" title="Comments analyzed by Gemini AI in batches of 25">Gemini:</span>
            {[
              { value: 50, label: '50' },
              { value: 100, label: '100' },
              { value: 200, label: '200' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxAnalyze(opt.value)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  maxAnalyze === opt.value
                    ? 'bg-brand-purple text-white shadow'
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-500">
            <Youtube className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={url}
            onChange={handleInputChange}
            placeholder="Paste YouTube Video URL (e.g. https://youtu.be/... ya https://www.youtube.com/watch?v=...)"
            className="w-full pl-11 pr-32 py-3.5 bg-dark-bg/80 border border-dark-border focus:border-brand-purple focus:ring-1 focus:ring-brand-purple rounded-xl text-sm text-white placeholder-dark-muted transition-all outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-lg bg-gradient-to-r from-brand-purple to-brand-blue hover:from-purple-600 hover:to-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <span>Analyzing...</span>
            ) : (
              <>
                <span>Analyze</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Live Detected Video ID Preview */}
        {detectedId && !error && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Detected Video ID: <strong className="font-mono bg-dark-bg px-1.5 py-0.5 rounded border border-dark-border">{detectedId}</strong>
            </span>
          </div>
        )}

        {/* Validation Error Message */}
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-dark-muted">
          <span>Quick Examples:</span>
          <button
            type="button"
            onClick={() => handleQuickPaste('https://youtu.be/nJNsOLJ0rTo?si=gywQtLRPMPHcwbfW')}
            className="text-brand-purple hover:underline font-mono"
          >
            Aakash Gupta (1,400+ comments)
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleQuickPaste('https://youtu.be/FRkJ8uGCEEE?si=9BJOG8FcUu1fDuxP')}
            className="text-slate-400 hover:underline font-mono"
          >
            Mast Magan (0 comments)
          </button>
        </div>
      </form>
    </div>
  );
};

export default YouTubeInputCard;
