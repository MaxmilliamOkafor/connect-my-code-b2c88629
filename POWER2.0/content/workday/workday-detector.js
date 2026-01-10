// workday-detector.js - POWER2.0 Workday Page Detection
// Identifies which page of Workday application flow user is on
// Inspired by SpeedyApply's multi-page Workday detection

(function(global) {
  'use strict';

  const WorkdayDetector = {
    // Workday domain patterns
    workdayDomains: [
      'workday.com',
      'myworkdayjobs.com',
      'wd1.myworkdayjobs.com',
      'wd3.myworkdayjobs.com',
      'wd5.myworkdayjobs.com'
    ],

    // Page type detection via data-automation-id
    pageSelectors: {
      jobListing: [
        '[data-automation-id="jobPostingHeader"]',
        '[data-automation-id="jobPostingDescription"]',
        '[data-automation-id="jobPostingApplyButton"]'
      ],
      signIn: [
        '[data-automation-id="signInLink"]',
        '[data-automation-id="signInButton"]',
        'input[data-automation-id="email"]'
      ],
      createAccount: [
        '[data-automation-id="createAccountLink"]',
        '[data-automation-id="createAccountSubmitButton"]',
        '[data-automation-id="legalTermsCheckbox"]'
      ],
      contactInfo: [
        '[data-automation-id="firstName"]',
        '[data-automation-id="lastName"]',
        '[data-automation-id="phone-number"]',
        '[data-automation-id="addressSection"]'
      ],
      myExperience: [
        '[data-automation-id="resumeOrCV"]',
        '[data-automation-id="uploadFileSection"]',
        '[data-automation-id="workExperienceSection"]',
        '[data-automation-id="Add Another"]',
        '[data-automation-id="educationSection"]'
      ],
      questionnaire: [
        '[data-automation-id="questionnaire"]',
        '[data-automation-id="questionnaireSection"]',
        '[data-automation-id="multiselectInputContainer"]'
      ],
      voluntaryDisclosures: [
        '[data-automation-id="voluntaryDisclosuresSection"]',
        '[data-automation-id="veteranStatus"]',
        '[data-automation-id="disabilityStatus"]'
      ],
      selfIdentify: [
        '[data-automation-id="selfIdentificationSection"]',
        '[data-automation-id="raceAndEthnicity"]',
        '[data-automation-id="gender"]'
      ],
      review: [
        '[data-automation-id="reviewSection"]',
        '[data-automation-id="reviewSectionHeader"]',
        '[data-automation-id="submitButton"]'
      ]
    },

    // Check if current site is Workday
    isWorkday() {
      const hostname = window.location.hostname.toLowerCase();
      return this.workdayDomains.some(d => hostname.includes(d));
    },

    // Detect current page type
    detectPage() {
      if (!this.isWorkday()) return null;
      
      for (const [pageType, selectors] of Object.entries(this.pageSelectors)) {
        let matchCount = 0;
        for (const selector of selectors) {
          if (document.querySelector(selector)) {
            matchCount++;
          }
        }
        // If at least half of selectors match, it's likely this page
        if (matchCount >= Math.ceil(selectors.length / 2)) {
          return pageType;
        }
      }
      
      // URL-based fallback detection
      const url = window.location.href.toLowerCase();
      if (url.includes('/job/') || url.includes('/jobs/')) return 'jobListing';
      if (url.includes('/signin') || url.includes('/login')) return 'signIn';
      if (url.includes('/apply') || url.includes('/application')) {
        // Check for specific sections in URL or page content
        const pageText = document.body?.textContent?.toLowerCase() || '';
        if (pageText.includes('my experience') || pageText.includes('upload')) return 'myExperience';
        if (pageText.includes('contact') || pageText.includes('address')) return 'contactInfo';
        if (pageText.includes('questionnaire') || pageText.includes('questions')) return 'questionnaire';
        if (pageText.includes('review') || pageText.includes('submit')) return 'review';
        return 'application'; // Generic application page
      }
      
      return 'unknown';
    },

    // Get page metadata
    getPageInfo() {
      const pageType = this.detectPage();
      
      return {
        isWorkday: this.isWorkday(),
        pageType,
        url: window.location.href,
        hasApplyButton: !!document.querySelector('[data-automation-id="jobPostingApplyButton"]'),
        hasNextButton: !!document.querySelector('[data-automation-id="bottom-navigation-next-button"]'),
        hasSubmitButton: !!document.querySelector('[data-automation-id="submitButton"]'),
        hasErrors: this.hasErrors(),
        isComplete: this.isApplicationComplete()
      };
    },

    // Check for error messages on page
    hasErrors() {
      const errorSelectors = [
        '[data-automation-id="errorMessage"]',
        '.errorMessage',
        '[class*="error-message"]',
        '[role="alert"]',
        '.validationMessage'
      ];
      
      for (const selector of errorSelectors) {
        const errors = document.querySelectorAll(selector);
        for (const error of errors) {
          if (error.offsetParent !== null && error.textContent?.trim()) {
            return true;
          }
        }
      }
      
      return false;
    },

    // Get all error messages
    getErrors() {
      const messages = [];
      const errorSelectors = [
        '[data-automation-id="errorMessage"]',
        '.errorMessage',
        '[class*="error-message"]',
        '[role="alert"]'
      ];
      
      for (const selector of errorSelectors) {
        document.querySelectorAll(selector).forEach(el => {
          if (el.offsetParent !== null && el.textContent?.trim()) {
            messages.push(el.textContent.trim());
          }
        });
      }
      
      return [...new Set(messages)];
    },

    // Check if application is complete (on thank you page)
    isApplicationComplete() {
      const pageText = document.body?.textContent?.toLowerCase() || '';
      const successIndicators = [
        'thank you for applying',
        'application submitted',
        'application received',
        'successfully submitted',
        'we have received your application'
      ];
      
      return successIndicators.some(indicator => pageText.includes(indicator));
    },

    // Find Next button
    findNextButton() {
      const selectors = [
        '[data-automation-id="bottom-navigation-next-button"]',
        '[data-automation-id="nextButton"]',
        'button[data-automation-id="bottom-navigation-next-button"]',
        'button:contains("Next")',
        'button:contains("Continue")'
      ];
      
      for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null && !btn.disabled) {
          return btn;
        }
      }
      
      // Text-based fallback
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase();
        if ((text === 'next' || text === 'continue') && !btn.disabled) {
          return btn;
        }
      }
      
      return null;
    },

    // Find Submit button
    findSubmitButton() {
      const selectors = [
        '[data-automation-id="submitButton"]',
        'button[data-automation-id="submitButton"]',
        'button[type="submit"]'
      ];
      
      for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null && !btn.disabled) {
          return btn;
        }
      }
      
      // Text-based fallback
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase();
        if (text === 'submit' && !btn.disabled) {
          return btn;
        }
      }
      
      return null;
    },

    // Find Apply button on job listing
    findApplyButton() {
      const selectors = [
        'a[data-automation-id="jobPostingApplyButton"]',
        'button[data-automation-id="jobPostingApplyButton"]',
        '[data-automation-id="applyButton"]',
        'a[href*="/apply"]',
        'button[aria-label*="Apply"]'
      ];
      
      for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null) {
          return btn;
        }
      }
      
      // Text-based fallback
      const links = document.querySelectorAll('a, button');
      for (const el of links) {
        const text = el.textContent?.trim().toLowerCase();
        if ((text === 'apply' || text === 'apply now') && el.offsetParent !== null) {
          return el;
        }
      }
      
      return null;
    },

    // Extract job info from Workday listing page
    extractJobInfo() {
      const info = {
        title: '',
        company: '',
        location: '',
        description: '',
        requisitionId: '',
        postedDate: ''
      };
      
      // Title
      const titleSelectors = [
        '[data-automation-id="jobPostingHeader"] h2',
        '[data-automation-id="jobTitle"]',
        'h1[class*="title"]',
        'h2[class*="title"]'
      ];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          info.title = el.textContent.trim();
          break;
        }
      }
      
      // Company
      const companySelectors = [
        '[data-automation-id="company"]',
        '[data-automation-id="jobCompany"]'
      ];
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          info.company = el.textContent.trim();
          break;
        }
      }
      if (!info.company) {
        // Try subdomain
        const subdomain = window.location.hostname.split('.')[0];
        if (subdomain && !['www', 'apply', 'wd1', 'wd3', 'wd5'].includes(subdomain)) {
          info.company = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
        }
      }
      
      // Location
      const locationSelectors = [
        '[data-automation-id="location"]',
        '[data-automation-id="locations"]',
        '[data-automation-id="jobPostingLocation"]'
      ];
      for (const sel of locationSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          info.location = el.textContent.trim();
          break;
        }
      }
      
      // Description
      const descSelectors = [
        '[data-automation-id="jobPostingDescription"]',
        '[data-automation-id="job-description"]',
        '.job-description'
      ];
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim().length > 200) {
          info.description = el.textContent.trim().substring(0, 10000);
          break;
        }
      }
      
      // Requisition ID
      const reqMatch = document.body.textContent?.match(/R-\d{5,}/);
      if (reqMatch) {
        info.requisitionId = reqMatch[0];
      }
      
      return info;
    }
  };

  // Export
  global.WorkdayDetector = WorkdayDetector;
  global.POWER2_WorkdayDetector = WorkdayDetector;

})(typeof window !== 'undefined' ? window : this);
