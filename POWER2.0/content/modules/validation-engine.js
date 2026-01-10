// validation-engine.js - Form validation and error detection
(function(global) {
  'use strict';
  global.ValidationEngine = {
    hasErrors(container = document) {
      const selectors = ['[class*="error"]:not([class*="no-error"])', '[class*="invalid"]', '[aria-invalid="true"]', '[data-automation-id*="error"]'];
      for (const sel of selectors) {
        const errors = container.querySelectorAll(sel);
        for (const err of errors) if (err.textContent?.trim() && err.offsetParent !== null) return true;
      }
      return false;
    },
    getErrorMessages(container = document) {
      const messages = [];
      container.querySelectorAll('[class*="error"], [class*="invalid"], [role="alert"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 200 && el.offsetParent !== null) messages.push(text);
      });
      return [...new Set(messages)];
    },
    hasWorkdayErrors() {
      const errorBanner = document.querySelector('[data-automation-id="errorBanner"]');
      if (errorBanner?.textContent?.trim()) return true;
      const fieldErrors = document.querySelectorAll('[data-automation-id*="error"], [class*="error-message"]');
      for (const err of fieldErrors) if (err.textContent?.includes('required')) return true;
      return false;
    }
  };
})(typeof window !== 'undefined' ? window : global);
