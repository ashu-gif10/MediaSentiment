import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Smile,
  Frown,
  MinusCircle,
  Star,
  FileDown,
  ExternalLink,
  RefreshCw,
  Loader2,
  Search,
  Menu,
  Info,
  Scale,
  MessageSquare,
  Eye,
  Download,
  Filter,
  Check,
  Zap,
  HelpCircle,
  Clock,
  Link as LinkIcon,
  Globe,
  ShieldCheck,
  ShieldAlert,
  WifiOff,
  ArrowRight,
  Copy,
  FolderOpen
} from 'lucide-react';
import StatCard from '../components/StatCard';
import SentimentPieChart from '../components/SentimentPieChart';
import KeywordBarChart from '../components/KeywordBarChart';
import HealthCheckBadge from '../components/HealthCheckBadge';
import { validateAndParseReviewsCsv } from '../utils/csvParser';
import { validateFlipkartUrl } from '../utils/flipkartValidator';
import { analyzeProductReviews, validateFlipkartUrlApi, fetchFlipkartReviewsApi } from '../services/api';
import { generatePdfReport } from '../services/reportGenerator';

// Default Sample dataset
const SAMPLE_CSV_CONTENT = `review_text,rating,date,author
"The active noise cancellation on these headphones is absolute magic. Battery lasts for days and setup was seamless! 🎧✨",5,2026-02-14,TechEnthusiast_99
"Oh fantastic, another premium gadget whose right ear cup stopped working after 3 days. Truly top tier build quality! 🙄🤦‍♂️",1,2026-02-15,DisappointedBuyer
"Sound quality is warm and balanced for classical music, though the companion app requires too many permissions.",4,2026-02-16,AudioPhile_MD
"Complete waste of money. The headband hurts after 20 minutes and customer support refused to honor the warranty.",1,2026-02-17,AngryCustomer
"Decent budget alternative. Nothing groundbreaking, but gets the job done for daily zoom meetings.",3,2026-02-18,WorkFromHomePro
"I absolutely love how lightweight these are! Comfortable for 8-hour flights. Best travel accessory ever ❤️✈️",5,2026-02-19,FrequentFlyer
"Great packaging, really loved the box! Too bad the headphones themselves arrived completely bricked and won't charge. 💔📦",1,2026-02-20,SarcasticShopper
"Microphone clarity in noisy cafes is surprisingly good. My colleagues heard me loud and clear.",4,2026-02-21,ConsultantLife
"Average soundstage, bass is a bit too muddy for hip-hop, but battery life is as advertised.",3,2026-02-22,MusicLover88
"Super fast delivery and flawless build! Highly recommend to any student or professional looking for focus. 🚀🔥",5,2026-02-23,HappyScholar`;

// Flipkart Product Review Sample Dataset
const FLIPKART_SAMPLE_CSV = `review_text,rating,date,author,title
"Bass is punchy and battery backup easily lasts 5 hours on a single charge. Super happy with this purchase! 🎵⚡",5,2026-03-01,Rohan Sharma,"Value for money"
"Oh wonderful engineering, left earbud stopped pairing on day 2. Truly remarkable Flipkart quality! 🤦‍♂️🙄",1,2026-03-02,Amit Kumar,"Disappointed"
"Decent sound for online classes and casual music. Mic is slightly muffled in windy environments.",3,2026-03-03,Sneha Patel,"Good for budget"
"Pathetic experience. Case hinge feels flimsy and Flipkart customer service refused return.",1,2026-03-04,Vikram R.,"Do not buy"
"Comfortable fit for daily jogging. Type-C fast charging is really convenient. 👍🔥",5,2026-03-05,Pooja Verma,"Must buy"
"Loved the packaging, very stylish box! Too bad the right earbud arrived dead on arrival. 📦💔",1,2026-03-06,Deepak M.,"Total waste"
"Call quality in quiet rooms is crystal clear. Connection drops occasionally in crowded metro stations.",4,2026-03-07,Karan Singh,"Satisfied"
"Average build quality. Expected better treble response, but for under 1000 rupees it's acceptable.",3,2026-03-08,Ananya D.,"Average product"
"Connectivity with laptop and phone is instant. Sleek design and great matte finish. ❤️🎧",5,2026-03-09,Neha Gupta,"Awesome product"
"Sound is loud but treble hurts ears at high volume. Battery is decent though.",3,2026-03-10,Rahul Joshi,"Just okay"`;

