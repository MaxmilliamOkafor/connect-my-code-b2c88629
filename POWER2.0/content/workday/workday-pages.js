// workday-pages.js - POWER2.0 Workday Page-Specific Handlers
// Dedicated handlers for each Workday application page
// Inspired by SpeedyApply's page-by-page automation

(function(global) {
  'use strict';

  const WorkdayPages = {
    // Page handler registry
    handlers: {},

    // Register a page handler
    register(pageType, handler) {
      this.handlers[pageType] = handler;
    },

    // Get handler for page type
    getHandler(pageType) {
      return this.handlers[pageType] || null;
    },

    // Common field fillers for Workday
    fillCommonFields: {
      // Fill country dropdown
      country(value = 'Ireland') {
        const selectors = [
          '[data-automation-id="countryDropdown"]',
          '[data-automation-id="country"]',
          'select[id*="country" i]'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            AutofillEngine.setSelectValue(el, value);
            return true;
          }
        }
        return false;
      },

      // Fill phone type dropdown
      phoneType(value = 'Mobile') {
        const selectors = [
          '[data-automation-id="phone-device-type"]',
          '[data-automation-id="phoneDeviceType"]'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            AutofillEngine.setSelectValue(el, value);
            return true;
          }
        }
        return false;
      },

      // Fill source/referral dropdown
      source(value = 'Job Board') {
        const selectors = [
          '[data-automation-id="sourceDropdown"]',
          '[data-automation-id="source"]',
          'select[id*="source" i]'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            AutofillEngine.setSelectValue(el, value);
            return true;
          }
        }
        return false;
      }
    },

    // Date helpers for Workday
    dateHelpers: {
      // Get current date in Workday format (MM/DD/YYYY)
      today() {
        const now = new Date();
        return `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`;
      },

      // Get date N months from now
      futureDate(months) {
        const date = new Date();
        date.setMonth(date.getMonth() + months);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
      },

      // Parse a date from Workday's format
      parse(dateStr) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        }
        return null;
      }
    },

    // Handle "Add Another" sections (work experience, education)
    addAnotherHandlers: {
      // Delete all "Add Another" items except first
      async cleanupExtraItems(sectionId) {
        const section = document.querySelector(`[data-automation-id="${sectionId}"]`) ||
                       document.querySelector(`[id*="${sectionId}" i]`);
        if (!section) return 0;

        let deleted = 0;
        const deleteButtons = section.querySelectorAll('[data-automation-id="delete"]');
        
        // Click delete buttons in reverse order (skip first)
        for (let i = deleteButtons.length - 1; i >= 1; i--) {
          deleteButtons[i].click();
          await new Promise(r => setTimeout(r, 200));
          deleted++;
        }
        
        return deleted;
      },

      // Add a new item
      async addItem(sectionId) {
        const addButton = document.querySelector(`[data-automation-id="Add Another"]`);
        if (addButton) {
          addButton.click();
          await new Promise(r => setTimeout(r, 300));
          return true;
        }
        return false;
      }
    },

    // Error handling for required fields
    requiredFieldHandlers: {
      // Common required field errors and fixes
      fixes: {
        'school': () => AutofillEngine.setTextValue(
          document.querySelector('[data-automation-id="school"]'),
          'University'
        ),
        'from': () => {
          const fromField = document.querySelector('[data-automation-id="startDate"]') ||
                           document.querySelector('[data-automation-id="fromDate"]');
          if (fromField) AutofillEngine.setTextValue(fromField, '01/2020');
          return !!fromField;
        },
        'to': () => {
          const toField = document.querySelector('[data-automation-id="endDate"]') ||
                         document.querySelector('[data-automation-id="toDate"]');
          if (toField) AutofillEngine.setTextValue(toField, '12/2024');
          return !!toField;
        }
      },

      // Try to fix a specific error
      tryFix(errorMessage) {
        const lowerError = errorMessage.toLowerCase();
        for (const [key, fixer] of Object.entries(this.fixes)) {
          if (lowerError.includes(key)) {
            try {
              return fixer();
            } catch (e) {
              console.warn('[WorkdayPages] Fix failed for:', key, e);
            }
          }
        }
        return false;
      },

      // Try to fix all errors
      tryFixAll(errors) {
        let fixed = 0;
        for (const error of errors) {
          if (this.tryFix(error)) fixed++;
        }
        return fixed;
      }
    },

    // Checkbox handlers for consent/terms
    checkboxHandlers: {
      // Check all consent boxes
      checkAllConsent() {
        const consentSelectors = [
          '[data-automation-id="legalTermsCheckbox"]',
          '[data-automation-id="consent"]',
          'input[type="checkbox"][id*="consent" i]',
          'input[type="checkbox"][id*="terms" i]',
          'input[type="checkbox"][id*="agree" i]'
        ];

        let checked = 0;
        for (const sel of consentSelectors) {
          const checkboxes = document.querySelectorAll(sel);
          for (const cb of checkboxes) {
            if (!cb.checked && cb.offsetParent !== null) {
              cb.click();
              checked++;
            }
          }
        }
        return checked;
      }
    },

    // Upload helpers
    uploadHelpers: {
      // Find resume upload area
      findResumeUpload() {
        const selectors = [
          '[data-automation-id="resumeOrCV"]',
          '[data-automation-id="uploadFileSection"]',
          '[data-automation-id="file-upload-drop-zone"]',
          'input[type="file"][accept*="pdf"]'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el;
        }
        // Look for file input in resume section
        const resumeSection = document.querySelector('[aria-label*="resume" i]') ||
                              document.querySelector('[aria-label*="cv" i]');
        if (resumeSection) {
          return resumeSection.querySelector('input[type="file"]');
        }
        return null;
      },

      // Click "Upload" button to reveal file input
      clickUploadButton() {
        const uploadButtons = document.querySelectorAll('[data-automation-id="file-upload-input-ref"]');
        for (const btn of uploadButtons) {
          if (btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        }
        // Fallback
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.toLowerCase().includes('upload')) {
            btn.click();
            return true;
          }
        }
        return false;
      },

      // Delete existing resume
      deleteExistingResume() {
        const deleteButtons = document.querySelectorAll('[data-automation-id="delete"]');
        for (const btn of deleteButtons) {
          const parent = btn.closest('[data-automation-id="resumeOrCV"]') ||
                        btn.closest('[aria-label*="resume" i]');
          if (parent && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        }
        return false;
      }
    }
  };

  // Export
  global.WorkdayPages = WorkdayPages;
  global.POWER2_WorkdayPages = WorkdayPages;

})(typeof window !== 'undefined' ? window : this);
