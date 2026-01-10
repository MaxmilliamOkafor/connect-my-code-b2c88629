// POWER 2.0 - Popup Script with Bulk CSV and Workday Controls
class Power2Popup {
  constructor() {
    this.currentJob = null;
    this.stats = { today: 0, total: 0, goal: 10 };
    this.options = { autoClickNextPage: false, autoSubmit: false, saveResponses: true };
    this.bulkJobs = [];
    this.bulkRunning = false;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
    this.bindTabs();
    this.detectCurrentJob();
    this.updateStats();
    this.pollBulkProgress();
    this.listenForMessages();
  }

  async loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get(['options', 'stats', 'workday_email', 'workday_password', 'workdayJobSnapshot'], result => {
        if (result.options) this.options = { ...this.options, ...result.options };
        if (result.stats) this.stats = { ...this.stats, ...result.stats };
        
        document.getElementById('autoNextToggle').checked = this.options.autoClickNextPage;
        document.getElementById('autoSubmitToggle').checked = this.options.autoSubmit;
        document.getElementById('saveResponsesToggle').checked = this.options.saveResponses;
        document.getElementById('workdayEmail').value = result.workday_email || '';
        document.getElementById('workdayPassword').value = result.workday_password || '';
        
        if (result.workdayJobSnapshot) {
          this.showSnapshot(result.workdayJobSnapshot);
        }
        resolve();
      });
    });
  }

  bindTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  bindEvents() {
    // Main actions
    document.getElementById('tailorOnlyBtn')?.addEventListener('click', () => this.runAction('TAILOR_ONLY'));
    document.getElementById('autofillOnlyBtn')?.addEventListener('click', () => this.runAction('AUTOFILL_ONLY'));
    document.getElementById('fullApplyBtn')?.addEventListener('click', () => this.runAction('FULL_APPLY'));
    document.getElementById('refreshJob')?.addEventListener('click', () => this.detectCurrentJob());
    document.getElementById('downloadCvBtn')?.addEventListener('click', () => this.downloadCV());
    document.getElementById('attachBtn')?.addEventListener('click', () => this.attachFiles());

    // Bulk CSV
    document.getElementById('uploadCsvBtn')?.addEventListener('click', () => document.getElementById('csvFileInput').click());
    document.getElementById('csvFileInput')?.addEventListener('change', (e) => this.handleCSVUpload(e));
    document.getElementById('startBulkBtn')?.addEventListener('click', () => this.startBulkApply());
    document.getElementById('pauseBulkBtn')?.addEventListener('click', () => this.pauseBulk());
    document.getElementById('resumeBulkBtn')?.addEventListener('click', () => this.resumeBulk());
    document.getElementById('stopBulkBtn')?.addEventListener('click', () => this.stopBulk());

    // Workday
    document.getElementById('workdayFlowBtn')?.addEventListener('click', () => this.startWorkdayFlow());
    document.getElementById('autoNextToggle')?.addEventListener('change', (e) => this.updateOption('autoClickNextPage', e.target.checked));
    document.getElementById('autoSubmitToggle')?.addEventListener('change', (e) => this.updateOption('autoSubmit', e.target.checked));
    document.getElementById('saveResponsesToggle')?.addEventListener('change', (e) => this.updateOption('saveResponses', e.target.checked));
    document.getElementById('saveWorkdayCredsBtn')?.addEventListener('click', () => this.saveWorkdayCreds());

    // Footer
    document.getElementById('openOptionsBtn')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
    document.getElementById('openSidePanelBtn')?.addEventListener('click', () => chrome.sidePanel?.open?.({ windowId: chrome.windows.WINDOW_ID_CURRENT }));
  }

  listenForMessages() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'TAILOR_COMPLETE') this.showMatchScore(msg.score, msg.keywords);
      if (msg.action === 'WORKDAY_STATUS_UPDATE') this.updateWorkdayStatus(msg.page, msg.status);
      if (msg.action === 'BULK_COMPLETE') this.onBulkComplete();
    });
  }

  async detectCurrentJob() {
    this.updateStatus('Scanning...', 'working');
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_JOB_INFO' });
      if (response?.job) {
        this.updateJobCard(response.job);
        this.updateStatus('Ready', 'success');
      } else {
        this.updateJobCard(null);
        this.updateStatus('No job detected', 'error');
      }
    } catch (err) {
      this.updateStatus('Error', 'error');
    }
  }

  updateJobCard(job) {
    this.currentJob = job;
    document.getElementById('jobTitle').textContent = job?.title || 'No job detected';
    document.getElementById('jobCompany').textContent = job?.company || '';
    document.getElementById('jobLocation').textContent = job?.location || '';
    
    const atsBadge = document.getElementById('atsBadge');
    const tier1Badge = document.getElementById('tier1Badge');
    
    if (job?.ats) { atsBadge.textContent = job.ats; atsBadge.classList.remove('hidden'); }
    else { atsBadge.classList.add('hidden'); }
    
    if (job?.tier) { tier1Badge.textContent = `Tier ${job.tier}`; tier1Badge.classList.remove('hidden'); }
    else { tier1Badge.classList.add('hidden'); }
  }

  updateStatus(text, type = 'ready') {
    const indicator = document.getElementById('statusIndicator');
    indicator.className = 'status-indicator ' + (type !== 'ready' ? type : '');
    indicator.querySelector('.status-text').textContent = text;
  }

  async runAction(action) {
    const btn = document.getElementById(action === 'TAILOR_ONLY' ? 'tailorOnlyBtn' : action === 'AUTOFILL_ONLY' ? 'autofillOnlyBtn' : 'fullApplyBtn');
    this.setLoading(btn, true);
    this.updateStatus('Processing...', 'working');
    try {
      await chrome.runtime.sendMessage({ action });
      this.updateStatus('Done!', 'success');
    } catch (err) {
      this.updateStatus('Error', 'error');
    }
    this.setLoading(btn, false);
  }

  showMatchScore(score, keywords) {
    document.getElementById('matchSection').classList.remove('hidden');
    document.getElementById('matchPercent').textContent = `${score}%`;
    document.getElementById('keywordCount').textContent = `${keywords?.matched || 0}/${keywords?.total || 0} keywords`;
    
    const circle = document.getElementById('matchCircle');
    const offset = 283 - (score / 100) * 283;
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';
    
    this.updateStatus('Tailored!', 'success');
  }

  // ============ BULK CSV ============
  handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('csvFileName').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const lines = event.target.result.split('\n').filter(l => l.trim());
      this.bulkJobs = lines.slice(1).map(line => {
        const parts = line.split(',');
        return { url: parts[0]?.trim(), title: parts[1]?.trim() || '' };
      }).filter(j => j.url && j.url.startsWith('http'));
      
      this.showCSVPreview();
    };
    reader.readAsText(file);
  }

  showCSVPreview() {
    document.getElementById('csvPreview').classList.remove('hidden');
    document.getElementById('csvJobCount').textContent = `${this.bulkJobs.length} jobs`;
    document.getElementById('csvStatus').textContent = 'Ready';
    
    const list = document.getElementById('csvJobList');
    list.innerHTML = this.bulkJobs.slice(0, 10).map(j => `<div>${j.title || j.url}</div>`).join('');
    if (this.bulkJobs.length > 10) list.innerHTML += `<div>...and ${this.bulkJobs.length - 10} more</div>`;
    
    document.getElementById('startBulkBtn').disabled = false;
  }

  async startBulkApply() {
    if (!this.bulkJobs.length) return;
    
    this.bulkRunning = true;
    document.getElementById('bulkActions').classList.remove('hidden');
    document.getElementById('bulkProgress').classList.remove('hidden');
    document.getElementById('bulkTotal').textContent = this.bulkJobs.length;
    
    await chrome.runtime.sendMessage({ action: 'START_BULK_AUTOMATION', jobs: this.bulkJobs });
    this.updateStatus('Bulk running...', 'working');
  }

  async pauseBulk() {
    await chrome.runtime.sendMessage({ action: 'PAUSE_BULK' });
    document.getElementById('pauseBulkBtn').classList.add('hidden');
    document.getElementById('resumeBulkBtn').classList.remove('hidden');
  }

  async resumeBulk() {
    await chrome.runtime.sendMessage({ action: 'RESUME_BULK' });
    document.getElementById('pauseBulkBtn').classList.remove('hidden');
    document.getElementById('resumeBulkBtn').classList.add('hidden');
  }

  async stopBulk() {
    await chrome.runtime.sendMessage({ action: 'STOP_BULK' });
    this.onBulkComplete();
  }

  async pollBulkProgress() {
    setInterval(async () => {
      if (!this.bulkRunning) return;
      const result = await chrome.runtime.sendMessage({ action: 'GET_BULK_PROGRESS' });
      if (result?.progress) {
        const p = result.progress;
        document.getElementById('bulkCompleted').textContent = p.completed;
        document.getElementById('bulkProgressFill').style.width = `${(p.completed / p.total) * 100}%`;
        document.getElementById('bulkCurrentJob').textContent = p.currentJob || '-';
      }
    }, 2000);
  }

  onBulkComplete() {
    this.bulkRunning = false;
    document.getElementById('bulkActions').classList.add('hidden');
    this.updateStatus('Bulk complete!', 'success');
  }

  // ============ WORKDAY ============
  async startWorkdayFlow() {
    this.setLoading(document.getElementById('workdayFlowBtn'), true);
    document.getElementById('workdayStatus').classList.remove('hidden');
    this.updateStatus('Workday flow...', 'working');
    
    await chrome.runtime.sendMessage({ action: 'START_WORKDAY_FLOW' });
    this.setLoading(document.getElementById('workdayFlowBtn'), false);
  }

  updateWorkdayStatus(page, status) {
    document.getElementById('workdayStatus').classList.remove('hidden');
    const pages = ['login', 'contact', 'experience', 'education', 'questions', 'voluntary', 'selfid', 'review'];
    const idx = pages.indexOf(page) + 1;
    
    document.getElementById('workdayStep').textContent = `Step ${idx}/${pages.length}`;
    document.getElementById('workdayPage').textContent = page?.charAt(0).toUpperCase() + page?.slice(1) || 'Processing...';
    document.getElementById('workdayProgressFill').style.width = `${(idx / pages.length) * 100}%`;
    
    if (status === 'complete') this.updateStatus('Workday done!', 'success');
    if (status === 'error' || status === 'awaiting_cv') this.updateStatus(status === 'awaiting_cv' ? 'Attach CV' : 'Error', status === 'awaiting_cv' ? 'working' : 'error');
  }

  showSnapshot(snapshot) {
    document.getElementById('snapshotPanel').classList.remove('hidden');
    document.getElementById('snapshotTitle').textContent = snapshot.title || '-';
    document.getElementById('snapshotCompany').textContent = snapshot.company || '-';
    document.getElementById('snapshotKeywords').textContent = `${snapshot.keywords?.all?.length || 0} keywords`;
  }

  saveWorkdayCreds() {
    chrome.storage.sync.set({
      workday_email: document.getElementById('workdayEmail').value,
      workday_password: document.getElementById('workdayPassword').value
    });
    this.updateStatus('Saved!', 'success');
  }

  // ============ HELPERS ============
  updateOption(key, value) {
    this.options[key] = value;
    chrome.storage.sync.set({ options: this.options });
  }

  updateStats() {
    document.getElementById('todayCount').textContent = this.stats.today;
    document.getElementById('totalCount').textContent = this.stats.total;
    document.getElementById('goalProgress').textContent = `${Math.min(100, Math.round((this.stats.today / this.stats.goal) * 100))}%`;
  }

  setLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
    const icon = btn.querySelector('.btn-icon');
    if (loading) { icon.dataset.orig = icon.textContent; icon.textContent = '⏳'; }
    else if (icon.dataset.orig) { icon.textContent = icon.dataset.orig; }
  }

  async downloadCV() { await chrome.runtime.sendMessage({ action: 'DOWNLOAD_CV' }); }
  async attachFiles() { await chrome.runtime.sendMessage({ action: 'ATTACH_FILES' }); this.updateStatus('Attached!', 'success'); }
}

document.addEventListener('DOMContentLoaded', () => new Power2Popup());