const ProductReviews = ({ onOpenSidebar, loadedAnalysis, onClearLoadedAnalysis }) => {
  // Workflow Tab Mode: 'flipkart' | 'csv'
  const [activeWorkflowTab, setActiveWorkflowTab] = useState('flipkart');

  // Flipkart URL input and validation state
  const [flipkartInputUrl, setFlipkartInputUrl] = useState('');
  const [flipkartValidating, setFlipkartValidating] = useState(false);
  const [flipkartValidationResult, setFlipkartValidationResult] = useState(null);
  const [flipkartError, setFlipkartError] = useState(null);
  const [flipkartSuccess, setFlipkartSuccess] = useState(null);

  // Upload and metadata state
  const [csvFile, setCsvFile] = useState(null);
  const [csvRawText, setCsvRawText] = useState('');
  const [productName, setProductName] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [maxAnalyze, setMaxAnalyze] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dataSourceType, setDataSourceType] = useState('user_csv'); // 'user_csv' | 'sample_demo'
  const [fetchingLiveReviews, setFetchingLiveReviews] = useState(false);
  const [liveFetchResult, setLiveFetchResult] = useState(null);
  const fileInputRef = useRef(null);

  // Browser Extension Guide state
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);
  const [copiedExtensionPath, setCopiedExtensionPath] = useState(false);

  const handleCopyExtensionPath = () => {
    try {
      navigator.clipboard?.writeText('C:\\Users\\User\\Desktop\\MediaSentiment\\browser-extension');
      setCopiedExtensionPath(true);
      setTimeout(() => setCopiedExtensionPath(false), 2500);
    } catch { }
  };

  // Client-side CSV validation state
  const [validationResult, setValidationResult] = useState(null);
  const [showPreviewRows, setShowPreviewRows] = useState(false);

  // Execution state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisData, setAnalysisData] = useState(loadedAnalysis || null);

  // Visuals and filters
  const [activeModelTab, setActiveModelTab] = useState('gemini');
  const [filterSentiment, setFilterSentiment] = useState('ALL');
  const [filterSarcasm, setFilterSarcasm] = useState('ALL');
  const [filterRating, setFilterRating] = useState('ALL');
  const [filterConflictOnly, setFilterConflictOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Sync loaded analysis prop if user clicked "View Analysis" from History
  useEffect(() => {
    if (loadedAnalysis) {
      setAnalysisData(loadedAnalysis);
      if (loadedAnalysis.product?.name || loadedAnalysis.video?.title) {
        setProductName(loadedAnalysis.product?.name || loadedAnalysis.video?.title);
      }
      if (loadedAnalysis.product?.url || loadedAnalysis.url) {
        setProductUrl(loadedAnalysis.product?.url || loadedAnalysis.url);
      }
      if (loadedAnalysis.isDemo || loadedAnalysis.product?.isDemo || loadedAnalysis.product?.dataSource === 'sample_demo' || loadedAnalysis.metrics?.isDemo) {
        setDataSourceType('sample_demo');
      } else {
        setDataSourceType('user_csv');
      }
    }
  }, [loadedAnalysis]);

  // Handle Flipkart URL Validation
  const handleVerifyFlipkartUrl = async () => {
    const trimmed = flipkartInputUrl.trim();
    if (!trimmed) {
      setFlipkartError({
        type: 'invalid_url',
        title: 'Invalid Flipkart Link',
        message: 'Please paste a Flipkart product URL.',
      });
      setFlipkartValidationResult(null);
      setFlipkartSuccess(null);
      return;
    }

    setFlipkartValidating(true);
    setFlipkartError(null);
    setFlipkartSuccess(null);

    // Step 1: Client-side quick syntax & domain validation
    const clientCheck = validateFlipkartUrl(trimmed);
    if (!clientCheck.valid) {
      setFlipkartError({
        type: 'invalid_url',
        title: 'Invalid Flipkart Link',
        message: clientCheck.error,
      });
      setFlipkartValidationResult(null);
      setFlipkartValidating(false);
      return;
    }

    // Step 2: Server-side validation endpoint
    try {
      const serverRes = await validateFlipkartUrlApi(trimmed);
      if (serverRes.success && serverRes.data) {
        setFlipkartValidationResult(serverRes.data.data || serverRes.data);
        setProductName(serverRes.data.data?.productName || clientCheck.productName);
        setProductUrl(serverRes.data.data?.url || clientCheck.cleanUrl);
      } else {
        // Fallback to client extraction if network error
        setFlipkartValidationResult(clientCheck);
        setProductName(clientCheck.productName);
        setProductUrl(clientCheck.cleanUrl);
      }
    } catch {
      setFlipkartValidationResult(clientCheck);
      setProductName(clientCheck.productName);
      setProductUrl(clientCheck.cleanUrl);
    } finally {
      setFlipkartValidating(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Process and pre-validate CSV text
  const processSelectedFile = (file) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setValidationResult({
        valid: false,
        error: 'Please upload a valid .csv file format.',
      });
      setCsvFile(null);
      setCsvRawText('');
      return;
    }

    setCsvFile(file);
    setDataSourceType('user_csv');
    setAnalysisError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || '';
      setCsvRawText(content);
      const parsed = validateAndParseReviewsCsv(content);
      setValidationResult(parsed);

      if (!productName) {
        const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setProductName(cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1));
      }
    };
    reader.onerror = () => {
      setValidationResult({
        valid: false,
        error: 'Failed to read the file from disk. Please try again.',
      });
    };
    reader.readAsText(file);
  };

  // Load Flipkart Sample Review Dataset
  const handleLoadFlipkartSample = () => {
    const pName = flipkartValidationResult?.productName || 'Boat Bassheads 100 Wired Earphones';
    const pUrl = flipkartValidationResult?.url || flipkartInputUrl || 'https://www.flipkart.com/boat-bassheads-100-wired-earphones/p/itm3f39544d0b96c?pid=ACCEVQZABYWJHRHF';
    setCsvFile({ name: 'flipkart_product_reviews_sample.csv', size: FLIPKART_SAMPLE_CSV.length });
    setCsvRawText(FLIPKART_SAMPLE_CSV);
    setDataSourceType('sample_demo');
    setProductName(pName);
    setProductUrl(pUrl);
    const parsed = validateAndParseReviewsCsv(FLIPKART_SAMPLE_CSV);
    setValidationResult(parsed);
    setAnalysisError(null);
    setFlipkartError(null);
  };

  // Load General Sample Dataset
  const handleLoadSampleDataset = () => {
    setCsvFile({ name: 'sample_product_reviews.csv', size: SAMPLE_CSV_CONTENT.length });
    setCsvRawText(SAMPLE_CSV_CONTENT);
    setDataSourceType('sample_demo');
    setProductName('Sony WH-1000XM5 Wireless Headphones');
    setProductUrl('https://www.amazon.com/dp/B09XS7JWHH');
    const parsed = validateAndParseReviewsCsv(SAMPLE_CSV_CONTENT);
    setValidationResult(parsed);
    setAnalysisError(null);
  };

  // Download Sample CSV template file
  const handleDownloadSampleCsv = (isFlipkart = false) => {
    const content = isFlipkart ? FLIPKART_SAMPLE_CSV : SAMPLE_CSV_CONTENT;
    const filename = isFlipkart ? 'flipkart_reviews_template.csv' : 'sample_product_reviews.csv';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1-Click Fully Automatic Flipkart Review Analysis Workflow
  const [analyzingFlipkart, setAnalyzingFlipkart] = useState(false);
  const [flipkartStepMessage, setFlipkartStepMessage] = useState('');

  const handleDirectFlipkartAnalyze = async (overrideUrl) => {
    const rawUrl = (typeof overrideUrl === 'string' ? overrideUrl : (flipkartValidationResult?.cleanUrl || flipkartInputUrl)).trim();
    if (!rawUrl) {
      setFlipkartError({
        type: 'invalid_url',
        title: 'Invalid Flipkart Link',
        message: 'Please enter a valid Flipkart product URL.',
      });
      return;
    }

    setFlipkartError(null);
    setFlipkartSuccess(null);
    setAnalysisError(null);
    setAnalyzingFlipkart(true);
    setFlipkartStepMessage('Validating Flipkart URL...');

    try {
      const check = validateFlipkartUrl(rawUrl);
      if (!check.valid) {
        setFlipkartError({
          type: 'invalid_url',
          title: 'Invalid Flipkart Link',
          message: check.error,
        });
        setAnalyzingFlipkart(false);
        return;
      }

      setFlipkartValidationResult(check);
      const targetUrl = check.cleanUrl;
      const targetMax = parseInt(maxAnalyze, 10) || 25;

      setFlipkartStepMessage(`Connecting to Flipkart and retrieving customer reviews...`);
      const fetchRes = await fetchFlipkartReviewsApi(targetUrl, targetMax);

      if (!fetchRes.success || !fetchRes.data?.reviews || fetchRes.data.reviews.length === 0) {
        const errorType = fetchRes.data?.errorType || (fetchRes.success === false && !fetchRes.data ? 'server_error' : 'no_reviews');
        const errorMsg = fetchRes.data?.message || fetchRes.error || 'No customer reviews found on this Flipkart product page.';
        
        let title = 'No Customer Reviews Found';
        if (errorType === 'access_blocked') {
          title = 'Flipkart Access Restricted (Bot Protection / E002)';
        } else if (errorType === 'delisted_product') {
          title = 'Product Delisted / Discontinued';
        } else if (errorType === 'invalid_url') {
          title = 'Invalid Flipkart Link';
        } else if (errorType === 'server_error') {
          title = 'Backend Communication Error';
        }

        setFlipkartError({
          type: errorType,
          title,
          message: errorMsg,
          statusCode: fetchRes.data?.statusCode,
          finalUrl: fetchRes.data?.finalUrl,
        });
        setAnalyzingFlipkart(false);
        return;
      }

      const fetchedReviews = fetchRes.data.reviews;
      const pName = fetchRes.data.productName || check.productName || 'Flipkart Product';
      setProductName(pName);
      setProductUrl(targetUrl);
      setDataSourceType('flipkart_direct');

      if (fetchRes.data.csvText) {
        setCsvFile({
          name: `${(check.slug || 'flipkart_product')}_live_reviews.csv`,
          size: fetchRes.data.csvText.length,
        });
        setCsvRawText(fetchRes.data.csvText);
        const parsed = validateAndParseReviewsCsv(fetchRes.data.csvText);
        setValidationResult(parsed);
      }

      setFlipkartSuccess({
        count: fetchedReviews.length,
        productName: pName,
        message: `Successfully retrieved ${fetchedReviews.length} genuine customer reviews directly from Flipkart!`,
      });

      setFlipkartStepMessage(`Running dual sentiment analysis with VADER & Gemini AI (${fetchedReviews.length} reviews)...`);
      const payload = {
        reviews: fetchedReviews.map((r, i) => ({
          id: `rev-${i + 1}`,
          text: (r.review_text || r.text || '').trim(),
          rating: typeof r.rating === 'number' ? r.rating : (parseFloat(r.rating) || 5),
          author: r.author || 'Flipkart Customer',
          date: r.date || '',
          title: r.title || '',
        })),
        metadata: {
          productName: pName,
          productUrl: targetUrl,
          dataSource: 'flipkart_direct',
          dataSourceLabel: 'Live Flipkart Reviews (Direct Fetch)',
          isDemo: false,
        },
        maxAnalyze: targetMax,
      };

      const analysisRes = await analyzeProductReviews(payload);

      if (analysisRes.success && analysisRes.data) {
        setAnalysisData(analysisRes.data);
      } else {
        setAnalysisError(analysisRes.error || 'Failed to complete sentiment analysis.');
      }
    } catch (err) {
      setFlipkartError({
        type: 'server_error',
        title: 'Network / Server Error',
        message: err.message || 'An error occurred during Flipkart review analysis.',
      });
      setAnalysisError(err.message || 'An error occurred during Flipkart review analysis.');
    } finally {
      setAnalyzingFlipkart(false);
      setFlipkartStepMessage('');
    }
  };

  // Fetch live reviews directly from Flipkart via backend fetcher
  const handleFetchFlipkartLiveReviews = async () => {
    const targetUrl = flipkartValidationResult?.cleanUrl || flipkartInputUrl.trim();
    if (!targetUrl) {
      setFlipkartError('Please verify a valid Flipkart product URL first.');
      return;
    }

    setFetchingLiveReviews(true);
    setLiveFetchResult(null);

    try {
      const res = await fetchFlipkartReviewsApi(targetUrl, 50);

      if (res.success && res.data?.reviews?.length > 0) {
        const fetchedReviews = res.data.reviews;
        const csvContent = res.data.csvText;
        const pName = res.data.productName || flipkartValidationResult?.productName || 'Flipkart Product';

        // Set as live imported CSV
        setCsvFile({
          name: `${(flipkartValidationResult?.slug || 'flipkart_product')}_live_reviews.csv`,
          size: csvContent.length,
        });
        setCsvRawText(csvContent);
        setProductName(pName);
        setProductUrl(targetUrl);
        setDataSourceType('user_csv'); // Live real customer reviews

        const parsed = validateAndParseReviewsCsv(csvContent);
        setValidationResult(parsed);

        setLiveFetchResult({
          success: true,
          totalFetched: fetchedReviews.length,
          message: `Successfully fetched ${fetchedReviews.length} authentic customer reviews directly from Flipkart!`,
          csvText: csvContent,
        });
      } else {
        setLiveFetchResult({
          success: false,
          tokenMissing: Boolean(res.data?.tokenMissing),
          statusCode: res.data?.statusCode,
          error: res.data?.message || res.error || 'Failed to retrieve reviews from Flipkart.',
        });
      }
    } catch (err) {
      setLiveFetchResult({
        success: false,
        error: err.message || 'An unexpected error occurred while fetching reviews.',
      });
    } finally {
      setFetchingLiveReviews(false);
    }
  };

  // Download the dynamically fetched live CSV
  const handleDownloadFetchedCsv = () => {
    if (!liveFetchResult?.csvText) return;
    const filename = `${(flipkartValidationResult?.slug || 'flipkart')}_live_reviews.csv`;
    const blob = new Blob([liveFetchResult.csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Trigger Sentiment Analysis
  const handleStartAnalysis = async () => {
    if (!validationResult || !validationResult.valid || validationResult.reviews.length === 0) {
      setAnalysisError('Please provide or upload review data before starting analysis.');
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const isDemo = dataSourceType === 'sample_demo';
      const payload = {
        reviews: validationResult.reviews,
        csvText: csvRawText,
        metadata: {
          productName: productName.trim() || 'Product Reviews Dataset',
          productUrl: productUrl.trim() || undefined,
          dataSource: dataSourceType,
          dataSourceLabel: isDemo ? 'Sample / Benchmark Dataset (Demo)' : 'Live User-Imported Reviews (CSV)',
          isDemo,
        },
        maxAnalyze: parseInt(maxAnalyze, 10) || 50,
      };

      const result = await analyzeProductReviews(payload);

      if (result.success && result.data) {
        setAnalysisData(result.data);
      } else {
        setAnalysisError(result.error || 'Failed to analyze product reviews.');
      }
    } catch (err) {
      setAnalysisError(err.message || 'An unexpected error occurred during review analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Download PDF Report
  const handleDownloadPdf = async () => {
    if (!analysisData) return;
    setDownloadingReport(true);
    try {
      const res = await generatePdfReport(analysisData);
      if (!res.success) {
        alert(`Failed to generate report: ${res.error}`);
      }
    } catch (err) {
      alert(`Report error: ${err.message}`);
    } finally {
      setDownloadingReport(false);
    }
  };

  // Reset to analyze another file or product
  const handleResetAnalysis = () => {
    setAnalysisData(null);
    setCsvFile(null);
    setCsvRawText('');
    setDataSourceType('user_csv');
    setLiveFetchResult(null);
    setFetchingLiveReviews(false);
    setValidationResult(null);
    setFlipkartValidationResult(null);
    setFlipkartInputUrl('');
    setFlipkartError(null);
    setAnalysisError(null);
    if (onClearLoadedAnalysis) onClearLoadedAnalysis();
  };

  // Render Star Rating helper
  const renderStars = (rating) => {
    if (!rating || typeof rating !== 'number') return null;
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${star <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'text-dark-border fill-dark-card'
              }`}
          />
        ))}
        <span className="text-xs font-semibold text-slate-300 ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  // Filter reviews
  const allReviews = analysisData?.comments || [];
  const filteredReviews = allReviews.filter((review) => {
    const currentSent = review.geminiSentiment || review.sentiment || review.vader?.sentiment || 'Neutral';
    if (filterSentiment !== 'ALL' && currentSent.toLowerCase() !== filterSentiment.toLowerCase()) {
      return false;
    }

    const isSarcastic = review.sarcasm?.verdict === 'Sarcastic';
    if (filterSarcasm === 'Sarcastic' && !isSarcastic) return false;
    if (filterSarcasm === 'Non-Sarcastic' && isSarcastic) return false;

    if (filterRating !== 'ALL') {
      const targetStar = parseInt(filterRating, 10);
      if (Math.round(review.rating) !== targetStar) return false;
    }

    if (filterConflictOnly && !review.emojiConflict?.hasConflict) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const textMatch = (review.text || '').toLowerCase().includes(q);
      const authorMatch = (review.author || '').toLowerCase().includes(q);
      if (!textMatch && !authorMatch) return false;
    }

    return true;
  });

  // Analytics extraction
  const metrics = analysisData?.metrics || {};
  const vader = analysisData?.vader || {};
  const gemini = analysisData?.gemini || {};
  const sarcasm = analysisData?.sarcasmAnalytics || {};
  const emojis = analysisData?.emojiAnalytics || {};
  const comparison = analysisData?.comparison || {};
  const ratingStats = analysisData?.ratingStats || {};

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-dark-bg min-h-screen">
      {/* Top Navigation Bar */}
      <header className="h-16 px-6 bg-dark-surface/80 backdrop-blur-md border-b border-dark-border flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 rounded-xl text-dark-muted hover:text-white hover:bg-dark-card border border-dark-border"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center text-brand-purple">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                E-Commerce & Product Review Analysis
              </h2>
              <p className="text-[10px] text-dark-muted hidden sm:block">
                Flipkart URLs • CSV Datasets • VADER Lexical & Gemini Contextual AI
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HealthCheckBadge />
          {analysisData && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingReport}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-purple/20 hover:bg-brand-purple/30 border border-brand-purple/30 text-xs font-semibold text-brand-purple transition-all shadow-sm"
              title="Download professional PDF report"
            >
              {downloadingReport ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Download PDF Report</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* ============================================================ */}
        {/* VIEW 1: UPLOAD & CONFIGURATION FORM (If no analysis data)    */}
        {/* ============================================================ */}
        {!analysisData && (
          <div className="space-y-6">
            {/* Introductory Banner */}
            <div className="bg-gradient-to-r from-brand-purple/10 via-dark-surface to-brand-blue/10 border border-dark-border rounded-2xl p-6 sm:p-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/30 text-brand-purple text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Dual-Engine Sentiment Intelligence
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Analyze Product Reviews from Flipkart & E-Commerce
                </h1>
                <p className="text-xs sm:text-sm text-dark-muted mt-2 leading-relaxed">
                  Evaluate customer feedback across thousands of reviews. Paste a Flipkart product link to reference catalog details, or upload any review CSV to analyze contextual sentiment, subtle sarcasm, text–emoji conflicts, and star ratings.
                </p>

                {/* Workflow Mode Selector Pills */}
                <div className="flex flex-wrap items-center gap-2 mt-5">
                  <button
                    onClick={() => setActiveWorkflowTab('flipkart')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeWorkflowTab === 'flipkart'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30 border border-blue-400/40'
                      : 'bg-dark-card hover:bg-dark-surface border border-dark-border text-dark-muted hover:text-white'
                      }`}
                  >
                    <Globe className="w-4 h-4 text-blue-400" />
                    Flipkart Product Link Mode
                  </button>
                  <button
                    onClick={() => setActiveWorkflowTab('csv')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeWorkflowTab === 'csv'
                      ? 'bg-brand-purple text-white shadow-lg shadow-purple-900/30 border border-purple-400/40'
                      : 'bg-dark-card hover:bg-dark-surface border border-dark-border text-dark-muted hover:text-white'
                      }`}
                  >
                    <FileText className="w-4 h-4 text-brand-purple" />
                    Direct CSV File Mode
                  </button>
                </div>
              </div>
            </div>

            {/* Container */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Main Workflow Inputs */}
              <div className="lg:col-span-2 space-y-4">
                {/* -------------------------------------------------------- */}
                {/* MODE 1: FLIPKART PRODUCT URL MODE                        */}
                {/* -------------------------------------------------------- */}
                {activeWorkflowTab === 'flipkart' && (
                  <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-400" />
                        <h3 className="text-sm font-bold text-white">Flipkart Product URL Analysis</h3>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
                        flipkart.com
                      </span>
                    </div>

                    <p className="text-xs text-dark-muted">
                      Paste a direct Flipkart product link (supports <code className="text-slate-300">/p/</code>, <code className="text-slate-300">/product-reviews/</code>, or short links).
                    </p>

                    {/* Flipkart URL Input Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                        <input
                          type="url"
                          value={flipkartInputUrl}
                          onChange={(e) => {
                            setFlipkartInputUrl(e.target.value);
                            if (flipkartError) setFlipkartError(null);
                            if (flipkartSuccess) setFlipkartSuccess(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && flipkartInputUrl.trim() && !analyzingFlipkart) {
                              handleDirectFlipkartAnalyze();
                            }
                          }}
                          placeholder="Paste Flipkart product URL (e.g. https://www.flipkart.com/.../p/...)"
                          className="w-full pl-10 pr-4 py-2.5 bg-dark-card border border-dark-border rounded-xl text-xs text-slate-100 placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>

                      {/* Batch size selector */}
                      <select
                        value={maxAnalyze}
                        onChange={(e) => setMaxAnalyze(Number(e.target.value))}
                        className="bg-dark-card border border-dark-border rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 shrink-0 font-medium cursor-pointer"
                        title="Maximum reviews to fetch & analyze"
                      >
                        <option value={10}>10 Reviews</option>
                        <option value={25}>25 Reviews</option>
                        <option value={50}>50 Reviews</option>
                      </select>

                      {/* Primary 1-Click Analyze Button */}
                      <button
                        onClick={() => handleDirectFlipkartAnalyze()}
                        disabled={analyzingFlipkart || !flipkartInputUrl.trim()}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30 shrink-0"
                        title="Fetch genuine customer reviews and analyze with VADER & Gemini"
                      >
                        {analyzingFlipkart ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>Analyze Reviews</span>
                          </>
                        )}
                      </button>

                      {/* Optional Verify Button */}
                      <button
                        onClick={handleVerifyFlipkartUrl}
                        disabled={flipkartValidating || analyzingFlipkart || !flipkartInputUrl.trim()}
                        className="px-3.5 py-2.5 rounded-xl bg-dark-card hover:bg-dark-surface border border-dark-border disabled:opacity-40 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0"
                        title="Verify product metadata only"
                      >
                        {flipkartValidating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Verify</span>
                      </button>
                    </div>

                    {/* Live Fetching Progress Banner */}
                    {analyzingFlipkart && (
                      <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-200 flex items-center gap-3 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                        <div>
                          <strong className="block text-white font-semibold">{flipkartStepMessage}</strong>
                          <span className="text-[11px] text-blue-300/80">
                            Retrieving real customer reviews directly and processing with dual VADER + Gemini AI engines...
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Distinct Error Banner */}
                    {flipkartError && (() => {
                      const err = typeof flipkartError === 'string'
                        ? { type: 'general', title: 'Flipkart Notice', message: flipkartError }
                        : flipkartError;

                      if (err.type === 'access_blocked') {
                        return (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-3">
                            <div className="flex items-start gap-3">
                              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-1 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="font-bold text-amber-100 text-sm">{err.title || 'Flipkart Access Restricted (Bot Protection / E002)'}</strong>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-bold uppercase tracking-wider">
                                    Akamai Shield Active
                                  </span>
                                </div>
                                <p className="text-amber-200/90 leading-relaxed text-xs">
                                  {err.message}
                                </p>
                              </div>
                            </div>
                            <div className="pt-2.5 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px]">
                              <span className="text-amber-300/90 leading-normal">
                                💡 <strong>100% Free Solution:</strong> Open this product in your browser and use our free <strong>Browser Extension</strong> to extract reviews from your authenticated session, or upload a CSV review file.
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setActiveWorkflowTab('csv')}
                                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-semibold transition-colors"
                                >
                                  Upload CSV Instead
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (err.type === 'delisted_product') {
                        return (
                          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <strong className="font-semibold text-amber-200">{err.title || 'Product Delisted or Discontinued'}</strong>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase font-mono font-bold">Catalog Notice</span>
                              </div>
                              <p className="text-slate-300 leading-relaxed">{err.message}</p>
                            </div>
                          </div>
                        );
                      }

                      if (err.type === 'no_reviews') {
                        return (
                          <div className="p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-xl text-xs text-blue-300 flex items-start gap-3">
                            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <strong className="font-semibold text-blue-200">{err.title || 'No Customer Reviews Found'}</strong>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase font-mono font-bold">0 Reviews</span>
                              </div>
                              <p className="text-slate-300 leading-relaxed">{err.message}</p>
                            </div>
                          </div>
                        );
                      }

                      if (err.type === 'server_error') {
                        return (
                          <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-start gap-3">
                            <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <strong className="font-semibold text-rose-200">{err.title || 'Backend Communication Error'}</strong>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase font-mono font-bold">Connection Issue</span>
                              </div>
                              <p className="text-slate-300 leading-relaxed">{err.message}</p>
                            </div>
                          </div>
                        );
                      }

                      // Default: invalid_url or general syntax
                      return (
                        <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-start gap-3">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <strong className="font-semibold text-rose-200">{err.title || 'Invalid Flipkart Link'}</strong>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase font-mono font-bold">URL Error</span>
                            </div>
                            <p className="text-slate-300 leading-relaxed">{err.message}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Success Banner */}
                    {flipkartSuccess && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <strong className="font-semibold text-emerald-200">Customer Reviews Retrieved Successfully</strong>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 uppercase font-mono font-bold">
                              {flipkartSuccess.count} Genuine Reviews
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{flipkartSuccess.message}</p>
                        </div>
                      </div>
                    )}

                    {/* Verified Product Card */}
                    {flipkartValidationResult && flipkartValidationResult.valid && (
                      <div className="space-y-4 pt-2">
                        <div className="bg-gradient-to-r from-blue-950/30 to-dark-card border border-blue-500/30 rounded-xl p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                              <ShieldCheck className="w-4 h-4" />
                              <span>Flipkart Product Verified</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {flipkartValidationResult.fsn && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono">
                                  FSN: {flipkartValidationResult.fsn}
                                </span>
                              )}
                              <a
                                href={flipkartValidationResult.cleanUrl || flipkartInputUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-medium"
                              >
                                <span>Open Flipkart Page</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-white">
                              {flipkartValidationResult.productName}
                            </h4>
                            <p className="text-[11px] text-dark-muted font-mono truncate mt-0.5">
                              {flipkartValidationResult.cleanUrl || flipkartInputUrl}
                            </p>
                          </div>

                          {/* Action Bar */}
                          <div className="pt-2 border-t border-dark-border flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-dark-muted">
                                Fetch Engine:
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                                Free Direct HTTPS (No Tokens Required)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDirectFlipkartAnalyze()}
                                disabled={analyzingFlipkart}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-900/30 transition-all"
                              >
                                {analyzingFlipkart ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Analyzing Reviews...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Analyze Reviews Directly</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={handleFetchFlipkartLiveReviews}
                                disabled={fetchingLiveReviews || analyzingFlipkart}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-card hover:bg-dark-surface border border-dark-border disabled:opacity-50 text-slate-300 text-xs font-semibold transition-all"
                                title="Fetch raw reviews and download as CSV"
                              >
                                {fetchingLiveReviews ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Fetching...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Fetch CSV Only</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Live Review Fetch Feedback Banner */}
                          {liveFetchResult && (
                            <div className="pt-2">
                              {liveFetchResult.success ? (
                                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 font-semibold text-emerald-300">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                      <span>{liveFetchResult.message}</span>
                                    </div>
                                    <button
                                      onClick={handleDownloadFetchedCsv}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-100 text-[11px] font-semibold transition-all"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Download Fetched CSV</span>
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-emerald-300/80">
                                    The fetched reviews have been loaded directly into the analysis pipeline. Review the preview below and click <strong>"Start Dual Sentiment Analysis"</strong>.
                                  </p>
                                </div>
                              ) : (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200 space-y-1.5">
                                  <div className="flex items-center gap-2 font-semibold text-rose-300">
                                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span>
                                      {liveFetchResult.tokenMissing
                                        ? "Scrape.do Token Required for Live Fetching"
                                        : "Flipkart Review Scraping Blocked / Failed"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    {liveFetchResult.error}
                                  </p>
                                  <p className="text-[11px] text-rose-300/80 font-medium">
                                    {liveFetchResult.tokenMissing
                                      ? "To enable automatic scraping, configure SCRAPEDO_TOKEN in server/.env. Otherwise, use our free CSV upload below."
                                      : "No fake reviews were generated. You can continue by uploading a customer review CSV below."}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Browser Extension Free Importer Card */}
                        <div className="p-4 bg-gradient-to-r from-purple-950/40 via-dark-surface to-dark-card border border-purple-500/30 rounded-xl space-y-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-purple-300 font-semibold">
                              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                              <span>Flipkart Review Exporter (100% Free Browser Extension)</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold">
                              Chrome & Edge MV3
                            </span>
                          </div>

                          <p className="text-slate-300 leading-relaxed text-[11px]">
                            Extract real customer reviews directly from any active Flipkart product page in your browser. Bypasses Akamai blocks legitimately because it runs within your authenticated user session with zero paid APIs or tokens.
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                            <div className="p-2.5 rounded-lg bg-dark-card/80 border border-dark-border">
                              <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                                <span className="w-4 h-4 rounded-full bg-brand-purple text-[10px] flex items-center justify-center text-white font-bold">1</span>
                                <span>Load Unpacked Extension</span>
                              </div>
                              <p className="text-dark-muted">Open <code className="text-slate-300">chrome://extensions</code> or <code className="text-slate-300">edge://extensions</code>, enable Developer Mode, and click <strong>Load unpacked</strong>.</p>
                            </div>

                            <div className="p-2.5 rounded-lg bg-dark-card/80 border border-dark-border">
                              <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                                <span className="w-4 h-4 rounded-full bg-brand-purple text-[10px] flex items-center justify-center text-white font-bold">2</span>
                                <span>Open Flipkart Product</span>
                              </div>
                              <p className="text-dark-muted">Open any Flipkart product or review page in your browser, then click the <strong>MediaSentiment Exporter</strong> icon.</p>
                            </div>

                            <div className="p-2.5 rounded-lg bg-dark-card/80 border border-dark-border">
                              <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                                <span className="w-4 h-4 rounded-full bg-brand-purple text-[10px] flex items-center justify-center text-white font-bold">3</span>
                                <span>Export & Upload CSV</span>
                              </div>
                              <p className="text-dark-muted">Click <strong>Download Reviews CSV</strong>, then drop the exported CSV file into the upload zone below for instant analysis.</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dark-border/80">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCopyExtensionPath}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-surface border border-dark-border text-slate-300 text-[11px] font-medium transition-all"
                                title="Copy path to browser-extension folder"
                              >
                                {copiedExtensionPath ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400 font-semibold">Folder Path Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy Extension Path</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => setShowExtensionGuide(!showExtensionGuide)}
                                className="text-[11px] text-purple-400 hover:text-purple-300 underline font-medium"
                              >
                                {showExtensionGuide ? 'Hide Setup Steps' : 'View Windows Setup Guide'}
                              </button>
                            </div>

                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Exported CSV</span>
                            </button>
                          </div>

                          {/* Expandable Windows Installation Guide */}
                          {showExtensionGuide && (
                            <div className="p-3.5 bg-dark-card rounded-lg border border-purple-500/20 text-[11px] text-slate-300 space-y-2 mt-2">
                              <strong className="text-white block font-semibold">Windows Setup Instructions (Chrome & Edge):</strong>
                              <ol className="list-decimal pl-4 space-y-1.5 text-dark-muted">
                                <li>Open <strong className="text-slate-200">Google Chrome</strong> or <strong className="text-slate-200">Microsoft Edge</strong> on this PC.</li>
                                <li>In the URL address bar, enter <code className="text-purple-300">chrome://extensions</code> (or <code className="text-purple-300">edge://extensions</code>).</li>
                                <li>Toggle ON <strong className="text-slate-200">Developer mode</strong> (top-right toggle switch in Chrome, left sidebar in Edge).</li>
                                <li>Click the <strong className="text-slate-200">Load unpacked</strong> button in the top-left toolbar.</li>
                                <li>Browse to and select the folder: <code className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-dark-border font-mono">C:\Users\User\Desktop\MediaSentiment\browser-extension</code>.</li>
                                <li>The <strong className="text-slate-200">MediaSentiment - Flipkart Review Exporter</strong> extension icon will appear in your extensions bar! Pin it for quick access.</li>
                              </ol>
                            </div>
                          )}
                        </div>

                        {/* 100% Free Architecture & Review Extraction Notice */}
                        <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                              <span>100% Free Review Intelligence — No Paid APIs or Proxies</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                              Completely Free
                            </span>
                          </div>

                          <p className="text-slate-300 leading-relaxed text-[11px]">
                            <strong>Why automated review scraping is not available for free:</strong> Flipkart does not provide an open public review API. Its pages load dynamically via private endpoints protected by Akamai Bot Manager and PerimeterX (returning HTTP 403 Forbidden to automated scripts). In accordance with platform integrity and ethical standards, MediaSentiment does not bypass CAPTCHAs, bot shields, or security controls.
                          </p>

                          <div className="p-3 bg-dark-card/70 rounded-lg border border-dark-border text-[11px] text-slate-300 space-y-1">
                            <span className="font-semibold text-white block">Choose your analysis method:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <div className="flex items-start gap-1.5 text-emerald-300">
                                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span><strong>Option 1 (Recommended):</strong> Upload your live reviews CSV exported from any tool (100% free).</span>
                              </div>
                              <div className="flex items-start gap-1.5 text-purple-300">
                                <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span><strong>Option 2:</strong> Explore immediately with our offline sample benchmark demo dataset.</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload Live Product CSV (Free)
                            </button>
                            <button
                              onClick={() => handleDownloadSampleCsv(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-card hover:bg-dark-surface border border-dark-border text-slate-300 text-xs font-medium transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download Free CSV Template
                            </button>
                            <button
                              onClick={handleLoadFlipkartSample}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-purple/20 hover:bg-brand-purple/30 border border-brand-purple/40 text-purple-300 text-xs font-semibold transition-all"
                            >
                              <Zap className="w-3.5 h-3.5 text-purple-400" />
                              Load Demo Dataset (Offline Test)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* MODE 2: DIRECT CSV UPLOAD MODE                           */}
                {/* -------------------------------------------------------- */}
                <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-purple" />
                      <h3 className="text-sm font-bold text-white">
                        {activeWorkflowTab === 'flipkart' ? 'Attach Reviews CSV (Required for Analysis)' : 'Upload Review Dataset'}
                      </h3>
                    </div>
                    <span className="text-[11px] text-dark-muted font-mono">
                      Supported: .csv
                    </span>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragging
                      ? 'border-brand-purple bg-brand-purple/10'
                      : csvFile
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-dark-border hover:border-slate-600 bg-dark-card/50'
                      }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="w-12 h-12 rounded-xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple mx-auto mb-3">
                      <Upload className="w-6 h-6" />
                    </div>

                    {csvFile ? (
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {csvFile.name}
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-0.5">
                          {dataSourceType === 'sample_demo' ? (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                              🟣 Sample / Demo Dataset (Offline Benchmark)
                            </span>
                          ) : (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                              🟢 Live User-Imported Dataset (CSV)
                            </span>
                          )}
                          <span className="text-xs text-dark-muted">
                            {(csvFile.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <p className="text-[11px] text-dark-muted mt-1">
                          Click or drop another file to replace
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-200">
                          Drag & drop your review CSV here, or <span className="text-brand-purple underline">browse</span>
                        </p>
                        <p className="text-xs text-dark-muted">
                          Supports columns: <code className="text-slate-300">review_text</code>, <code className="text-slate-300">rating</code>, <code className="text-slate-300">date</code>, <code className="text-slate-300">author</code>, <code className="text-slate-300">title</code> (fully matches our Flipkart Extension export format)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Pre-Validation Feedback */}
                  {validationResult && (
                    <div className="mt-4">
                      {validationResult.valid ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>CSV Validated Successfully</span>
                            </div>
                            <span className="text-xs font-mono text-emerald-300">
                              {validationResult.validCount} valid reviews found
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                            <div className="bg-dark-card/60 p-2 rounded-lg border border-dark-border">
                              <span className="text-dark-muted block">Review Text:</span>
                              <span className="text-emerald-400 font-medium font-mono">
                                {validationResult.columnsDetected.textColumn}
                              </span>
                            </div>
                            <div className="bg-dark-card/60 p-2 rounded-lg border border-dark-border">
                              <span className="text-dark-muted block">Rating Col:</span>
                              <span className="text-slate-300 font-medium font-mono">
                                {validationResult.columnsDetected.ratingColumn || 'None (Optional)'}
                              </span>
                            </div>
                            <div className="bg-dark-card/60 p-2 rounded-lg border border-dark-border">
                              <span className="text-dark-muted block">Date Col:</span>
                              <span className="text-slate-300 font-medium font-mono">
                                {validationResult.columnsDetected.dateColumn || 'None (Optional)'}
                              </span>
                            </div>
                            <div className="bg-dark-card/60 p-2 rounded-lg border border-dark-border">
                              <span className="text-dark-muted block">Author Col:</span>
                              <span className="text-slate-300 font-medium font-mono">
                                {validationResult.columnsDetected.authorColumn || 'Auto-numbered'}
                              </span>
                            </div>
                          </div>

                          {validationResult.skippedBlankCount > 0 && (
                            <p className="text-[11px] text-amber-400 flex items-center gap-1 pt-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Skipped {validationResult.skippedBlankCount} rows with empty review text.
                            </p>
                          )}

                          {/* Preview Toggle */}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => setShowPreviewRows(!showPreviewRows)}
                              className="text-xs text-brand-purple hover:underline flex items-center gap-1 font-medium"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {showPreviewRows ? 'Hide preview rows' : 'Preview first 3 parsed reviews'}
                            </button>

                            {showPreviewRows && (
                              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                                {validationResult.reviews.slice(0, 3).map((r, i) => (
                                  <div
                                    key={i}
                                    className="bg-dark-surface p-2.5 rounded-lg border border-dark-border text-xs text-slate-300"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-dark-muted mb-1">
                                      <span className="font-semibold text-slate-200">{r.author}</span>
                                      <div className="flex items-center gap-2">
                                        {r.rating && <span className="text-amber-400">{r.rating} ★</span>}
                                        {r.date && <span>{r.date}</span>}
                                      </div>
                                    </div>
                                    <p className="line-clamp-2 text-slate-300 italic">"{r.text}"</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-xs text-rose-300 space-y-2">
                          <div className="flex items-center gap-2 text-rose-400 font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>CSV Validation Error</span>
                          </div>
                          <p className="leading-relaxed">{validationResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col: Metadata, Scope, and Action */}
              <div className="space-y-4">
                <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-purple" />
                    Product Metadata
                  </h3>

                  {/* Product Name Input */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-muted mb-1.5">
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Boat Airdopes 131 / Sony Headphones"
                      className="w-full px-3.5 py-2.5 bg-dark-card border border-dark-border rounded-xl text-xs text-slate-100 placeholder-dark-muted focus:outline-none focus:border-brand-purple transition-colors"
                    />
                  </div>

                  {/* Reference Product URL */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-muted mb-1.5 flex items-center justify-between">
                      <span>Reference Product URL (Optional)</span>
                    </label>
                    <input
                      type="url"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder="e.g. Flipkart or Amazon product link"
                      className="w-full px-3.5 py-2.5 bg-dark-card border border-dark-border rounded-xl text-xs text-slate-100 placeholder-dark-muted focus:outline-none focus:border-brand-purple transition-colors"
                    />
                    <div className="mt-2 p-2.5 rounded-lg bg-dark-card/60 border border-dark-border text-[11px] text-dark-muted flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-brand-cyan shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong className="text-slate-300">Notice:</strong> Reference URL is stored for audit and report generation. Reviews are analyzed legitimately from your verified dataset.
                      </p>
                    </div>
                  </div>

                  {/* Gemini Batch Limit */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-muted mb-1.5">
                      Gemini AI Deep Batch Limit
                    </label>
                    <select
                      value={maxAnalyze}
                      onChange={(e) => setMaxAnalyze(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-dark-card border border-dark-border rounded-xl text-xs text-slate-100 focus:outline-none focus:border-brand-purple"
                    >
                      <option value={25}>25 reviews (Quick Context Scan)</option>
                      <option value={50}>50 reviews (Balanced Performance)</option>
                      <option value={100}>100 reviews (Standard Comprehensive)</option>
                      <option value={200}>200 reviews (Extensive Deep Audit)</option>
                    </select>
                    <p className="text-[10px] text-dark-muted mt-1">
                      VADER processes all reviews in the CSV; Gemini processes up to this limit.
                    </p>
                  </div>

                  {/* Error banner if any */}
                  {analysisError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{analysisError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleStartAnalysis}
                    disabled={analyzing || !validationResult?.valid}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Running Dual Sentiment Analysis...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Start Dual Sentiment Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: RESULTS DASHBOARD (When analysis is completed)       */}
        {/* ============================================================ */}
        {analysisData && (
          <div className="space-y-6">
            {/* Top Product Header Card */}
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-blue flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-900/30">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-brand-purple/20 border border-brand-purple/30 text-brand-purple text-[10px] font-semibold">
                      {analysisData.product?.url?.includes('flipkart') ? 'Flipkart Product Review Analysis' : 'Product Review Analysis'}
                    </span>
                    {(analysisData.isDemo || analysisData.product?.isDemo || analysisData.product?.dataSource === 'sample_demo' || analysisData.metrics?.isDemo) ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold flex items-center gap-1">
                        <Zap className="w-3 h-3 text-purple-400" />
                        Sample / Benchmark Dataset (Demo)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Live User-Imported Dataset (CSV)
                      </span>
                    )}
                    {analysisData.ratingStats?.averageRating > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {analysisData.ratingStats.averageRating} / 5.0 Average Rating
                      </span>
                    )}
                    <span className="text-[11px] text-dark-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(analysisData.analyzedAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>

                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                    {analysisData.product?.name || analysisData.video?.title || 'Product Review Analysis'}
                  </h1>

                  {analysisData.product?.url && (
                    <a
                      href={analysisData.product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-cyan hover:underline mt-1"
                    >
                      <span>View Reference Product Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingReport}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-purple hover:bg-purple-600 text-white text-xs font-semibold shadow-md shadow-purple-900/20 transition-all"
                >
                  {downloadingReport ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span>Download Report</span>
                </button>
                <button
                  onClick={handleResetAnalysis}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-surface border border-dark-border text-slate-300 text-xs font-semibold transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Analyze Another Product</span>
                </button>
              </div>
            </div>

            {/* Informative Dataset Status Banner */}
            {(analysisData.isDemo || analysisData.product?.isDemo || analysisData.product?.dataSource === 'sample_demo' || analysisData.metrics?.isDemo) ? (
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-purple-200">
                  <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white">Demonstration Benchmark Dataset Active</span>
                    <p className="text-purple-300/90 text-[11px] mt-0.5 leading-relaxed">
                      You are viewing offline sample product review data. Flipkart restricts automated live review scraping behind Akamai Bot Manager and does not provide a free review API. To evaluate authentic live reviews for this product for free, upload your exported CSV file.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleResetAnalysis}
                  className="px-3 py-1.5 rounded-xl bg-brand-purple hover:bg-purple-600 text-white text-xs font-semibold shrink-0 transition-all shadow-sm"
                >
                  Upload Live Reviews CSV
                </button>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong className="text-white">Live Customer Reviews Imported:</strong> Analyzed {metrics.totalAvailable || allReviews.length} authentic customer reviews from your uploaded CSV with dual VADER + Gemini AI.
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold shrink-0">
                  100% Free Analysis
                </span>
              </div>
            )}

            {/* Key Metrics Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Reviews Analyzed"
                value={metrics.totalAvailable || allReviews.length}
                subtitle={`VADER: ${metrics.totalVaderAnalyzed} | Gemini: ${metrics.totalGeminiAnalyzed}`}
                icon={MessageSquare}
                trend="neutral"
              />
              <StatCard
                title="Positive Sentiment"
                value={`${gemini.percentages?.positive ?? vader.percentages?.positive ?? 0}%`}
                subtitle={`${gemini.stats?.positive ?? vader.stats?.positive ?? 0} positive reviews`}
                icon={Smile}
                trend="up"
              />
              <StatCard
                title="Negative Sentiment"
                value={`${gemini.percentages?.negative ?? vader.percentages?.negative ?? 0}%`}
                subtitle={`${gemini.stats?.negative ?? vader.stats?.negative ?? 0} critical reviews`}
                icon={Frown}
                trend="down"
              />
              <StatCard
                title="Model Agreement Rate"
                value={`${metrics.agreementRate ?? comparison.agreementRate ?? 100}%`}
                subtitle={`${comparison.agreementCount || 0}/${comparison.totalCompared || 0} reviews agreed`}
                icon={Scale}
                trend="neutral"
              />
            </div>

            {/* Sub-Stat Row: Sarcasm, Emojis, Star Ratings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-dark-surface border border-dark-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-amber/10 border border-brand-amber/20 flex items-center justify-center text-brand-amber shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">
                    Contextual Sarcasm
                  </p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {sarcasm.sarcasticCount || 0}
                    <span className="text-xs text-dark-muted font-normal ml-1.5">
                      ({sarcasm.sarcasmRate || 0}% rate)
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-dark-surface border border-dark-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Smile className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">
                    Real Emojis Detected
                  </p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {emojis.totalEmojisDetected || 0}
                    <span className="text-xs text-dark-muted font-normal ml-1.5">
                      ({emojis.commentsWithEmojisCount || 0} reviews)
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-dark-surface border border-dark-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple shrink-0">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">
                    Customer Star Ratings
                  </p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {ratingStats.averageRating ? `${ratingStats.averageRating} ★` : 'No ratings in CSV'}
                    {ratingStats.totalRated > 0 && (
                      <span className="text-xs text-dark-muted font-normal ml-1.5">
                        ({ratingStats.totalRated} rated)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Charts Grid: Sentiment Pie + Rating Distribution / Keywords */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Sentiment Distribution with Model Toggle */}
              <div className="bg-dark-surface border border-dark-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Sentiment Distribution</h3>
                    <p className="text-xs text-dark-muted">
                      Comparing Lexical VADER and Generative Gemini AI
                    </p>
                  </div>

                  {/* Model Switcher */}
                  <div className="flex bg-dark-card border border-dark-border rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setActiveModelTab('gemini')}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${activeModelTab === 'gemini'
                        ? 'bg-brand-purple text-white shadow-sm'
                        : 'text-dark-muted hover:text-white'
                        }`}
                    >
                      Gemini AI
                    </button>
                    <button
                      onClick={() => setActiveModelTab('vader')}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${activeModelTab === 'vader'
                        ? 'bg-brand-purple text-white shadow-sm'
                        : 'text-dark-muted hover:text-white'
                        }`}
                    >
                      VADER
                    </button>
                  </div>
                </div>

                <SentimentPieChart
                  data={activeModelTab === 'gemini' ? (gemini.pieChartData || []) : (vader.pieChartData || [])}
                />
              </div>

              {/* Chart 2: Rating Distribution or Top Keywords */}
              <div className="bg-dark-surface border border-dark-border rounded-2xl p-6">
                {ratingStats.hasRatings ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-white">Star Rating Breakdown</h3>
                        <p className="text-xs text-dark-muted">
                          Customer rating distribution from verified dataset
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-amber-400">
                        Avg: {ratingStats.averageRating} / 5.0
                      </span>
                    </div>

                    <div className="space-y-3 pt-2">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingStats.distribution?.[star] || 0;
                        const pct = ratingStats.percentages?.[star] || 0;
                        return (
                          <div key={star} className="flex items-center gap-3 text-xs">
                            <span className="w-12 font-semibold text-slate-300 flex items-center gap-1">
                              {star} <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />
                            </span>
                            <div className="flex-1 h-3 bg-dark-card rounded-full overflow-hidden border border-dark-border">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-blue-500' : 'bg-rose-500'
                                  }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-16 text-right font-mono text-dark-muted">
                              {pct}% ({count})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Key Topics & Feedback</h3>
                    <p className="text-xs text-dark-muted mb-4">
                      Recurring product themes flagged by Gemini AI
                    </p>
                    <KeywordBarChart keywords={gemini.topKeywords || []} />
                  </div>
                )}
              </div>
            </div>

            {/* AI Executive Summary Card */}
            {gemini.summary && (
              <div className="bg-dark-surface border border-dark-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-brand-purple" />
                  <h3 className="text-sm font-bold text-white">AI Executive Perception Summary</h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic bg-dark-card/60 p-4 rounded-xl border border-dark-border">
                  "{gemini.summary}"
                </p>

                {/* Critical Issues / Feedback */}
                {Array.isArray(gemini.criticalFeedback) && gemini.criticalFeedback.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dark-border">
                    <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Key Customer Complaints & Friction Points
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {gemini.criticalFeedback.slice(0, 4).map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-dark-card p-2.5 rounded-lg border border-dark-border text-xs text-slate-300"
                        >
                          <span className="text-rose-400 font-semibold">• </span>
                          {typeof item === 'string' ? item : item.point || item.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Model Comparison / Agreement Rate Detail */}
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-brand-purple" />
                  <h3 className="text-sm font-bold text-white">Dual-Model Agreement Audit</h3>
                </div>
                <span className="text-xs font-mono text-brand-cyan">
                  Agreement Rate: {metrics.agreementRate || 100}%
                </span>
              </div>
              <p className="text-xs text-dark-muted mb-4">
                Note: Agreement rate indicates consistency between VADER's lexical dictionary and Gemini AI's contextual reasoning. It represents inter-model consensus, not ground-truth accuracy.
              </p>

              {comparison.sampleDisagreements && comparison.sampleDisagreements.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Sample Model Disagreements:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {comparison.sampleDisagreements.slice(0, 4).map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-dark-card p-3 rounded-xl border border-dark-border text-xs space-y-1.5"
                      >
                        <p className="italic text-slate-300 line-clamp-2">"{item.text}"</p>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-dark-border">
                          <span className="text-dark-muted">
                            VADER: <strong className={item.vaderSentiment === 'Positive' ? 'text-emerald-400' : item.vaderSentiment === 'Negative' ? 'text-rose-400' : 'text-blue-400'}>{item.vaderSentiment}</strong>
                          </span>
                          <span className="text-dark-muted">
                            Gemini: <strong className={item.geminiSentiment === 'Positive' ? 'text-emerald-400' : item.geminiSentiment === 'Negative' ? 'text-rose-400' : 'text-blue-400'}>{item.geminiSentiment}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filterable Reviews List */}
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Individual Reviews Audit</h3>
                    {(analysisData.isDemo || analysisData.product?.isDemo || analysisData.product?.dataSource === 'sample_demo' || analysisData.metrics?.isDemo) ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-semibold">
                        Sample / Benchmark Data (Demo)
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                        Live Imported Reviews (CSV)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-dark-muted mt-0.5">
                    Showing {filteredReviews.length} of {allReviews.length} reviews
                  </p>
                </div>

                {/* Search bar inside reviews */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reviews or author..."
                    className="w-full pl-8 pr-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-slate-100 placeholder-dark-muted focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-dark-border">
                {/* Sentiment filters */}
                <span className="text-[11px] font-semibold text-dark-muted uppercase mr-1">Sentiment:</span>
                {['ALL', 'Positive', 'Negative', 'Neutral'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterSentiment(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filterSentiment === st
                      ? 'bg-brand-purple text-white shadow-sm'
                      : 'bg-dark-card text-dark-muted hover:text-white border border-dark-border'
                      }`}
                  >
                    {st}
                  </button>
                ))}

                {/* Sarcasm toggle */}
                <span className="text-[11px] font-semibold text-dark-muted uppercase ml-2 mr-1">Sarcasm:</span>
                {['ALL', 'Sarcastic', 'Non-Sarcastic'].map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setFilterSarcasm(sc)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filterSarcasm === sc
                      ? 'bg-brand-amber text-black font-semibold'
                      : 'bg-dark-card text-dark-muted hover:text-white border border-dark-border'
                      }`}
                  >
                    {sc}
                  </button>
                ))}

                {/* Conflict Filter Toggle */}
                <button
                  onClick={() => setFilterConflictOnly(!filterConflictOnly)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ml-2 ${filterConflictOnly
                    ? 'bg-rose-500 text-white font-semibold'
                    : 'bg-dark-card text-dark-muted hover:text-white border border-dark-border'
                    }`}
                >
                  ⚡ Text-Emoji Conflict Only
                </button>
              </div>

              {/* Reviews Card Stream */}
              <div className="space-y-3 pt-2">
                {filteredReviews.length === 0 ? (
                  <div className="py-12 text-center text-xs text-dark-muted">
                    No reviews match the selected filter criteria.
                  </div>
                ) : (
                  filteredReviews.map((review, idx) => {
                    const sent = review.geminiSentiment || review.sentiment || 'Neutral';
                    const isSarcastic = review.sarcasm?.verdict === 'Sarcastic';
                    const hasConflict = review.emojiConflict?.hasConflict;

                    return (
                      <div
                        key={review.id || idx}
                        className="bg-dark-card/70 border border-dark-border hover:border-slate-700 rounded-xl p-4 transition-all duration-200 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {review.author || `Reviewer #${idx + 1}`}
                            </span>
                            {renderStars(review.rating)}
                            {review.date && (
                              <span className="text-[11px] text-dark-muted font-mono">
                                • {review.date}
                              </span>
                            )}
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Sentiment Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${sent === 'Positive'
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                : sent === 'Negative'
                                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                  : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                                }`}
                            >
                              {sent}
                            </span>

                            {/* VADER Compound */}
                            {review.vader?.compound !== undefined && (
                              <span className="px-1.5 py-0.5 rounded bg-dark-surface border border-dark-border text-[10px] font-mono text-dark-muted">
                                VADER: {review.vader.compound > 0 ? `+${review.vader.compound}` : review.vader.compound}
                              </span>
                            )}

                            {/* Sarcasm Badge */}
                            {isSarcastic && (
                              <span className="px-2 py-0.5 rounded-md bg-brand-amber/10 border border-brand-amber/20 text-brand-amber text-[10px] font-semibold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Sarcastic
                              </span>
                            )}

                            {/* Conflict Badge */}
                            {hasConflict && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-semibold">
                                ⚡ Text-Emoji Conflict
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Review text */}
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                          {review.text}
                        </p>

                        {/* Explanations & Emojis */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-dark-border/50 text-[11px] text-dark-muted">
                          <div className="flex items-center gap-2">
                            {review.geminiReason && (
                              <span className="italic text-slate-400">
                                AI: {review.geminiReason}
                              </span>
                            )}
                          </div>

                          {/* Extracted Emojis */}
                          {review.emojis && review.emojis.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-dark-muted text-[10px]">Emojis:</span>
                              {review.emojis.map((em, i) => (
                                <span
                                  key={i}
                                  className="text-xs"
                                  title={em.name ? `${em.name} (${em.sentiment})` : em.char}
                                >
                                  {em.char}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProductReviews;
