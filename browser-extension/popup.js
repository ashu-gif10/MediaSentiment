/**
 * MediaSentiment - Popup Controller
 * Coordinates with the active tab and triggers extraction/download.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge');
  const productNameEl = document.getElementById('productName');
  const reviewCountEl = document.getElementById('reviewCount');
  const messageArea = document.getElementById('messageArea');
  const btnExpand = document.getElementById('btnExpand');
  const btnExport = document.getElementById('btnExport');
  const btnOpenApp = document.getElementById('btnOpenApp');

  let currentTab = null;
  let cachedExtraction = null;

  function showMessage(text, type = 'info') {
    messageArea.textContent = text;
    messageArea.className = `msg-area ${type}`;
  }

  // 1. Get active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      statusBadge.textContent = 'No Active Tab';
      productNameEl.textContent = 'Could not access browser tab.';
      return;
    }
    currentTab = tabs[0];
  } catch (err) {
    statusBadge.textContent = 'Error';
    showMessage('Tab access error: ' + err.message, 'error');
    return;
  }

  // 2. Validate URL
  const url = currentTab.url || '';
  if (!url.includes('flipkart.com')) {
    statusBadge.textContent = 'Not on Flipkart';
    statusBadge.className = 'status-badge warning';
    productNameEl.textContent = 'Please navigate to a Flipkart product or review page.';
    showMessage('Flipkart tab not detected.', 'error');
    btnExport.disabled = true;
    btnExpand.disabled = true;
    return;
  }

  // 3. Inject extractor and inspect page reviews
  statusBadge.textContent = 'Analyzing Page...';
  statusBadge.className = 'status-badge active';
  productNameEl.textContent = 'Scanning visible customer reviews...';

  try {
    // Inject extractor.js into active tab
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['extractor.js']
    });

    // Run extraction
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        if (typeof extractReviewsFromDom === 'function') {
          return extractReviewsFromDom();
        }
        return { success: false, totalExtracted: 0, reviews: [] };
      }
    });

    cachedExtraction = result.result;

    if (cachedExtraction && cachedExtraction.totalExtracted > 0) {
      statusBadge.textContent = 'Reviews Detected';
      statusBadge.className = 'status-badge active';
      productNameEl.textContent = cachedExtraction.productName || 'Flipkart Product';
      reviewCountEl.textContent = cachedExtraction.totalExtracted;
      btnExpand.disabled = false;
      btnExport.disabled = false;
      showMessage(`${cachedExtraction.totalExtracted} reviews ready for export`, 'success');
    } else {
      statusBadge.textContent = '0 Reviews Visible';
      statusBadge.className = 'status-badge warning';
      productNameEl.textContent = cachedExtraction?.productName || 'Flipkart Product';
      reviewCountEl.textContent = '0';
      btnExpand.disabled = false;
      btnExport.disabled = true;
      showMessage('No reviews found in currently loaded view. Scroll down or open reviews section.', 'info');
    }
  } catch (err) {
    statusBadge.textContent = 'Scan Error';
    statusBadge.className = 'status-badge warning';
    showMessage('Could not read page: ' + err.message, 'error');
  }

  // 4. Handle Expand "Read More"
  btnExpand.addEventListener('click', async () => {
    btnExpand.disabled = true;
    showMessage('Expanding truncated reviews...', 'info');

    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          if (typeof expandReadMoreReviews === 'function') {
            return expandReadMoreReviews();
          }
          return 0;
        }
      });

      const count = res.result || 0;
      // Brief delay for DOM to settle
      await new Promise((r) => setTimeout(r, 400));

      // Re-extract reviews
      const [newRes] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => extractReviewsFromDom()
      });

      cachedExtraction = newRes.result;
      if (cachedExtraction && cachedExtraction.totalExtracted > 0) {
        reviewCountEl.textContent = cachedExtraction.totalExtracted;
        btnExport.disabled = false;
        showMessage(`Expanded ${count} reviews! Ready to download.`, 'success');
      } else {
        showMessage(`Expanded ${count} elements.`, 'info');
      }
    } catch (err) {
      showMessage('Expand error: ' + err.message, 'error');
    } finally {
      btnExpand.disabled = false;
    }
  });

  // 5. Handle Export CSV
  btnExport.addEventListener('click', async () => {
    if (!cachedExtraction || cachedExtraction.totalExtracted === 0) {
      showMessage('No reviews available to export.', 'error');
      return;
    }

    btnExport.disabled = true;
    showMessage('Generating RFC-4180 CSV...', 'info');

    try {
      const [csvRes] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          const res = extractReviewsFromDom();
          return {
            csv: generateReviewsCsv(res.reviews),
            productName: res.productName,
            count: res.totalExtracted
          };
        }
      });

      const { csv, productName, count } = csvRes.result;

      if (!csv || count === 0) {
        showMessage('No review text found to export.', 'error');
        return;
      }

      // Create downloadable blob
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);

      const safeName = (productName || 'flipkart-reviews')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);

      const filename = `${safeName || 'flipkart-reviews'}-${Date.now()}.csv`;

      // Trigger download
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = blobUrl;
      downloadAnchor.download = filename;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(blobUrl);

      showMessage(`Downloaded ${count} reviews! Ready to upload to MediaSentiment.`, 'success');
    } catch (err) {
      showMessage('Export failed: ' + err.message, 'error');
    } finally {
      btnExport.disabled = false;
    }
  });

  // 6. Handle Open MediaSentiment
  btnOpenApp.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173/product-reviews' });
  });
});

