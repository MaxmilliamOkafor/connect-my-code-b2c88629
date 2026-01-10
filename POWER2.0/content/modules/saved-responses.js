// saved-responses.js - Question/Answer memory for screening questions
(function(global) {
  'use strict';

  global.SavedResponses = {
    responses: {},
    loaded: false,

    async load() {
      if (this.loaded) return this.responses;
      return new Promise(resolve => {
        chrome.storage.sync.get(['savedResponses'], result => {
          this.responses = result.savedResponses || {};
          this.loaded = true;
          console.log(`[SavedResponses] Loaded ${Object.keys(this.responses).length} responses`);
          resolve(this.responses);
        });
      });
    },

    normalize(text) {
      return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    },

    find(questionText) {
      const normalized = this.normalize(questionText);
      if (!normalized) return null;
      
      // Exact match
      if (this.responses[normalized]) return this.responses[normalized];
      
      // Partial match
      for (const [key, value] of Object.entries(this.responses)) {
        if (normalized.includes(key) || key.includes(normalized)) return value;
      }
      
      // Keyword match for common questions
      const patterns = {
        'authorized to work': this.responses['work authorization'] || this.responses['authorized'],
        'require sponsorship': this.responses['sponsorship'] || this.responses['visa'],
        'years of experience': this.responses['experience years'] || this.responses['years experience'],
        'salary expectation': this.responses['salary'] || this.responses['compensation'],
        'start date': this.responses['start'] || this.responses['availability'],
        'hear about': this.responses['hear about'] || this.responses['source'],
        'gender': this.responses['gender'],
        'race': this.responses['race'] || this.responses['ethnicity'],
        'veteran': this.responses['veteran'],
        'disability': this.responses['disability']
      };
      
      for (const [pattern, value] of Object.entries(patterns)) {
        if (normalized.includes(pattern) && value) return value;
      }
      
      return null;
    },

    save(questionText, answer) {
      if (!questionText || !answer) return;
      const normalized = this.normalize(questionText);
      this.responses[normalized] = answer;
      chrome.storage.sync.set({ savedResponses: this.responses });
      console.log(`[SavedResponses] Saved: "${normalized.substring(0, 50)}..." = "${answer.substring(0, 30)}..."`);
    },

    async autofillScreeningQuestions() {
      await this.load();
      let filled = 0;
      
      // Find all question containers
      const containers = document.querySelectorAll(
        '[data-automation-id*="question"], [class*="question"], [class*="screening"], fieldset, .form-group'
      );
      
      containers.forEach(container => {
        const label = container.querySelector('label, legend, [class*="label"], [class*="question-text"]');
        const input = container.querySelector('input:not([type="hidden"]), textarea, select');
        
        if (!label || !input || input.value?.trim()) return;
        
        const questionText = label.textContent?.trim();
        const savedAnswer = this.find(questionText);
        
        if (savedAnswer) {
          if (input.tagName === 'SELECT') {
            this.selectOption(input, savedAnswer);
          } else if (input.type === 'radio' || input.type === 'checkbox') {
            this.selectRadioOrCheckbox(container, savedAnswer);
          } else {
            input.value = savedAnswer;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          filled++;
          console.log(`[SavedResponses] Filled: "${questionText.substring(0, 40)}..."`);
        }
      });
      
      return filled;
    },

    selectOption(select, value) {
      const valueLower = value.toLowerCase();
      for (const option of select.options) {
        if (option.text.toLowerCase().includes(valueLower) || option.value.toLowerCase().includes(valueLower)) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    },

    selectRadioOrCheckbox(container, value) {
      const valueLower = value.toLowerCase();
      const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      
      inputs.forEach(input => {
        const label = container.querySelector(`label[for="${input.id}"]`) || input.closest('label');
        const labelText = label?.textContent?.toLowerCase() || '';
        
        if (labelText.includes(valueLower) || input.value.toLowerCase() === valueLower) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    },

    // Capture user responses for learning
    observeAndLearn() {
      document.addEventListener('change', (e) => {
        const target = e.target;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
        
        const container = target.closest('[class*="question"], [class*="field-group"], fieldset, .form-group');
        if (!container) return;
        
        const label = container.querySelector('label, legend, [class*="label"]');
        if (!label) return;
        
        const questionText = label.textContent?.trim();
        const answer = target.type === 'checkbox' || target.type === 'radio' 
          ? (target.checked ? (container.querySelector(`label[for="${target.id}"]`)?.textContent?.trim() || target.value) : null)
          : target.value;
        
        if (questionText && answer) {
          this.save(questionText, answer);
        }
      });
    }
  };

  // Auto-start observer
  if (typeof window !== 'undefined') {
    global.SavedResponses.observeAndLearn();
  }
})(typeof window !== 'undefined' ? window : global);
