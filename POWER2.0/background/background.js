// POWER 2.0 - Background Service Worker
console.log('[POWER 2.0] Background started');

let bulkQueue = [], currentBulkTabId = null;
let bulkProgress = { completed: 0, total: 0, currentJob: '', isPaused: false, isStopped: false };

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({ profile: {}, options: { autoClickNextPage: false, autoSubmit: false, saveResponses: true, dailyGoal: 10 }, savedResponses: {} });
    chrome.tabs.create({ url: chrome.runtime.getURL('ui/options.html') });
  }
});

function updateBulkProgress() { chrome.storage.local.set({ bulkProgress }); }

async function processNextBulkJob() {
  if (bulkProgress.isStopped || bulkProgress.isPaused || bulkQueue.length === 0) {
    if (bulkQueue.length === 0) chrome.runtime.sendMessage({ action: 'BULK_COMPLETE' }).catch(() => {});
    return;
  }
  const job = bulkQueue.shift();
  bulkProgress.currentJob = job.url;
  updateBulkProgress();
  
  try {
    if (currentBulkTabId) await chrome.tabs.update(currentBulkTabId, { url: job.url });
    else { const tab = await chrome.tabs.create({ url: job.url, active: false }); currentBulkTabId = tab.id; }
    
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === currentBulkTabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => chrome.tabs.sendMessage(currentBulkTabId, { action: 'TRIGGER_BULK_AUTOMATION' }).catch(() => { bulkProgress.completed++; updateBulkProgress(); processNextBulkJob(); }), 2000);
      }
    });
  } catch { bulkProgress.completed++; updateBulkProgress(); processNextBulkJob(); }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'GET_JOB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { action: 'DETECT_JOB' }, r => sendResponse(r));
      else sendResponse({ error: 'No tab' });
    });
    return true;
  }
  
  const forwardActions = ['TAILOR_ONLY', 'AUTOFILL_ONLY', 'FULL_APPLY', 'START_WORKDAY_FLOW', 'ATTACH_FILES'];
  if (forwardActions.includes(msg.action)) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { action: 'RUN_' + msg.action.replace('START_', '') });
    });
    sendResponse({ status: 'sent' });
    return true;
  }
  
  if (msg.action === 'START_BULK_AUTOMATION') { bulkQueue = msg.jobs || []; bulkProgress = { completed: 0, total: bulkQueue.length, currentJob: '', isPaused: false, isStopped: false }; updateBulkProgress(); processNextBulkJob(); sendResponse({ status: 'started' }); return true; }
  if (msg.action === 'PAUSE_BULK') { bulkProgress.isPaused = true; updateBulkProgress(); sendResponse({ status: 'paused' }); return true; }
  if (msg.action === 'RESUME_BULK') { bulkProgress.isPaused = false; updateBulkProgress(); processNextBulkJob(); sendResponse({ status: 'resumed' }); return true; }
  if (msg.action === 'STOP_BULK') { bulkProgress.isStopped = true; bulkQueue = []; updateBulkProgress(); if (currentBulkTabId) { try { chrome.tabs.remove(currentBulkTabId); } catch {} currentBulkTabId = null; } sendResponse({ status: 'stopped' }); return true; }
  if (msg.action === 'GET_BULK_PROGRESS') { sendResponse({ progress: bulkProgress }); return true; }
  if (msg.action === 'BULK_JOB_COMPLETED') { bulkProgress.completed++; updateBulkProgress(); setTimeout(processNextBulkJob, 1000); sendResponse({ status: 'next' }); return true; }
  if (msg.action === 'WORKDAY_PAGE_CHANGED') { chrome.runtime.sendMessage({ action: 'WORKDAY_STATUS_UPDATE', page: msg.page, status: msg.status }).catch(() => {}); sendResponse({ status: 'ok' }); return true; }
});
