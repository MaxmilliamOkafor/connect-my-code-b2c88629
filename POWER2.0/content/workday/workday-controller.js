// workday-controller.js - Workday multi-page flow controller
(function(global) {
  'use strict';

  global.WorkdayController = {
    options: { autoClickNextPage: false, autoSubmit: false, saveResponses: true },
    currentPage: null,
    jobSnapshot: null,

    isWorkday() {
      return location.hostname.includes('workday') || location.hostname.includes('myworkdayjobs');
    },

    async loadOptions() {
      return new Promise(resolve => {
        chrome.storage.sync.get(['options', 'workdayJobSnapshot'], result => {
          if (result.options) this.options = { ...this.options, ...result.options };
          if (result.workdayJobSnapshot) this.jobSnapshot = result.workdayJobSnapshot;
          resolve();
        });
      });
    },

    detectPage() {
      const url = location.href.toLowerCase();
      const body = document.body?.textContent?.toLowerCase() || '';
      
      // Use data-automation-id for reliable detection
      const hasElement = (id) => !!document.querySelector(`[data-automation-id="${id}"]`);
      
      if (hasElement('createAccountButton') || hasElement('signInLink') || url.includes('login') || url.includes('signin')) {
        return 'login';
      }
      if (hasElement('contactInformation') || body.includes('contact information') || hasElement('legalNameSection')) {
        return 'contact';
      }
      if (hasElement('resumeSection') || hasElement('workExperienceSection') || body.includes('my experience') || body.includes('work experience')) {
        return 'experience';
      }
      if (hasElement('educationSection') || body.includes('education')) {
        return 'education';
      }
      if (hasElement('questionnaire') || body.includes('application questions') || body.includes('screening questions')) {
        return 'questions';
      }
      if (hasElement('voluntaryDisclosures') || body.includes('voluntary disclosures') || body.includes('equal opportunity')) {
        return 'voluntary';
      }
      if (hasElement('selfIdentification') || body.includes('self-identification') || body.includes('self identification')) {
        return 'selfid';
      }
      if (hasElement('reviewSection') || body.includes('review and submit') || body.includes('review your application')) {
        return 'review';
      }
      if (hasElement('jobPostingApplyButton') || body.includes('apply for this job')) {
        return 'jobListing';
      }
      
      return 'unknown';
    },

    async runFlow() {
      await this.loadOptions();
      this.currentPage = this.detectPage();
      console.log(`[WorkdayController] Current page: ${this.currentPage}`);
      
      // Notify popup of page change
      chrome.runtime.sendMessage({ action: 'WORKDAY_PAGE_CHANGED', page: this.currentPage });
      
      // Route to appropriate handler
      const handlers = {
        'login': () => global.WorkdayPages?.handleLogin(),
        'contact': () => global.WorkdayPages?.handleContactInfo(),
        'experience': () => this.handleExperiencePage(),
        'education': () => global.WorkdayPages?.handleEducation(),
        'questions': () => global.WorkdayPages?.handleQuestions(),
        'voluntary': () => global.WorkdayPages?.handleVoluntary(),
        'selfid': () => global.WorkdayPages?.handleSelfId(),
        'review': () => global.WorkdayPages?.handleReview()
      };
      
      const handler = handlers[this.currentPage];
      if (handler) {
        await handler();
        
        // Check for errors before auto-navigating
        if (!global.ValidationEngine?.hasWorkdayErrors() && this.options.autoClickNextPage && this.currentPage !== 'experience') {
          this.clickNext();
        }
      }
      
      return { page: this.currentPage, success: true };
    },

    async handleExperiencePage() {
      console.log('[WorkdayController] On My Experience - STOPPING for CV tailoring');
      
      // Always stop here - this is where we tailor and attach CV
      chrome.runtime.sendMessage({ 
        action: 'WORKDAY_STATUS_UPDATE', 
        page: 'experience',
        status: 'awaiting_cv',
        message: 'Stopped on My Experience page. Tailor and attach your CV.'
      });
      
      // If we have a job snapshot, we can auto-tailor
      if (this.jobSnapshot?.jdText) {
        console.log('[WorkdayController] Job snapshot available - can auto-tailor');
      }
      
      return { stopped: true, reason: 'CV tailoring required on My Experience page' };
    },

    clickNext() {
      const selectors = [
        '[data-automation-id="bottom-navigation-next-button"]',
        '[data-automation-id="next-button"]',
        'button[type="submit"]',
        'button:contains("Next")',
        'button:contains("Continue")'
      ];
      
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled) {
          console.log('[WorkdayController] Clicking Next...');
          btn.click();
          return true;
        }
      }
      return false;
    },

    clickSubmit() {
      if (!this.options.autoSubmit) {
        console.log('[WorkdayController] Auto-submit disabled');
        return false;
      }
      
      const selectors = [
        '[data-automation-id="submit-button"]',
        'button[type="submit"]:contains("Submit")',
        'button:contains("Submit Application")'
      ];
      
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled) {
          console.log('[WorkdayController] Submitting application...');
          btn.click();
          return true;
        }
      }
      return false;
    },

    captureJobSnapshot() {
      const jobInfo = global.UniversalJDParser?.parse(document) || {};
      const keywords = global.ReliableExtractor?.extract(jobInfo.jdText) || { all: [] };
      
      this.jobSnapshot = { ...jobInfo, keywords, capturedAt: Date.now(), url: location.href };
      chrome.storage.sync.set({ workdayJobSnapshot: this.jobSnapshot });
      
      console.log(`[WorkdayController] Captured job snapshot: ${keywords.all.length} keywords`);
      return this.jobSnapshot;
    }
  };
})(typeof window !== 'undefined' ? window : global);
