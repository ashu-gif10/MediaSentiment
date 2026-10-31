import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Sanitize text for standard PDF Helvetica font (avoids unicode surrogate / unprintable encoding crashes)
 */
const cleanText = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // strip surrogate emojis for text stream
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Format integer with commas
 */
const fmt = (num) => (typeof num === 'number' && !isNaN(num) ? num.toLocaleString() : '0');

/**
 * Generate sanitized filename
 */
export const getReportFilename = (videoTitle, date) => {
  const safeTitle = (videoTitle || 'YouTube_Analysis')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 35);
  const dateStr = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `MediaSentiment_${safeTitle}_${dateStr}.pdf`;
};

/**
 * Generate and download professional PDF Sentiment & Contextual Analysis Report
 * 
 * @param {Object} analysis - The full analysis object (either live response or full saved MongoDB record)
 * @returns {Promise<{ success: boolean, filename?: string, error?: string }>}
 */
export const generatePdfReport = async (analysis) => {
  try {
    if (!analysis) {
      throw new Error('No analysis data provided for report generation.');
    }

    const video = analysis.video || {};
    const metrics = analysis.metrics || {};
    const vader = analysis.vader || {};
    const gemini = analysis.gemini || {};
    const comparison = analysis.comparison || {};
    const sarcasm = analysis.sarcasmAnalytics || {};
    const emojis = analysis.emojiAnalytics || {};
    const comments = Array.isArray(analysis.comments) ? analysis.comments : [];
    const analyzedDate = analysis.analyzedAt || video.publishedAt || new Date().toISOString();

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    // Brand Colors
    const brandPurple = [99, 102, 241];
    const brandDark = [30, 41, 59];
    const textGray = [100, 116, 139];
    const lightBg = [248, 250, 252];
    const borderGray = [226, 232, 240];
    const colorPos = [16, 185, 129];
    const colorNeg = [244, 63, 94];
    const colorNeu = [59, 130, 246];

    let currentY = 14;

    // Helper to draw section header
    const drawSectionHeader = (title, badgeText = '') => {
      // Check if near bottom
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
      doc.text(title, margin, currentY);

      if (badgeText) {
        const titleWidth = doc.getTextWidth(title);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.text(`[${badgeText}]`, margin + titleWidth + 4, currentY);
      }

      currentY += 2;
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;
    };

    // ==========================================
    // 1. BRAND HEADER & METADATA BANNER
    // ==========================================
    doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');

    // Brand Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('MediaSentiment', margin + 6, currentY + 9);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(199, 210, 254);
    doc.text('AI YouTube Multi-Model Sentiment & Contextual Analysis Report', margin + 6, currentY + 16);

    // Generation timestamp (right aligned)
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const dateFormatted = new Date(analyzedDate).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(`Generated: ${dateFormatted}`, pageWidth - margin - 6, currentY + 9, { align: 'right' });
    doc.text(`Engine: ${metrics.engine === 'youtube_api' ? 'YouTube API v3' : 'Python Downloader'}`, pageWidth - margin - 6, currentY + 16, { align: 'right' });

    currentY += 28;

    // ==========================================
    // 2. VIDEO INFORMATION CARD
    // ==========================================
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(margin, currentY, contentWidth, 22, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    const rawTitle = cleanText(video.title) || `YouTube Video (${analysis.videoId || 'Unknown'})`;
    const truncatedTitle = doc.splitTextToSize(rawTitle, contentWidth - 12);
    doc.text(truncatedTitle[0] || rawTitle, margin + 4, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    const channelStr = cleanText(video.channelTitle) || 'YouTube Creator';
    const videoUrl = analysis.url || `https://youtu.be/${video.id || analysis.videoId || ''}`;
    doc.text(`Channel: ${channelStr}  |  Video URL: ${videoUrl}`, margin + 4, currentY + 12);
    doc.text(`Views: ${fmt(video.views)}  |  Likes: ${fmt(video.likes)}  |  Total Available Comments: ${fmt(video.commentCount || metrics.totalAvailable)}`, margin + 4, currentY + 17);

    currentY += 27;

    // ==========================================
    // 3. EXECUTIVE SUMMARY / KEY METRICS TABLE
    // ==========================================
    drawSectionHeader('1. Executive Analysis Overview', 'Key Metrics');

    const totalVader = metrics.totalVaderAnalyzed || vader.totalAnalyzed || 0;
    const totalGemini = metrics.totalGeminiAnalyzed || gemini.totalAnalyzed || 0;
    const agreeRate = typeof metrics.agreementRate === 'number' ? metrics.agreementRate : (comparison.agreementRate || 0);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Metric', 'Value', 'Description / Scope']],
      body: [
        ['Total Comments Fetched', fmt(metrics.totalFetched || comments.length), 'Top-level comments and replies extracted from YouTube'],
        ['VADER Lexical Analysis', `${fmt(totalVader)} comments`, 'Full rule-based sentiment classification across all fetched comments'],
        ['Gemini Contextual AI', `${fmt(totalGemini)} comments`, 'Deep context, emotion, and nuance analyzed in managed batches'],
        ['Model Agreement Rate', `${agreeRate}% (${fmt(comparison.agreementCount || 0)}/${fmt(comparison.totalCompared || totalGemini)})`, 'Alignment between VADER and Gemini (Agreement metric, not ground-truth accuracy)'],
        ['Contextual Sarcasm Detected', `${fmt(sarcasm.sarcasticCount || 0)} (${sarcasm.sarcasmRate || 0}%)`, 'Sarcasm identified through contextual irony reasoning by Gemini AI'],
        ['Real Emojis Detected', `${fmt(emojis.totalEmojisDetected || 0)} across ${fmt(emojis.commentsWithEmojisCount || 0)} comments`, 'Emojis extracted directly from user comment text with sentiment mappings'],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 40 },
        2: { cellWidth: contentWidth - 90 },
      },
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // ==========================================
    // 4. DUAL MODEL SENTIMENT COMPARISON
    // ==========================================
    drawSectionHeader('2. Dual Model Sentiment Distribution', 'VADER vs Gemini AI');

    const vStats = vader.stats || { positive: 0, negative: 0, neutral: 0 };
    const vPct = vader.percentages || { positive: 0, negative: 0, neutral: 0 };
    const gStats = gemini.stats || { positive: 0, negative: 0, neutral: 0 };
    const gPct = gemini.percentages || { positive: 0, negative: 0, neutral: 0 };

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Classification', 'VADER Count', 'VADER %', 'Gemini Count', 'Gemini %', 'Net Polarity Trend']],
      body: [
        [
          'Positive',
          fmt(vStats.positive),
          `${vPct.positive}%`,
          fmt(gStats.positive),
          `${gPct.positive}%`,
          gPct.positive >= vPct.positive ? 'Higher Positive in AI' : 'Lower Positive in AI',
        ],
        [
          'Negative',
          fmt(vStats.negative),
          `${vPct.negative}%`,
          fmt(gStats.negative),
          `${gPct.negative}%`,
          gPct.negative >= vPct.negative ? 'Higher Negative in AI' : 'Lower Negative in AI',
        ],
        [
          'Neutral',
          fmt(vStats.neutral),
          `${vPct.neutral}%`,
          fmt(gStats.neutral),
          `${gPct.neutral}%`,
          'Informative / Ambiguous comments',
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: brandDark,
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        halign: 'center',
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 35 },
        1: { cellWidth: 26 },
        2: { cellWidth: 24, fontStyle: 'bold', textColor: colorPos },
        3: { cellWidth: 26 },
        4: { cellWidth: 24, fontStyle: 'bold', textColor: colorPos },
        5: { halign: 'left', cellWidth: contentWidth - 135 },
      },
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // ==========================================
    // 5. CONTEXTUAL SARCASM & EMOJI ANALYTICS
    // ==========================================
    drawSectionHeader('3. Contextual Sarcasm & Emoji Intelligence', 'Advanced Nuances');

    const sarcasmRows = [
      ['Sarcastic Comments', fmt(sarcasm.sarcasticCount || 0), `${sarcasm.sarcasmRate || 0}%`, 'Statements using mock praise, irony, or satirical contrast.'],
      ['Non-Sarcastic Comments', fmt(sarcasm.nonSarcasticCount || 0), `${totalGemini > 0 ? Math.round(((sarcasm.nonSarcasticCount || 0) / totalGemini) * 100) : 0}%`, 'Direct commentary without detected irony or conflicting intent.'],
      ['Uncertain / Unanalyzed', fmt(sarcasm.uncertainCount || Math.max(0, totalVader - totalGemini)), 'N/A', 'Evaluated by VADER rule engine; requires contextual AI reasoning.'],
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Sarcasm Verdict', 'Count', '% of Analyzed', 'Contextual Interpretation']],
      body: sarcasmRows,
      theme: 'grid',
      headStyles: {
        fillColor: [217, 119, 6], // Amber-600
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: contentWidth - 100 },
      },
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // Emoji Analytics Summary Table (if emojis present)
    if (emojis && (emojis.totalEmojisDetected > 0 || (emojis.topEmojis && emojis.topEmojis.length > 0))) {
      const topEmojisList = Array.isArray(emojis.topEmojis) ? emojis.topEmojis.slice(0, 5) : [];
      const emojiRows = topEmojisList.map((e, idx) => [
        `#${idx + 1} ${cleanText(e.name) || 'Emoji'}`,
        fmt(e.count),
        e.sentiment || 'Neutral',
        `${emojis.totalEmojisDetected > 0 ? Math.round((e.count / emojis.totalEmojisDetected) * 100) : 0}%`,
      ]);

      if (emojiRows.length > 0) {
        autoTable(doc, {
          startY: currentY,
          margin: { left: margin, right: margin },
          head: [['Top Detected Emoji', 'Frequency', 'Assigned Polarity', '% of All Emojis']],
          body: emojiRows,
          theme: 'grid',
          headStyles: {
            fillColor: [16, 185, 129],
            textColor: 255,
            fontSize: 7.5,
            fontStyle: 'bold',
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 40, halign: 'center' },
            3: { cellWidth: contentWidth - 140, halign: 'center' },
          },
        });
        currentY = doc.lastAutoTable.finalY + 8;
      }
    }

    // ==========================================
    // 6. TOP KEYWORDS & AI SUMMARY
    // ==========================================
    if (gemini.summary || (gemini.topKeywords && gemini.topKeywords.length > 0)) {
      drawSectionHeader('4. Topics, Key Themes & AI Summary', 'Gemini AI Insights');

      if (gemini.summary) {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

        const summaryText = cleanText(gemini.summary);
        const splitSummary = doc.splitTextToSize(summaryText, contentWidth - 8);
        const boxHeight = Math.max(14, splitSummary.length * 4 + 6);

        // Check page overflow
        if (currentY + boxHeight > pageHeight - 25) {
          doc.addPage();
          currentY = 16;
        }

        doc.roundedRect(margin, currentY, contentWidth, boxHeight, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
        doc.text(splitSummary, margin + 4, currentY + 5);

        currentY += boxHeight + 6;
      }

      if (Array.isArray(gemini.topKeywords) && gemini.topKeywords.length > 0) {
        const keywordData = gemini.topKeywords.slice(0, 8).map((k) => [
          cleanText(k.keyword || k.name),
          fmt(k.count || 1),
        ]);

        autoTable(doc, {
          startY: currentY,
          margin: { left: margin, right: margin },
          head: [['Extracted Topic / Keyword', 'Mention Count']],
          body: keywordData,
          theme: 'grid',
          headStyles: {
            fillColor: [99, 102, 241],
            textColor: 255,
            fontSize: 7.5,
            fontStyle: 'bold',
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 100 },
            1: { cellWidth: contentWidth - 100, halign: 'center' },
          },
        });
        currentY = doc.lastAutoTable.finalY + 8;
      }
    }

    // ==========================================
    // 7. REPRESENTATIVE SAMPLE COMMENTS TABLE
    // ==========================================
    if (comments.length > 0) {
      drawSectionHeader('5. Representative Sample Comments', 'Audited Feedback');

      // Select diverse sample comments (sarcastic, positive, negative, conflicts)
      const sampleList = [];
      const sarcasticItems = comments.filter((c) => c.sarcasm?.verdict === 'Sarcastic');
      const conflictItems = comments.filter((c) => c.emojiConflict?.hasConflict);
      const regularItems = comments.filter((c) => !sampleList.includes(c));

      // Add up to 2 sarcastic, 2 conflicts, and 4 general comments (total max 8)
      sarcasticItems.slice(0, 2).forEach((c) => sampleList.push(c));
      conflictItems.slice(0, 2).forEach((c) => {
        if (!sampleList.some((s) => s.id === c.id)) sampleList.push(c);
      });
      regularItems.slice(0, 8 - sampleList.length).forEach((c) => {
        if (!sampleList.some((s) => s.id === c.id)) sampleList.push(c);
      });

      const commentRows = sampleList.map((c) => {
        const textSnippet = cleanText(c.text);
        const vSent = c.vader?.sentiment || c.vaderSentiment || 'Neutral';
        const gSent = c.geminiSentiment || c.sentiment || 'N/A';
        const sVerdict = c.sarcasm?.verdict || 'Uncertain';
        const sReason = cleanText(c.sarcasm?.explanation || c.geminiReason || '');
        const verdictWithReason = sReason ? `${sVerdict}: ${sReason.slice(0, 70)}...` : sVerdict;

        return [
          cleanText(c.author) || 'User',
          textSnippet,
          vSent,
          gSent,
          verdictWithReason,
        ];
      });

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['Author', 'Comment Text', 'VADER', 'Gemini', 'Sarcasm Verdict & Explanation']],
        body: commentRows,
        theme: 'grid',
        headStyles: {
          fillColor: brandDark,
          textColor: 255,
          fontSize: 7.5,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 65 },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: contentWidth - 129 },
        },
      });

      currentY = doc.lastAutoTable.finalY + 8;
    }

    // ==========================================
    // 8. METHODOLOGY NOTES & LIMITATIONS
    // ==========================================
    drawSectionHeader('6. Methodology, Notes & Limitations', 'Technical Standards');

    const notes = [
      '1. Scope & Execution: VADER processes all fetched comments using lexical rules and emoji valence dictionaries. Gemini AI processes sampled batches to deliver high-level contextual sentiment, thematic topics, and sarcasm verdicts.',
      '2. Model Agreement vs Accuracy: The reported agreement rate measures classification consensus between VADER and Gemini AI. It does NOT represent human ground-truth accuracy.',
      '3. Sarcasm vs Conflict Distinction: Text-emoji polarity mismatches are tracked separately as emotional conflict divergence; contextual sarcasm detection is evaluated independently via generative language reasoning.',
      '4. API & Sampling Boundaries: In accordance with API rate bounds, comments beyond the Gemini batch limit reflect VADER rule scores and are designated as Uncertain for sarcasm.',
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      body: notes.map((n) => [n]),
      theme: 'plain',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [100, 116, 139],
      },
    });

    // ==========================================
    // 9. FOOTERS WITH PAGE NUMBERING
    // ==========================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);

      // Top line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      // Bottom footer text
      doc.text('MediaSentiment — Advanced Multi-Model Video Intelligence', margin, pageHeight - 6);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    const filename = getReportFilename(video.title, analyzedDate);
    
    // In browser, trigger client-side download
    if (typeof window !== 'undefined' && typeof doc.save === 'function') {
      doc.save(filename);
    }

    return {
      success: true,
      filename,
      totalPages,
      arrayBuffer: doc.output('arraybuffer'),
    };
  } catch (error) {
    console.error('[reportGenerator] Error generating PDF report:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate PDF report.',
    };
  }
};
