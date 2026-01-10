// workday-controller.js - POWER2.0 Workday Flow Controller
// State machine for Workday multi-page application flow
// Inspired by SpeedyApply's reliable Workday automation

(function(global) {
  'use strict';

  const WorkdayController = {
    // Flow state
    state: {
      currentPage: null,
      flowActive: false,
      cvAttached: false,
      coverAttached: false,
      autofillComplete: false,
      jobSnapshot: null,
      errors: [],
      startTime: null
    },

    // Configuration (loaded from storage)
    config: {
      autoClickNext: false,
      autoSubmit: false,
      saveResponses: true,
      useApplicationsAccount: false,
      credentials: {
        username: '',
        password: ''
      }
    },

    // Initialize controller
    async init() {
      await this.loadConfig();
      this.detectPage();
      
      if (WorkdayDetector.isWorkday()) {
        console.log('[WorkdayController] Initialized on Workday page:', this.state.currentPage);
      }
    },

    // Load configuration from storage
    async loadConfig() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['power2_workday_config'], (result) => {
          if (result.power2_workday_config) {
            this.config = { ...this.config, ...result.power2_workday_config };
          }
          resolve();
        });
      });
    },

    // Save configuration
    async saveConfig() {
      return new Promise((resolve) => {
        chrome.storage.sync.set({ power2_workday_config: this.config }, resolve);
      });
    },

    // Detect current page and update state
    detectPage() {
      this.state.currentPage = WorkdayDetector.detectPage();
      this.state.errors = WorkdayDetector.getErrors();
      return this.state.currentPage;
    },

    // Start automation flow
    async startFlow(options = {}) {
      if (!WorkdayDetector.isWorkday()) {
        console.warn('[WorkdayController] Not on Workday - cannot start flow');
        return { success: false, error: 'Not on Workday' };
      }
      
      this.state.flowActive = true;
      this.state.startTime = Date.now();
      this.state.errors = [];
      
      console.log('[WorkdayController] Starting flow on page:', this.state.currentPage);
      
      // Notify background/popup
      chrome.runtime.sendMessage({
        action: 'WORKDAY_FLOW_STARTED',
        page: this.state.currentPage
      }).catch(() => {});
      
      // Route to appropriate handler
      return this.handleCurrentPage();
    },

    // Handle current page based on type
    async handleCurrentPage() {
      this.detectPage();
      
      switch (this.state.currentPage) {
        case 'jobListing':
          return this.handleJobListing();
        case 'signIn':
          return this.handleSignIn();
        case 'createAccount':
          return this.handleCreateAccount();
        case 'contactInfo':
          return this.handleContactInfo();
        case 'myExperience':
          return this.handleMyExperience();
        case 'questionnaire':
          return this.handleQuestionnaire();
        case 'voluntaryDisclosures':
          return this.handleVoluntaryDisclosures();
        case 'selfIdentify':
          return this.handleSelfIdentify();
        case 'review':
          return this.handleReview();
        default:
          return { success: false, error: 'Unknown page type' };
      }
    },

    // Handle job listing page - capture JD and click Apply
    async handleJobListing() {
      console.log('[WorkdayController] Handling Job Listing page');
      
      // Extract and store job info
      const jobInfo = WorkdayDetector.extractJobInfo();
      this.state.jobSnapshot = {
        ...jobInfo,
        url: window.location.href,
        capturedAt: Date.now()
      };
      
      // Store snapshot for persistence across navigation
      localStorage.setItem('power2_workday_snapshot', JSON.stringify(this.state.jobSnapshot));
      
      // Notify popup
      chrome.runtime.sendMessage({
        action: 'WORKDAY_JD_CAPTURED',
        jobInfo: this.state.jobSnapshot
      }).catch(() => {});
      
      console.log('[WorkdayController] Job snapshot captured:', jobInfo.title);
      
      // Click Apply if automation is active
      if (this.state.flowActive) {
        const applyBtn = WorkdayDetector.findApplyButton();
        if (applyBtn) {
          await this.wait(300);
          applyBtn.click();
          return { success: true, action: 'apply_clicked' };
        } else {
          return { success: false, error: 'Apply button not found' };
        }
      }
      
      return { success: true, action: 'snapshot_captured' };
    },

    // Handle sign in page
    async handleSignIn() {
      console.log('[WorkdayController] Handling Sign In page');
      
      if (!this.config.useApplicationsAccount || !this.config.credentials.username) {
        // Pause and wait for user to sign in
        return { 
          success: false, 
          action: 'waiting_for_signin',
          message: 'Please sign in manually or enable Applications Account'
        };
      }
      
      // Auto-fill credentials
      const emailInput = document.querySelector('[data-automation-id="email"]') || 
                         document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('[data-automation-id="password"]') ||
                           document.querySelector('input[type="password"]');
      
      if (emailInput && passwordInput) {
        AutofillEngine.setTextValue(emailInput, this.config.credentials.username);
        AutofillEngine.setTextValue(passwordInput, this.config.credentials.password);
        
        await this.wait(500);
        
        // Click sign in button
        const signInBtn = document.querySelector('[data-automation-id="signInSubmitButton"]') ||
                          document.querySelector('button[type="submit"]');
        if (signInBtn) {
          signInBtn.click();
          return { success: true, action: 'signed_in' };
        }
      }
      
      return { success: false, error: 'Could not auto-fill sign in' };
    },

    // Handle create account page
    async handleCreateAccount() {
      console.log('[WorkdayController] Handling Create Account page');
      
      if (!this.config.useApplicationsAccount || !this.config.credentials.username) {
        return { 
          success: false, 
          action: 'waiting_for_account_creation',
          message: 'Please create account manually or enable Applications Account'
        };
      }
      
      // Fill email
      const emailInput = document.querySelector('[data-automation-id="email"]') ||
                        document.querySelector('input[type="email"]');
      if (emailInput) {
        AutofillEngine.setTextValue(emailInput, this.config.credentials.username);
      }
      
      // Fill password
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      for (const input of passwordInputs) {
        AutofillEngine.setTextValue(input, this.config.credentials.password);
      }
      
      await this.wait(300);
      
      // Check consent checkbox
      const consentCheckbox = document.querySelector('[data-automation-id="legalTermsCheckbox"]') ||
                              document.querySelector('input[type="checkbox"][id*="consent"]');
      if (consentCheckbox && !consentCheckbox.checked) {
        consentCheckbox.click();
      }
      
      await this.wait(300);
      
      // Click create account
      const createBtn = document.querySelector('[data-automation-id="createAccountSubmitButton"]');
      if (createBtn) {
        createBtn.click();
        return { success: true, action: 'account_created' };
      }
      
      return { success: false, error: 'Create account button not found' };
    },

    // Handle contact info page
    async handleContactInfo() {
      console.log('[WorkdayController] Handling Contact Info page');
      
      // Autofill from profile
      const result = await AutofillEngine.fullAutofill();
      this.state.autofillComplete = true;
      
      // Workday-specific fields
      await this.fillWorkdayContactFields();
      
      // Check for errors before proceeding
      await this.wait(500);
      if (WorkdayDetector.hasErrors()) {
        return {
          success: false,
          action: 'errors_present',
          errors: WorkdayDetector.getErrors()
        };
      }
      
      // Auto-click next if enabled
      if (this.config.autoClickNext) {
        return this.clickNext();
      }
      
      return { success: true, action: 'contact_filled', filled: result.totalFilled };
    },

    // Handle My Experience page - CRITICAL: CV tailoring + attachment
    async handleMyExperience() {
      console.log('[WorkdayController] Handling My Experience page - CRITICAL STOP POINT');
      
      // Recover job snapshot
      if (!this.state.jobSnapshot) {
        try {
          this.state.jobSnapshot = JSON.parse(localStorage.getItem('power2_workday_snapshot') || '{}');
        } catch (e) {}
      }
      
      // CRITICAL: Stop here to tailor and attach CV
      if (!this.state.cvAttached) {
        // Notify popup to trigger tailoring
        chrome.runtime.sendMessage({
          action: 'WORKDAY_MY_EXPERIENCE',
          jobSnapshot: this.state.jobSnapshot,
          requiresTailoring: true
        }).catch(() => {});
        
        // If TurboPipeline is available, trigger tailoring
        if (typeof TurboPipeline !== 'undefined' && this.state.jobSnapshot?.description) {
          console.log('[WorkdayController] Triggering TurboPipeline for CV tailoring...');
          
          // This will be handled by the main content script
          return {
            success: true,
            action: 'awaiting_cv_tailoring',
            message: 'Tailoring CV for this role. Please wait...'
          };
        }
        
        return {
          success: true,
          action: 'awaiting_cv_attachment',
          message: 'Please attach your tailored CV'
        };
      }
      
      // CV already attached - fill other fields
      console.log('[WorkdayController] CV attached, filling other fields...');
      
      // Fill work experience if needed
      await this.fillWorkExperience();
      
      // Fill education if needed
      await this.fillEducation();
      
      // Check for errors
      await this.wait(500);
      if (WorkdayDetector.hasErrors()) {
        return {
          success: false,
          action: 'errors_present',
          errors: WorkdayDetector.getErrors()
        };
      }
      
      // Auto-click next if enabled
      if (this.config.autoClickNext) {
        return this.clickNext();
      }
      
      return { success: true, action: 'experience_complete' };
    },

    // Handle questionnaire page
    async handleQuestionnaire() {
      console.log('[WorkdayController] Handling Questionnaire page');
      
      // Try to answer from saved responses
      const answerResult = await AutofillEngine.answerScreeningQuestions();
      
      // Fill work authorization
      const profile = typeof ProfileStore !== 'undefined' ? ProfileStore.get() : {};
      AutofillEngine.fillWorkAuth(profile);
      
      // Check for errors
      await this.wait(500);
      if (WorkdayDetector.hasErrors()) {
        return {
          success: false,
          action: 'errors_present',
          errors: WorkdayDetector.getErrors(),
          message: 'Some questions require manual answers'
        };
      }
      
      // Auto-click next if enabled and no errors
      if (this.config.autoClickNext) {
        return this.clickNext();
      }
      
      return { success: true, action: 'questionnaire_filled', answered: answerResult.filled };
    },

    // Handle voluntary disclosures page
    async handleVoluntaryDisclosures() {
      console.log('[WorkdayController] Handling Voluntary Disclosures page');
      
      const profile = typeof ProfileStore !== 'undefined' ? ProfileStore.get() : {};
      AutofillEngine.fillDiversity(profile);
      
      // Auto-click next if enabled
      if (this.config.autoClickNext) {
        await this.wait(300);
        return this.clickNext();
      }
      
      return { success: true, action: 'disclosures_filled' };
    },

    // Handle self-identify page
    async handleSelfIdentify() {
      console.log('[WorkdayController] Handling Self Identify page');
      
      const profile = typeof ProfileStore !== 'undefined' ? ProfileStore.get() : {};
      AutofillEngine.fillDiversity(profile);
      
      // Auto-click next if enabled
      if (this.config.autoClickNext) {
        await this.wait(300);
        return this.clickNext();
      }
      
      return { success: true, action: 'self_identify_filled' };
    },

    // Handle review page
    async handleReview() {
      console.log('[WorkdayController] Handling Review page');
      
      // Never auto-submit - always require user confirmation
      if (this.config.autoSubmit) {
        // Even with autoSubmit, we check for errors first
        if (WorkdayDetector.hasErrors()) {
          return {
            success: false,
            action: 'errors_present',
            errors: WorkdayDetector.getErrors()
          };
        }
        
        const submitBtn = WorkdayDetector.findSubmitButton();
        if (submitBtn) {
          // Confirm before submitting
          chrome.runtime.sendMessage({
            action: 'WORKDAY_CONFIRM_SUBMIT',
            jobInfo: this.state.jobSnapshot
          }).catch(() => {});
          
          return { success: true, action: 'awaiting_submit_confirmation' };
        }
      }
      
      return { success: true, action: 'review_ready' };
    },

    // Click Next button with validation
    async clickNext() {
      // Check for errors first
      if (WorkdayDetector.hasErrors()) {
        const errors = WorkdayDetector.getErrors();
        console.log('[WorkdayController] Errors present, not clicking Next:', errors);
        return {
          success: false,
          action: 'errors_present',
          errors
        };
      }
      
      const nextBtn = WorkdayDetector.findNextButton();
      if (nextBtn) {
        nextBtn.click();
        console.log('[WorkdayController] Clicked Next button');
        
        // Wait for navigation
        await this.wait(1000);
        
        return { success: true, action: 'next_clicked' };
      }
      
      return { success: false, error: 'Next button not found' };
    },

    // Mark CV as attached
    markCVAttached() {
      this.state.cvAttached = true;
      console.log('[WorkdayController] CV marked as attached');
    },

    // Mark cover letter as attached
    markCoverAttached() {
      this.state.coverAttached = true;
      console.log('[WorkdayController] Cover letter marked as attached');
    },

    // Fill Workday-specific contact fields
    async fillWorkdayContactFields() {
      const profile = typeof ProfileStore !== 'undefined' ? ProfileStore.get() : {};
      
      // First name
      const firstName = document.querySelector('[data-automation-id="firstName"]');
      if (firstName) AutofillEngine.setTextValue(firstName, profile.firstName);
      
      // Last name
      const lastName = document.querySelector('[data-automation-id="lastName"]');
      if (lastName) AutofillEngine.setTextValue(lastName, profile.lastName);
      
      // Phone
      const phone = document.querySelector('[data-automation-id="phone-number"]') ||
                   document.querySelector('[data-automation-id="phoneNumber"]');
      if (phone) AutofillEngine.setTextValue(phone, profile.phone);
      
      // Country
      const country = document.querySelector('[data-automation-id="countryDropdown"]') ||
                     document.querySelector('[data-automation-id="country"]');
      if (country) AutofillEngine.setSelectValue(country, profile.country || 'Ireland');
    },

    // Fill work experience section
    async fillWorkExperience() {
      const profile = typeof ProfileStore !== 'undefined' ? ProfileStore.get() : {};
      if (!profile.experience?.company) return;
      
      // Look for work experience fields
      const companyInput = document.querySelector('[data-automation-id="company"]');
      const titleInput = document.querySelector('[data-automation-id="jobTitle"]');
      
      if (companyInput) AutofillEngine.setTextValue(companyInput, profile.experience.company);
      if (titleInput) AutofillEngine.setTextValue(titleInput, profile.experience.title);
    },

    // Fill education section
    async fillEducation() {
      const profile = typeof ProfileStore !== 'undefined' ? ProfileStore.get() : {};
      if (!profile.education?.school) return;
      
      const schoolInput = document.querySelector('[data-automation-id="school"]');
      const degreeInput = document.querySelector('[data-automation-id="degree"]');
      
      if (schoolInput) AutofillEngine.setTextValue(schoolInput, profile.education.school);
      if (degreeInput) AutofillEngine.setTextValue(degreeInput, profile.education.degree);
    },

    // Helper: wait
    wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Stop flow
    stopFlow() {
      this.state.flowActive = false;
      console.log('[WorkdayController] Flow stopped');
    },

    // Get current state
    getState() {
      return { ...this.state };
    }
  };

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WorkdayController.init());
  } else {
    WorkdayController.init();
  }

  // Export
  global.WorkdayController = WorkdayController;
  global.POWER2_WorkdayController = WorkdayController;

})(typeof window !== 'undefined' ? window : this);
