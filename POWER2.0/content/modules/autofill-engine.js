// autofill-engine.js - Universal form autofill with saved responses
(function(global) {
  'use strict';

  global.AutofillEngine = {
    profile: null,
    savedResponses: {},

    async loadProfile() {
      return new Promise(resolve => {
        chrome.storage.sync.get(['profile', 'savedResponses'], result => {
          this.profile = result.profile || {};
          this.savedResponses = result.savedResponses || {};
          resolve(this.profile);
        });
      });
    },

    async autofill(options = {}) {
      console.log('[AutofillEngine] Starting autofill...');
      if (!this.profile) await this.loadProfile();
      
      const filled = {
        name: this.fillName(),
        email: this.fillEmail(),
        phone: this.fillPhone(),
        location: this.fillLocation(),
        links: this.fillLinks(),
        questions: options.includeQuestions ? this.fillQuestions() : 0
      };
      console.log('[AutofillEngine] Filled:', filled);
      return filled;
    },

    fillName() {
      let count = 0;
      const nameParts = (this.profile.name || '').split(' ');
      
      document.querySelectorAll('input[name*="name" i], input[id*="name" i], input[autocomplete="name"]').forEach(input => {
        if (this.setInputValue(input, this.profile.name)) count++;
      });
      document.querySelectorAll('input[name*="first" i], input[id*="first" i], input[autocomplete="given-name"]').forEach(input => {
        if (this.setInputValue(input, nameParts[0])) count++;
      });
      document.querySelectorAll('input[name*="last" i], input[id*="last" i], input[autocomplete="family-name"]').forEach(input => {
        if (this.setInputValue(input, nameParts.slice(1).join(' '))) count++;
      });
      return count;
    },

    fillEmail() {
      let count = 0;
      document.querySelectorAll('input[type="email"], input[name*="email" i], input[id*="email" i], [data-automation-id*="email"]').forEach(input => {
        if (this.setInputValue(input, this.profile.email)) count++;
      });
      return count;
    },

    fillPhone() {
      let count = 0;
      document.querySelectorAll('input[type="tel"], input[name*="phone" i], input[id*="phone" i], [data-automation-id*="phone"]').forEach(input => {
        if (this.setInputValue(input, this.profile.phone)) count++;
      });
      return count;
    },

    fillLocation() {
      let count = 0;
      document.querySelectorAll('input[name*="location" i], input[name*="city" i], input[name*="address" i], [data-automation-id*="address"]').forEach(input => {
        if (this.setInputValue(input, this.profile.location)) count++;
      });
      return count;
    },

    fillLinks() {
      let count = 0;
      document.querySelectorAll('input[name*="linkedin" i], input[id*="linkedin" i]').forEach(input => {
        if (this.setInputValue(input, this.profile.linkedIn)) count++;
      });
      document.querySelectorAll('input[name*="github" i], input[id*="github" i]').forEach(input => {
        if (this.setInputValue(input, this.profile.github)) count++;
      });
      document.querySelectorAll('input[name*="portfolio" i], input[name*="website" i]').forEach(input => {
        if (this.setInputValue(input, this.profile.portfolio || this.profile.website)) count++;
      });
      return count;
    },

    fillQuestions() {
      let count = 0;
      document.querySelectorAll('[class*="question"], [class*="field-group"], [data-automation-id*="question"]').forEach(container => {
        const label = container.querySelector('label, [class*="label"]');
        const input = container.querySelector('input, textarea, select');
        if (label && input) {
          const questionText = label.textContent?.trim().toLowerCase();
          const savedAnswer = this.findSavedResponse(questionText);
          if (savedAnswer && this.setInputValue(input, savedAnswer)) count++;
        }
      });
      return count;
    },

    findSavedResponse(questionText) {
      if (!questionText) return null;
      const normalized = questionText.replace(/[^a-z0-9\s]/g, '').trim();
      for (const [key, value] of Object.entries(this.savedResponses)) {
        const keyNorm = key.replace(/[^a-z0-9\s]/g, '').trim();
        if (normalized.includes(keyNorm) || keyNorm.includes(normalized)) return value;
      }
      return null;
    },

    setInputValue(input, value) {
      if (!input || !value || input.value?.trim()) return false;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    },

    saveResponse(question, answer) {
      if (!question || !answer) return;
      this.savedResponses[question.toLowerCase().trim()] = answer;
      chrome.storage.sync.set({ savedResponses: this.savedResponses });
    }
  };
})(typeof window !== 'undefined' ? window : global);
