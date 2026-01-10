// content.js - Main POWER 2.0 content script
(function() {
  'use strict';
  console.log('[POWER 2.0] Content script loaded on:', location.hostname);

  // Auto-run Workday flow if on Workday
  if (window.WorkdayController?.isWorkday()) {
    console.log('[POWER 2.0] Workday detected - initializing controller');
    setTimeout(() => window.WorkdayController?.runFlow(), 1000);
  }

  // Message handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[POWER 2.0] Message received:', message.action);

    if (message.action === 'DETECT_JOB') {
      const job = window.UniversalJDParser?.parse(document) || {};
      job.ats = detectATS();
      job.tier = detectTier();
      sendResponse({ job });
      return true;
    }

    if (message.action === 'RUN_TAILOR_ONLY') {
      (async () => {
        const jobInfo = window.UniversalJDParser?.parse(document);
        const result = await window.TurboPipeline?.execute(jobInfo, {});
        chrome.runtime.sendMessage({ action: 'TAILOR_COMPLETE', score: result?.matchScore || 0, keywords: { matched: result?.matchedKeywords?.length, total: result?.keywords?.all?.length } });
        sendResponse({ success: true, result });
      })();
      return true;
    }

    if (message.action === 'RUN_AUTOFILL_ONLY') {
      (async () => {
        await window.AutofillEngine?.autofill({ includeQuestions: true });
        await window.SavedResponses?.autofillScreeningQuestions();
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.action === 'RUN_FULL_APPLY') {
      (async () => {
        // Step 1: Autofill
        await window.AutofillEngine?.autofill({ includeQuestions: true });
        await window.SavedResponses?.autofillScreeningQuestions();
        
        // Step 2: Tailor CV
        const jobInfo = window.UniversalJDParser?.parse(document);
        const result = await window.TurboPipeline?.execute(jobInfo, {});
        
        // Step 3: Notify completion
        chrome.runtime.sendMessage({ action: 'TAILOR_COMPLETE', score: result?.matchScore || 100, keywords: { matched: result?.matchedKeywords?.length || 0, total: result?.keywords?.all?.length || 0 } });
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.action === 'RUN_WORKDAY_FLOW') {
      (async () => {
        const result = await window.WorkdayController?.runFlow();
        sendResponse(result);
      })();
      return true;
    }

    if (message.action === 'TRIGGER_BULK_AUTOMATION') {
      (async () => {
        const url = location.href;
        if (url.includes('workday') || url.includes('myworkdayjobs')) {
          await window.WorkdayController?.runFlow();
        } else {
          await window.AutofillEngine?.autofill({ includeQuestions: true });
          const jobInfo = window.UniversalJDParser?.parse(document);
          await window.TurboPipeline?.execute(jobInfo, {});
        }
        chrome.runtime.sendMessage({ action: 'BULK_JOB_COMPLETED', jobUrl: url });
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.action === 'CAPTURE_JOB_SNAPSHOT') {
      const snapshot = window.WorkdayController?.captureJobSnapshot();
      sendResponse({ snapshot });
      return true;
    }
  });

  function detectATS() {
    const host = location.hostname.toLowerCase();
    if (host.includes('greenhouse')) return 'Greenhouse';
    if (host.includes('workday') || host.includes('myworkdayjobs')) return 'Workday';
    if (host.includes('lever')) return 'Lever';
    if (host.includes('smartrecruiters')) return 'SmartRecruiters';
    if (host.includes('icims')) return 'iCIMS';
    if (host.includes('taleo')) return 'Taleo';
    if (host.includes('jobvite')) return 'Jobvite';
    return null;
  }

  function detectTier() {
    const host = location.hostname.toLowerCase();
    const tier1 = ['google', 'meta', 'amazon', 'microsoft', 'apple', 'netflix', 'nvidia', 'stripe', 'openai'];
    const tier2 = ['salesforce', 'hubspot', 'adobe', 'ibm', 'oracle', 'vmware', 'cisco', 'intel', 'amd'];
    for (const t of tier1) if (host.includes(t)) return 1;
    for (const t of tier2) if (host.includes(t)) return 2;
    return null;
  }
})();
