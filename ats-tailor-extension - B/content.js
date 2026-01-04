// content.js - AUTO-TAILOR + ATTACH v1.5.0 ULTRA BLAZING
// Automatically triggers tailoring on ATS pages, then attaches files
// 50% FASTER for LazyApply integration

(function() {
  'use strict';

  console.log('[ATS Tailor] AUTO-TAILOR v1.5.0 ULTRA BLAZING loaded on:', window.location.hostname);

  // ============ CONFIGURATION ============
  const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';
  
  // ============ RETRY CONFIGURATION (ULTRA ROBUST - Fixes ALL fetch errors) ============
  const RETRY_CONFIG = {
    maxRetries: 8,           // Maximum retries for bulletproof reliability
    baseDelayMs: 800,        // Start with shorter delay, grow exponentially
    maxDelayMs: 20000,       // Allow longer waits for cold starts
    retryableStatuses: [0, 408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526],
    retryOnNetworkError: true,
    retryOnTimeout: true,
  };

  /**
   * ULTRA-ROBUST fetch with exponential backoff - NEVER fails on transient errors
   * Handles: Network errors, timeouts, 5xx, cold starts, connection resets
   */
  async function fetchWithRetry(url, options = {}, retries = RETRY_CONFIG.maxRetries) {
    const endpoint = url.split('/').pop()?.split('?')[0] || 'unknown';
    const attemptNum = RETRY_CONFIG.maxRetries - retries + 1;
    
    // Calculate delay with jitter to avoid thundering herd
    const getDelay = () => {
      const base = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(1.8, RETRY_CONFIG.maxRetries - retries),
        RETRY_CONFIG.maxDelayMs
      );
      // Add 10-30% jitter
      return base + (base * (0.1 + Math.random() * 0.2));
    };
    
    try {
      console.log(`[ATS Tailor] Fetching ${endpoint}... (attempt ${attemptNum}/${RETRY_CONFIG.maxRetries + 1})`);
      
      // Progressive timeout: start aggressive, increase on retries
      const timeoutMs = Math.min(15000 + (attemptNum * 5000), 60000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      let response;
      try {
        response = await fetch(url, { 
          ...options, 
          signal: controller.signal,
          // Keep connection alive
          keepalive: true,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
      
      clearTimeout(timeoutId);
      
      // Check for retryable HTTP status codes
      if (RETRY_CONFIG.retryableStatuses.includes(response.status) && retries > 0) {
        const delay = getDelay();
        const delaySec = Math.round(delay / 1000);
        console.warn(`[ATS Tailor] ${endpoint} returned ${response.status}, retrying in ${delaySec}s (${retries} left)`);
        updateBanner(`⏳ Server busy (${response.status}), retrying in ${delaySec}s...`, 'working');
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1);
      }
      
      // Handle empty responses (edge function cold start issue)
      if (response.status === 200) {
        const contentLength = response.headers.get('content-length');
        if (contentLength === '0' && retries > 0) {
          const delay = getDelay();
          console.warn(`[ATS Tailor] ${endpoint} returned empty response, retrying...`);
          updateBanner(`⏳ Empty response, retrying...`, 'working');
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(url, options, retries - 1);
        }
      }
      
      return response;
    } catch (error) {
      // Comprehensive retry on ALL transient errors
      const errorMsg = error.message?.toLowerCase() || '';
      const errorName = error.name || '';
      
      const isNetworkError = 
        errorName === 'TypeError' || 
        errorName === 'AbortError' ||
        errorName === 'NetworkError' ||
        errorMsg.includes('fetch') ||
        errorMsg.includes('network') ||
        errorMsg.includes('failed to fetch') ||
        errorMsg.includes('connection') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('abort') ||
        errorMsg.includes('econnreset') ||
        errorMsg.includes('enotfound') ||
        errorMsg.includes('dns') ||
        errorMsg.includes('socket');
      
      if (isNetworkError && retries > 0) {
        const delay = getDelay();
        const delaySec = Math.round(delay / 1000);
        console.warn(`[ATS Tailor] ⚠️ ${errorName} for ${endpoint}: "${error.message}", retrying in ${delaySec}s (${retries} left)`);
        updateBanner(`⚠️ Network issue, retrying in ${delaySec}s...`, 'working');
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1);
      }
      
      // Final failure - log detailed info
      console.error(`[ATS Tailor] ❌ FINAL FAILURE for ${endpoint} after ${RETRY_CONFIG.maxRetries + 1} attempts:`, error);
      throw new Error(`Failed to fetch ${endpoint}: ${error.message} (after ${RETRY_CONFIG.maxRetries + 1} attempts)`);
    }
  }
  
  const SUPPORTED_HOSTS = [
    'greenhouse.io', 'job-boards.greenhouse.io', 'boards.greenhouse.io',
    'workday.com', 'myworkdayjobs.com', 'smartrecruiters.com',
    'bullhornstaffing.com', 'bullhorn.com', 'teamtailor.com',
    'workable.com', 'apply.workable.com', 'icims.com',
    'oracle.com', 'oraclecloud.com', 'taleo.net'
  ];

  const isSupportedHost = (hostname) =>
    SUPPORTED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));

  if (!isSupportedHost(window.location.hostname)) {
    console.log('[ATS Tailor] Not a supported ATS host, skipping');
    return;
  }

  console.log('[ATS Tailor] Supported ATS detected - AUTO-TAILOR MODE ACTIVE!');

  // ============ STATE ============
  let filesLoaded = false;
  let cvFile = null;
  let coverFile = null;
  let coverLetterText = '';
  let hasTriggeredTailor = false;
  let tailoringInProgress = false;
  let defaultLocation = 'Dublin, IE'; // User configurable default location for Remote jobs
  const startTime = Date.now();
  const currentJobUrl = window.location.href;
  
  // Load default location from storage
  chrome.storage.local.get(['ats_defaultLocation'], (result) => {
    if (result.ats_defaultLocation) {
      defaultLocation = result.ats_defaultLocation;
      console.log('[ATS Tailor] Loaded default location:', defaultLocation);
    }
  });
  
  // Listen for default location updates from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'UPDATE_DEFAULT_LOCATION' && message.defaultLocation) {
      defaultLocation = message.defaultLocation;
      console.log('[ATS Tailor] Updated default location to:', defaultLocation);
      sendResponse({ status: 'updated' });
      return true;
    }
  });

  // ============ STATUS BANNER WITH PROGRESS STEPS ============
  let currentStep = 0; // 0=detecting, 1=tailoring, 2=attaching, 3=done
  
  function createStatusBanner() {
    if (document.getElementById('ats-auto-banner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'ats-auto-banner';
    banner.innerHTML = `
      <style>
        #ats-auto-banner {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 999999 !important;
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%) !important;
          padding: 10px 20px !important;
          font: bold 13px system-ui, sans-serif !important;
          color: #000 !important;
          text-align: center !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 16px !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        #ats-auto-banner .ats-logo { font-size: 16px; font-weight: 800; }
        #ats-auto-banner .ats-steps {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0,0,0,0.1);
          padding: 6px 12px;
          border-radius: 20px;
        }
        #ats-auto-banner .ats-step {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          opacity: 0.5;
          transition: all 0.3s ease;
        }
        #ats-auto-banner .ats-step.active {
          opacity: 1;
          background: rgba(255,255,255,0.3);
          animation: ats-step-pulse 1s ease-in-out infinite;
        }
        #ats-auto-banner .ats-step.done {
          opacity: 1;
          background: rgba(0,200,100,0.4);
        }
        #ats-auto-banner .ats-step-icon {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
        #ats-auto-banner .ats-step.done .ats-step-icon {
          background: rgba(0,200,100,0.6);
        }
        #ats-auto-banner .ats-step.active .ats-step-icon {
          animation: ats-icon-spin 1s linear infinite;
        }
        #ats-auto-banner .ats-step-divider {
          width: 16px;
          height: 2px;
          background: rgba(0,0,0,0.2);
          border-radius: 1px;
        }
        #ats-auto-banner .ats-step.done + .ats-step-divider {
          background: rgba(0,200,100,0.5);
        }
        @keyframes ats-step-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes ats-icon-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        #ats-auto-banner .ats-status {
          font-size: 12px;
          max-width: 300px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #ats-auto-banner.success { background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%) !important; }
        #ats-auto-banner.error { background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%) !important; color: #fff !important; }
      </style>
      <span class="ats-logo">🚀 ATS TAILOR</span>
      <div class="ats-steps">
        <div class="ats-step active" data-step="0">
          <span class="ats-step-icon">⟳</span>
          <span>Detect</span>
        </div>
        <div class="ats-step-divider"></div>
        <div class="ats-step" data-step="1">
          <span class="ats-step-icon">✎</span>
          <span>Tailor</span>
        </div>
        <div class="ats-step-divider"></div>
        <div class="ats-step" data-step="2">
          <span class="ats-step-icon">📎</span>
          <span>Attach</span>
        </div>
        </div>
        <span class="ats-status" id="ats-banner-status">⚡Tailoring... ~5s</span>
        <span class="ats-countdown" id="ats-countdown" style="font-weight: 700; color: #fff; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 12px; font-size: 12px;">5s</span>
      `;
    document.body.appendChild(banner);
    document.body.classList.add('ats-banner-active');
    
    // Start countdown timer
    startBannerCountdown();
  }
  
  // ============ COUNTDOWN TIMER ============
  let bannerCountdownInterval = null;
  let bannerCountdownSeconds = 5;
  
  function startBannerCountdown() {
    bannerCountdownSeconds = 5;
    if (bannerCountdownInterval) clearInterval(bannerCountdownInterval);
    
    const countdownEl = document.getElementById('ats-countdown');
    if (countdownEl) countdownEl.textContent = '5s';
    
    bannerCountdownInterval = setInterval(() => {
      bannerCountdownSeconds = Math.max(0, bannerCountdownSeconds - 1);
      const countdownEl = document.getElementById('ats-countdown');
      if (countdownEl) {
        if (bannerCountdownSeconds > 0) {
          countdownEl.textContent = `${bannerCountdownSeconds}s`;
        } else {
          countdownEl.textContent = '⏳';
        }
      }
    }, 1000);
  }
  
  function stopBannerCountdown() {
    if (bannerCountdownInterval) {
      clearInterval(bannerCountdownInterval);
      bannerCountdownInterval = null;
    }
    const countdownEl = document.getElementById('ats-countdown');
    if (countdownEl) countdownEl.textContent = '✅';
  }

  function updateBannerStep(step) {
    currentStep = step;
    const steps = document.querySelectorAll('#ats-auto-banner .ats-step');
    steps.forEach((el, idx) => {
      el.classList.remove('active', 'done');
      if (idx < step) {
        el.classList.add('done');
        el.querySelector('.ats-step-icon').textContent = '✓';
      } else if (idx === step) {
        el.classList.add('active');
      }
    });
  }

  function updateBanner(status, type = 'working') {
    const banner = document.getElementById('ats-auto-banner');
    const statusEl = document.getElementById('ats-banner-status');
    if (banner) {
      banner.className = type === 'success' ? 'success' : type === 'error' ? 'error' : '';
    }
    if (statusEl) statusEl.textContent = status;
    
    // Update countdown based on status
    const countdownEl = document.getElementById('ats-countdown');
    if (type === 'success' && countdownEl) {
      stopBannerCountdown();
      countdownEl.textContent = '✅';
      countdownEl.style.background = 'rgba(0,200,100,0.4)';
    } else if (type === 'error' && countdownEl) {
      stopBannerCountdown();
      countdownEl.textContent = '❌';
      countdownEl.style.background = 'rgba(255,0,0,0.3)';
    }
    
    // Auto-detect step from status message
    if (status.toLowerCase().includes('detect')) updateBannerStep(0);
    else if (status.toLowerCase().includes('tailor') || status.toLowerCase().includes('generat')) updateBannerStep(1);
    else if (status.toLowerCase().includes('attach') || status.toLowerCase().includes('load')) updateBannerStep(2);
    else if (type === 'success') updateBannerStep(3);
  }

  function hideBanner() {
    // Keep the banner visible permanently - don't remove it
    // The orange ribbon should always stay visible on ATS platforms
    console.log('[ATS Tailor] Banner will remain visible');
  }

  // ============ PDF FILE CREATION ============
  function createPDFFile(base64, name) {
    try {
      if (!base64) return null;
      
      let data = base64;
      if (base64.includes(',')) {
        data = base64.split(',')[1];
      }
      
      const byteString = atob(data);
      const buffer = new ArrayBuffer(byteString.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < byteString.length; i++) {
        view[i] = byteString.charCodeAt(i);
      }
      
      const file = new File([buffer], name, { type: 'application/pdf' });
      console.log(`[ATS Tailor] Created PDF: ${name} (${file.size} bytes)`);
      return file;
    } catch (e) {
      console.error('[ATS Tailor] PDF creation failed:', e);
      return null;
    }
  }

  // ============ LOCATION SANITIZATION (HARD RULE: NEVER "REMOTE" ON CV) ============
  // User rule: "Remote" should NEVER appear in CV location. "Dublin, IE | Remote" -> "Dublin, IE"
  // This is a recruiter red flag and must be stripped from ALL CVs, even if it exists
  // in the stored profile or uploaded base CV.
  function stripRemoteFromLocation(raw) {
    const s = (raw || '').toString().trim();
    if (!s) return '';

    // If location is ONLY "Remote" or "Remote, <country>", return empty for fallback
    if (/^remote$/i.test(s) || /^remote\s*[\(,\\-]\s*\w+\)?$/i.test(s)) {
      return '';
    }

    // Remove any "remote" token and common separators around it
    let out = s
      .replace(/\b(remote|work\s*from\s*home|wfh|virtual|fully\s*remote|remote\s*first|remote\s*friendly)\b/gi, '')
      .replace(/\s*[\(\[]?\s*(remote|wfh|virtual)\s*[\)\]]?\s*/gi, '')
      .replace(/\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*/g, ' | ')
      .replace(/\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*$/g, '')
      .replace(/^\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // If it becomes empty after stripping, return empty (caller can fallback to default)
    return out;
  }

  // Export globally for PDF generators
  window.stripRemoteFromLocation = stripRemoteFromLocation;

  // ============ FIELD DETECTION ============
  function isCVField(input) {
    const text = (
      (input.labels?.[0]?.textContent || '') +
      (input.name || '') +
      (input.id || '') +
      (input.getAttribute('aria-label') || '') +
      (input.getAttribute('data-qa') || '') +
      (input.closest('label')?.textContent || '')
    ).toLowerCase();
    
    let parent = input.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const parentText = (parent.textContent || '').toLowerCase().substring(0, 200);
      if ((parentText.includes('resume') || parentText.includes('cv')) && !parentText.includes('cover')) {
        return true;
      }
      parent = parent.parentElement;
    }
    
    return /(resume|cv|curriculum)/i.test(text) && !/cover/i.test(text);
  }

  function isCoverField(input) {
    const text = (
      (input.labels?.[0]?.textContent || '') +
      (input.name || '') +
      (input.id || '') +
      (input.getAttribute('aria-label') || '') +
      (input.getAttribute('data-qa') || '') +
      (input.closest('label')?.textContent || '')
    ).toLowerCase();
    
    let parent = input.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const parentText = (parent.textContent || '').toLowerCase().substring(0, 200);
      if (parentText.includes('cover')) {
        return true;
      }
      parent = parent.parentElement;
    }
    
    return /cover/i.test(text);
  }

  function hasUploadFields() {
    // Check for file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) return true;
    
    // Check for Greenhouse-style upload buttons
    const greenhouseUploads = document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]');
    if (greenhouseUploads.length > 0) return true;
    
    // Check for Workable autofill text
    if (document.body.textContent.includes('Autofill application')) return true;
    
    // Check for Resume/CV labels with buttons
    const labels = document.querySelectorAll('label, h3, h4, span');
    for (const label of labels) {
      const text = label.textContent?.toLowerCase() || '';
      if ((text.includes('resume') || text.includes('cv')) && text.length < 50) {
        return true;
      }
    }
    
    return false;
  }

  // ============ FIRE EVENTS ============
  function fireEvents(input) {
    ['change', 'input'].forEach(type => {
      input.dispatchEvent(new Event(type, { bubbles: true }));
    });
  }

  // ============ KILL X BUTTONS (scoped) ============
  function killXButtons() {
    // IMPORTANT: do NOT click generic "remove" buttons globally.
    // Only click remove/clear controls that are near file inputs / upload widgets.
    const isNearFileInput = (el) => {
      const root = el.closest('form') || document.body;
      const candidates = [
        el.closest('[data-qa-upload]'),
        el.closest('[data-qa="upload"]'),
        el.closest('[data-qa="attach"]'),
        el.closest('.field'),
        el.closest('[class*="upload" i]'),
        el.closest('[class*="attachment" i]'),
      ].filter(Boolean);

      for (const c of candidates) {
        if (c.querySelector('input[type="file"]')) return true;
        const t = (c.textContent || '').toLowerCase();
        if (t.includes('resume') || t.includes('cv') || t.includes('cover')) return true;
      }

      // fallback: within same form, are there any file inputs at all?
      return !!root.querySelector('input[type="file"]');
    };

    const selectors = [
      'button[aria-label*="remove" i]',
      'button[aria-label*="delete" i]',
      'button[aria-label*="clear" i]',
      '.remove-file',
      '[data-qa-remove]',
      '[data-qa*="remove"]',
      '[data-qa*="delete"]',
      '.file-preview button',
      '.file-upload-remove',
      '.attachment-remove',
    ];

    document.querySelectorAll(selectors.join(', ')).forEach((btn) => {
      try {
        if (!isNearFileInput(btn)) return;
        btn.click();
      } catch {}
    });

    document.querySelectorAll('button, [role="button"]').forEach((btn) => {
      const text = btn.textContent?.trim();
      if (text === '×' || text === 'x' || text === 'X' || text === '✕') {
        try {
          if (!isNearFileInput(btn)) return;
          btn.click();
        } catch {}
      }
    });
  }

  // ============ FORCE CV REPLACE ============
  function forceCVReplace() {
    if (!cvFile) return false;
    let attached = false;

    document.querySelectorAll('input[type="file"]').forEach((input) => {
      if (!isCVField(input)) return;

      // If already attached, do nothing (prevents flicker)
      if (input.files && input.files.length > 0) {
        attached = true;
        return;
      }

      const dt = new DataTransfer();
      dt.items.add(cvFile);
      input.files = dt.files;
      fireEvents(input);
      attached = true;
      console.log('[ATS Tailor] CV attached!');
    });

    return attached;
  }

  // ============ FORCE COVER REPLACE ============
  function forceCoverReplace() {
    if (!coverFile && !coverLetterText) return false;
    let attached = false;

    if (coverFile) {
      document.querySelectorAll('input[type="file"]').forEach((input) => {
        if (!isCoverField(input)) return;

        // If already attached, do nothing (prevents flicker)
        if (input.files && input.files.length > 0) {
          attached = true;
          return;
        }

        const dt = new DataTransfer();
        dt.items.add(coverFile);
        input.files = dt.files;
        fireEvents(input);
        attached = true;
        console.log('[ATS Tailor] Cover Letter attached!');
      });
    }

    if (coverLetterText) {
      document.querySelectorAll('textarea').forEach((textarea) => {
        const label = textarea.labels?.[0]?.textContent || textarea.name || textarea.id || '';
        if (/cover/i.test(label)) {
          if ((textarea.value || '').trim() === coverLetterText.trim()) {
            attached = true;
            return;
          }
          textarea.value = coverLetterText;
          fireEvents(textarea);
          attached = true;
        }
      });
    }

    return attached;
  }

  // ============ GREENHOUSE COVER LETTER: CLICK "ATTACH" TO REVEAL INPUT ============
  function clickGreenhouseCoverAttach() {
    const nodes = document.querySelectorAll('label, h1, h2, h3, h4, h5, span, div, fieldset');
    for (const node of nodes) {
      const t = (node.textContent || '').trim().toLowerCase();
      if (!t || t.length > 60) continue;
      if (!t.includes('cover letter')) continue;

      const container = node.closest('fieldset') || node.closest('.field') || node.closest('section') || node.parentElement;
      if (!container) continue;

      // If a visible file input already exists in this section, no need to click.
      const existing = container.querySelector('input[type="file"]');
      if (existing && existing.offsetParent !== null) return true;

      const buttons = container.querySelectorAll('button, a[role="button"], [role="button"]');
      for (const btn of buttons) {
        const bt = (btn.textContent || '').trim().toLowerCase();
        if (bt === 'attach' || bt.includes('attach')) {
          try {
            btn.click();
            return true;
          } catch {}
        }
      }
    }
    return false;
  }

  // ============ FORCE EVERYTHING ============
  function forceEverything() {
    // STEP 1: Greenhouse specific - click attach buttons to reveal hidden inputs
    document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]').forEach(btn => {
      const parent = btn.closest('.field') || btn.closest('[class*="upload"]') || btn.parentElement;
      const existingInput = parent?.querySelector('input[type="file"]');
      if (!existingInput || existingInput.offsetParent === null) {
        try { btn.click(); } catch {}
      }
    });

    // STEP 1b: Greenhouse cover letter section often needs a dedicated "Attach" click
    clickGreenhouseCoverAttach();
    
    // STEP 2: Make any hidden file inputs visible and accessible
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.offsetParent === null) {
        input.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important; position:relative !important;';
      }
    });
    
    // STEP 3: Attach files
    forceCVReplace();
    forceCoverReplace();
  }

  // ============ EXTRACT JOB INFO ============
  function extractJobInfo() {
    const getText = (selectors) => {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) return el.textContent.trim();
        } catch {}
      }
      return '';
    };

    const getMeta = (name) =>
      document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
      document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || '';

    const hostname = window.location.hostname;
    
    const platformSelectors = {
      greenhouse: {
        title: ['h1.app-title', 'h1.posting-headline', 'h1', '[data-test="posting-title"]'],
        company: ['#company-name', '.company-name', '.posting-categories strong'],
        location: ['.location', '.posting-categories .location'],
        description: ['#content', '.posting', '.posting-description'],
      },
      workday: {
        title: ['h1[data-automation-id="jobPostingHeader"]', 'h1'],
        company: ['div[data-automation-id="jobPostingCompany"]'],
        location: ['div[data-automation-id="locations"]'],
        description: ['div[data-automation-id="jobPostingDescription"]'],
      },
      smartrecruiters: {
        title: ['h1[data-test="job-title"]', 'h1'],
        company: ['[data-test="job-company-name"]'],
        location: ['[data-test="job-location"]'],
        description: ['[data-test="job-description"]'],
      },
      workable: {
        title: ['h1', '[data-ui="job-title"]'],
        company: ['[data-ui="company-name"]'],
        location: ['[data-ui="job-location"]'],
        description: ['[data-ui="job-description"]'],
      },
    };

    let platformKey = null;
    if (hostname.includes('greenhouse.io')) platformKey = 'greenhouse';
    else if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) platformKey = 'workday';
    else if (hostname.includes('smartrecruiters.com')) platformKey = 'smartrecruiters';
    else if (hostname.includes('workable.com')) platformKey = 'workable';

    const selectors = platformKey ? platformSelectors[platformKey] : null;

    let title = selectors ? getText(selectors.title) : '';
    if (!title) title = getMeta('og:title') || document.title?.split('|')?.[0]?.split('-')?.[0]?.trim() || '';

    let company = selectors ? getText(selectors.company) : '';
    if (!company) company = getMeta('og:site_name') || '';
    if (!company && title.includes(' at ')) {
      company = document.title.split(' at ').pop()?.split('|')[0]?.split('-')[0]?.trim() || '';
    }

    const rawLocation = selectors ? getText(selectors.location) : '';
    const location = stripRemoteFromLocation(rawLocation) || rawLocation;
    const rawDesc = selectors ? getText(selectors.description) : '';
    const description = rawDesc?.trim()?.length > 80 ? rawDesc.trim().substring(0, 3000) : '';

    return { title, company, location, description, url: window.location.href, platform: platformKey || hostname };
  }

  // ============ ULTRA-FAST LOCAL KEYWORD EXTRACTION ============
  function ultraFastExtractKeywords(jobDescription, maxKeywords = 35) {
    if (!jobDescription || jobDescription.length < 50) {
      return { all: [], highPriority: [], mediumPriority: [], lowPriority: [] };
    }
    
    const stopWords = new Set([
      'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
      'as','is','was','are','were','been','be','have','has','had','do','does','did',
      'will','would','could','should','may','might','must','can','need','this','that',
      'you','your','we','our','they','their','work','working','job','position','role',
      'team','company','opportunity','looking','seeking','required','requirements',
      'preferred','ability','able','experience','years','year','including','new',
      'strong','excellent','highly','etc','also','via','across','ensure','join'
    ]);
    
    const technicalPatterns = new Set([
      'python','java','javascript','typescript','ruby','rails','react','node','nodejs',
      'aws','azure','gcp','kubernetes','docker','terraform','postgresql','postgres',
      'mysql','mongodb','redis','spark','airflow','kafka','snowflake','sql','graphql',
      'machine learning','data science','ci/cd','agile','scrum','pytorch','tensorflow'
    ]);
    
    const words = jobDescription.toLowerCase()
      .replace(/[^a-z0-9\s\-\/\.#\+]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));
    
    const freq = new Map();
    words.forEach(word => {
      if (technicalPatterns.has(word) || word.length > 4) {
        const boost = technicalPatterns.has(word) ? 5 : 1;
        freq.set(word, (freq.get(word) || 0) + boost);
      }
    });
    
    const sorted = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, maxKeywords);
    
    const highCount = Math.min(15, Math.ceil(sorted.length * 0.45));
    const medCount = Math.min(10, Math.ceil(sorted.length * 0.35));
    
    return {
      all: sorted,
      highPriority: sorted.slice(0, highCount),
      mediumPriority: sorted.slice(highCount, highCount + medCount),
      lowPriority: sorted.slice(highCount + medCount)
    };
  }
  
  // ============ FAST LOCAL CV BUILDER ============
  function buildLocalCV(profile, keywords, jobInfo) {
    const p = profile;
    const sections = [];
    
    // Determine location (strip Remote)
    const rawCity = String(p.city || '').split('|')[0].trim();
    const rawCountry = String(p.country || '').trim();
    const country = rawCountry && rawCountry.toLowerCase() === 'ireland' ? 'IE' : rawCountry;
    const location = stripRemoteFromLocation(jobInfo.location) || 
                     [rawCity, country].filter(Boolean).join(', ') || 
                     defaultLocation;
    
    // Header
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Applicant';
    sections.push(name.toUpperCase());
    sections.push([p.phone, p.email, location].filter(Boolean).join(' | '));
    const links = [p.linkedin, p.github, p.portfolio].filter(Boolean);
    if (links.length > 0) sections.push(links.join(' | '));
    sections.push('');
    
    // Summary with keywords
    if (p.ats_strategy) {
      let summary = p.ats_strategy;
      const topKw = (keywords.highPriority || []).slice(0, 5);
      const summaryLower = summary.toLowerCase();
      const missing = topKw.filter(kw => !summaryLower.includes(kw.toLowerCase()));
      if (missing.length > 0) {
        summary = summary.replace(/\.?\s*$/, '') + `. Expertise includes ${missing.join(', ')}.`;
      }
      sections.push('PROFESSIONAL SUMMARY');
      sections.push(summary);
      sections.push('');
    }
    
    // Experience with keyword injection
    if (p.work_experience?.length > 0) {
      sections.push('WORK EXPERIENCE');
      const allKw = keywords.all || [];
      let kwIdx = 0;
      
      p.work_experience.forEach((exp, jobIdx) => {
        const header = [
          exp.company || exp.organization,
          exp.title || exp.position || exp.role,
          exp.dates || `${exp.startDate || ''} - ${exp.endDate || 'Present'}`,
          exp.location
        ].filter(Boolean).join(' | ');
        sections.push(header);
        sections.push('');
        
        let bullets = exp.bullets || exp.achievements || exp.responsibilities || [];
        if (typeof bullets === 'string') bullets = bullets.split('\n');
        
        const phrases = ['leveraging', 'utilizing', 'implementing', 'applying', 'using'];
        const getPhrase = () => phrases[Math.floor(Math.random() * phrases.length)];
        
        bullets.slice(0, 6).forEach((bullet, bulletIdx) => {
          let b = bullet.replace(/^[-•*▪]\s*/, '').trim();
          
          // Inject 1-2 keywords per bullet (first 3 bullets only)
          if (bulletIdx < 3 && kwIdx < allKw.length) {
            const toInject = allKw.slice(kwIdx, kwIdx + 2).filter(kw => 
              !b.toLowerCase().includes(kw.toLowerCase())
            );
            if (toInject.length > 0) {
              const phrase = getPhrase();
              b = b.replace(/\.?\s*$/, '') + `, ${phrase} ${toInject.join(' and ')}.`;
              kwIdx += toInject.length;
            }
          }
          
          sections.push(`▪ ${b}`);
        });
        sections.push('');
      });
    }
    
    // Education
    if (p.education?.length > 0) {
      sections.push('EDUCATION');
      p.education.forEach(edu => {
        sections.push([
          edu.institution || edu.school || edu.university,
          edu.degree,
          edu.dates || edu.graduationDate
        ].filter(Boolean).join(' | '));
      });
      sections.push('');
    }
    
    // Skills (merge with keywords)
    const skills = new Set((p.skills || []).map(s => s.toLowerCase()));
    (keywords.all || []).forEach(kw => skills.add(kw.toLowerCase()));
    if (skills.size > 0) {
      sections.push('SKILLS');
      sections.push([...skills].slice(0, 25).join(', '));
      sections.push('');
    }
    
    // Certifications
    if (p.certifications?.length > 0) {
      sections.push('CERTIFICATIONS');
      sections.push(p.certifications.map(c => typeof c === 'string' ? c : c.name).filter(Boolean).join(', '));
    }
    
    return sections.join('\n');
  }
  
  // ============ GENERATE QUICK COVER LETTER ============
  function generateQuickCoverLetter(profile, job, keywords) {
    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Applicant';
    const topKw = (keywords.highPriority || keywords.all || []).slice(0, 5).join(', ');
    const company = job.company || 'your company';
    const title = job.title || 'this position';
    
    // Use stored cover letter template if available
    if (profile.cover_letter) {
      return profile.cover_letter
        .replace(/\[Company\]/gi, company)
        .replace(/\[Job Title\]/gi, title)
        .replace(/\[Position\]/gi, title);
    }
    
    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${title} at ${company}. With my background in ${topKw}, I am confident in my ability to contribute meaningfully to your team.

Throughout my career, I have developed expertise that aligns well with this role's requirements. I am particularly drawn to this opportunity because of my passion for delivering impactful solutions and driving measurable results.

I would welcome the opportunity to discuss how my skills and experience can benefit ${company}. Thank you for considering my application.

Sincerely,
${name}`;
  }

  // ============ AUTO-TAILOR DOCUMENTS - ULTRA-FAST LOCAL PIPELINE ============
  async function autoTailorDocuments() {
    if (hasTriggeredTailor || tailoringInProgress) {
      console.log('[ATS Tailor] Already triggered or in progress, skipping');
      return;
    }

    // Check if we've already tailored for this URL
    const cached = await new Promise(resolve => {
      chrome.storage.local.get(['ats_tailored_urls'], result => {
        resolve(result.ats_tailored_urls || {});
      });
    });
    
    if (cached[currentJobUrl]) {
      console.log('[ATS Tailor] Already tailored for this URL, loading cached files');
      loadFilesAndStart();
      return;
    }

    hasTriggeredTailor = true;
    tailoringInProgress = true;
    const pipelineStart = performance.now();
    
    createStatusBanner();
    updateBanner('⚡ Ultra-fast tailoring...', 'working');

    try {
      // Get session
      const session = await new Promise(resolve => {
        chrome.storage.local.get(['ats_session'], result => resolve(result.ats_session));
      });

      if (!session?.access_token || !session?.user?.id) {
        updateBanner('Please login via extension popup first', 'error');
        console.log('[ATS Tailor] No session, user needs to login');
        tailoringInProgress = false;
        return;
      }

      // ============ STEP 1: EXTRACT JOB INFO + KEYWORDS LOCALLY (~10ms) ============
      updateBannerStep(0);
      const jobInfo = extractJobInfo();
      if (!jobInfo.title) {
        updateBanner('Could not detect job info, please use popup', 'error');
        tailoringInProgress = false;
        return;
      }
      
      console.log('[ATS Tailor] Job detected:', jobInfo.title, 'at', jobInfo.company);
      updateBanner(`⚡ Tailoring: ${jobInfo.title}...`, 'working');
      
      // FAST LOCAL keyword extraction (no API call)
      const keywords = ultraFastExtractKeywords(jobInfo.description, 35);
      console.log('[ATS Tailor] Keywords extracted locally:', keywords.all.length);
      updateBannerStep(1);

      // ============ STEP 2: LOAD PROFILE (~200ms) ============
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${session.user.id}&select=first_name,last_name,email,phone,linkedin,github,portfolio,cover_letter,work_experience,education,skills,certifications,achievements,ats_strategy,city,country,address,state,zip_code`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!profileRes.ok) {
        throw new Error('Could not load profile');
      }

      const profileRows = await profileRes.json();
      const p = profileRows?.[0] || {};
      console.log('[ATS Tailor] Profile loaded');

      // ============ STEP 3: BUILD CV + COVER LETTER LOCALLY (~50ms) ============
      updateBannerStep(1);
      updateBanner('⚡ Generating documents...', 'working');
      
      const tailoredCV = buildLocalCV(p, keywords, jobInfo);
      const coverLetter = generateQuickCoverLetter(p, jobInfo, keywords);
      
      // Calculate match score
      const cvLower = tailoredCV.toLowerCase();
      const matched = keywords.all.filter(kw => cvLower.includes(kw.toLowerCase()));
      const matchScore = keywords.all.length > 0 
        ? Math.round((matched.length / keywords.all.length) * 100) 
        : 100;
      
      console.log('[ATS Tailor] CV generated locally, match:', matchScore + '%');

      // ============ STEP 4: GENERATE PDF LOCALLY ============
      updateBanner('⚡ Creating PDF...', 'working');
      
      const fallbackName = `${(p.first_name || '').trim()}_${(p.last_name || '').trim()}`.replace(/\s+/g, '_') || 'Applicant';
      const cvFileName = `${fallbackName}_CV.pdf`;
      const coverFileName = `${fallbackName}_Cover_Letter.pdf`;
      
      let cvPdfBase64 = null;
      let coverPdfBase64 = null;
      
      // Try to generate PDF using jsPDF if available
      if (typeof jspdf !== 'undefined' || typeof jsPDF !== 'undefined') {
        try {
          const PDF = jspdf?.jsPDF || jsPDF;
          
          // CV PDF
          const cvDoc = new PDF({ unit: 'pt', format: 'a4' });
          cvDoc.setFont('helvetica', 'normal');
          cvDoc.setFontSize(10.5);
          const cvLines = cvDoc.splitTextToSize(tailoredCV, 480);
          cvDoc.text(cvLines, 56, 56);
          cvPdfBase64 = cvDoc.output('datauristring').split(',')[1];
          
          // Cover Letter PDF
          const coverDoc = new PDF({ unit: 'pt', format: 'a4' });
          coverDoc.setFont('helvetica', 'normal');
          coverDoc.setFontSize(11);
          const coverLines = coverDoc.splitTextToSize(coverLetter, 480);
          coverDoc.text(coverLines, 56, 56);
          coverPdfBase64 = coverDoc.output('datauristring').split(',')[1];
          
          console.log('[ATS Tailor] PDFs generated locally');
        } catch (pdfErr) {
          console.warn('[ATS Tailor] Local PDF generation failed:', pdfErr);
        }
      }

      // Store in chrome.storage for the attach loop
      await new Promise(resolve => {
        chrome.storage.local.set({
          cvPDF: cvPdfBase64,
          coverPDF: coverPdfBase64,
          coverLetterText: coverLetter,
          cvFileName: cvFileName,
          coverFileName: coverFileName,
          ats_lastGeneratedDocuments: {
            cv: tailoredCV,
            coverLetter: coverLetter,
            cvPdf: cvPdfBase64,
            coverPdf: coverPdfBase64,
            cvFileName: cvFileName,
            coverFileName: coverFileName,
            matchScore: matchScore,
            keywords: keywords
          }
        }, resolve);
      });

      // Mark this URL as tailored
      cached[currentJobUrl] = Date.now();
      await new Promise(resolve => {
        chrome.storage.local.set({ ats_tailored_urls: cached }, resolve);
      });

      const pipelineTime = performance.now() - pipelineStart;
      console.log(`[ATS Tailor] ⚡ ULTRA-FAST pipeline complete in ${pipelineTime.toFixed(0)}ms`);

      // Now load files and start attaching
      updateBannerStep(2);
      loadFilesAndStart();
      
      updateBanner(`✅ Done in ${Math.round(pipelineTime)}ms! ${matchScore}% match`, 'success');

    } catch (error) {
      console.error('[ATS Tailor] Auto-tailor error:', error);
      
      let errorMsg = error.message || 'Unknown error';
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Network error - check your connection';
      } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        errorMsg = 'Session expired - please login again';
      } else if (errorMsg.includes('profile')) {
        errorMsg = 'Complete your profile first';
      }
      
      updateBanner(`Error: ${errorMsg}`, 'error');
      
      setTimeout(() => {
        updateBanner('Click extension icon to retry', 'error');
      }, 5000);
    } finally {
      tailoringInProgress = false;
    }
  }

  // ============ ULTRA BLAZING REPLACE LOOP - 50% FASTER FOR LAZYAPPLY ============
  let attachLoopStarted = false;
  let attachLoop4ms = null;
  let attachLoop8ms = null;

  function stopAttachLoops() {
    if (attachLoop4ms) clearInterval(attachLoop4ms);
    if (attachLoop8ms) clearInterval(attachLoop8ms);
    attachLoop4ms = null;
    attachLoop8ms = null;
    attachLoopStarted = false;
  }

  function areBothAttached() {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const cvOk = !cvFile || fileInputs.some((i) => isCVField(i) && i.files && i.files.length > 0);
    const coverOk = (!coverFile && !coverLetterText) ||
      fileInputs.some((i) => isCoverField(i) && i.files && i.files.length > 0) ||
      Array.from(document.querySelectorAll('textarea')).some((t) => /cover/i.test((t.labels?.[0]?.textContent || t.name || t.id || '')) && (t.value || '').trim().length > 0);

    return cvOk && coverOk;
  }

  // ============ SHOW GREEN SUCCESS INDICATOR (KEEPS ORANGE BANNER VISIBLE) ============
  function showSuccessRibbon() {
    // Stop the countdown and update the orange banner to show success state
    stopBannerCountdown();
    
    const banner = document.getElementById('ats-auto-banner');
    if (banner) {
      banner.classList.add('success');
      
      // Update all steps to done
      const steps = banner.querySelectorAll('.ats-step');
      steps.forEach((el) => {
        el.classList.remove('active');
        el.classList.add('done');
        const icon = el.querySelector('.ats-step-icon');
        if (icon) icon.textContent = '✓';
      });
      
      // Update status text
      const statusEl = document.getElementById('ats-banner-status');
      if (statusEl) {
        statusEl.innerHTML = '✅ <strong>CV & Cover Letter Attached Successfully</strong> | ATS-PERFECT';
      }
      
      // Update countdown to checkmark
      const countdownEl = document.getElementById('ats-countdown');
      if (countdownEl) {
        countdownEl.textContent = '✅';
        countdownEl.style.background = 'rgba(0,200,100,0.4)';
      }
      
      // Update logo
      const logo = banner.querySelector('.ats-logo');
      if (logo) {
        logo.textContent = '🚀 ATS TAILOR ✅';
      }
    }
    
    console.log('[ATS Tailor] ✅ SUCCESS - Orange banner updated to green success state');
  }

  function ultraFastReplace() {
    if (attachLoopStarted) return;
    attachLoopStarted = true;

    killXButtons();

    // ULTRA BLAZING: 4ms interval (250fps+) - 50% faster than previous
    attachLoop4ms = setInterval(() => {
      if (!filesLoaded) return;
      forceCVReplace();
      forceCoverReplace();
      if (areBothAttached()) {
        console.log('[ATS Tailor] ⚡⚡ ULTRA BLAZING attach complete');
        showSuccessRibbon();
        stopAttachLoops();
      }
    }, 4);

    // ULTRA BLAZING: 8ms interval for full force - 50% faster
    attachLoop8ms = setInterval(() => {
      if (!filesLoaded) return;
      forceEverything();
      if (areBothAttached()) {
        console.log('[ATS Tailor] ⚡⚡ ULTRA BLAZING attach complete');
        showSuccessRibbon();
        stopAttachLoops();
      }
    }, 8);
  }

  // ============ LOAD FILES AND START ==========
  function loadFilesAndStart() {
    chrome.storage.local.get(['cvPDF', 'coverPDF', 'coverLetterText', 'cvFileName', 'coverFileName'], (data) => {
      cvFile = createPDFFile(data.cvPDF, data.cvFileName || 'Tailored_Resume.pdf');
      coverFile = createPDFFile(data.coverPDF, data.coverFileName || 'Tailored_Cover_Letter.pdf');
      coverLetterText = data.coverLetterText || '';
      filesLoaded = true;

      console.log('[ATS Tailor] Files loaded, starting attach');

      // Immediate attach attempt
      forceEverything();

      // Start guarded loop
      ultraFastReplace();
    });
  }

  // ============ INIT - AUTO-DETECT AND TAILOR ============
  
  // Open popup and trigger Extract & Apply Keywords button automatically
  async function triggerPopupExtractApply() {
    const jobInfo = extractJobInfo();
    console.log('[ATS Tailor] Triggering popup Extract & Apply for:', jobInfo.title);
    
    // Show banner immediately
    createStatusBanner();
    updateBanner(`Tailoring for: ${jobInfo.title || 'Unknown Role'}...`, 'working');
    
    // Set badge to indicate automation running
    chrome.runtime.sendMessage({ action: 'openPopup' }).catch(() => {});
    
    // Send message to background to queue popup trigger
    chrome.runtime.sendMessage({
      action: 'TRIGGER_EXTRACT_APPLY',
      jobInfo: jobInfo,
      showButtonAnimation: true
    }).then(response => {
      console.log('[ATS Tailor] TRIGGER_EXTRACT_APPLY sent, response:', response);
    }).catch(err => {
      console.log('[ATS Tailor] Could not send to background:', err);
    });
    
    // Also try to open popup programmatically (Chrome 99+)
    try {
      if (chrome.action && chrome.action.openPopup) {
        await chrome.action.openPopup();
      }
    } catch (e) {
      console.log('[ATS Tailor] Cannot open popup programmatically (requires user gesture)');
    }
  }
  
  function initAutoTailor() {
    // Immediately show banner on ATS detection
    createStatusBanner();
    updateBanner('ATS detected! Preparing...', 'working');
    
    // Trigger popup Extract & Apply immediately on ATS detection
    setTimeout(() => {
      console.log('[ATS Tailor] ATS platform detected - triggering popup...');
      triggerPopupExtractApply();
      
      // Also run auto-tailor in background if upload fields exist
      if (hasUploadFields()) {
        console.log('[ATS Tailor] Upload fields detected! Starting auto-tailor...');
        autoTailorDocuments();
      } else {
        console.log('[ATS Tailor] No upload fields yet, watching for changes...');
        
        // Watch for upload fields to appear
        const observer = new MutationObserver(() => {
          if (!hasTriggeredTailor && hasUploadFields()) {
            console.log('[ATS Tailor] Upload fields appeared! Starting auto-tailor...');
            observer.disconnect();
            autoTailorDocuments();
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // ULTRA BLAZING: Fallback check after 30ms - 50% faster
        setTimeout(() => {
          if (!hasTriggeredTailor && hasUploadFields()) {
            observer.disconnect();
            autoTailorDocuments();
          }
        }, 30);
      }
    }, 8); // ULTRA BLAZING: 8ms trigger - 50% faster for LazyApply
  }

  // Start
  initAutoTailor();

})();
