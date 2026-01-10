// autofill-engine.js - POWER2.0 Universal Autofill Engine
// Fast, reliable autofill across all ATS platforms
// Inspired by Jobright's autofill approach with enhanced reliability

(function(global) {
  'use strict';

  const AutofillEngine = {
    // Configuration
    config: {
      humanTypingDelay: false, // Set true for more human-like behavior
      typingDelayMs: 10,
      validateAfterFill: true,
      retryOnFailure: true,
      maxRetries: 2
    },

    // Statistics
    stats: {
      fieldsAttempted: 0,
      fieldsSucceeded: 0,
      fieldsFailed: 0
    },

    // Fire necessary events for field
    fireEvents(element, value) {
      // Focus
      element.focus();
      element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      
      // Input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Keyboard events for React/Vue compatibility
      if (value) {
        element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      }
      
      // Blur
      element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    },

    // Set value on a text input/textarea
    setTextValue(element, value) {
      if (!element || !value) return false;
      
      try {
        // Try native value setter first (works for React)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        
        if (element.tagName === 'TEXTAREA' && nativeTextareaValueSetter) {
          nativeTextareaValueSetter.call(element, value);
        } else if (nativeInputValueSetter) {
          nativeInputValueSetter.call(element, value);
        } else {
          element.value = value;
        }
        
        this.fireEvents(element, value);
        return element.value === value;
      } catch (e) {
        console.warn('[AutofillEngine] setTextValue error:', e);
        element.value = value;
        this.fireEvents(element, value);
        return element.value === value;
      }
    },

    // Set value on a select dropdown
    setSelectValue(element, value) {
      if (!element) return false;
      
      try {
        const options = Array.from(element.options);
        const valueLower = (value || '').toLowerCase();
        
        // Try exact match first
        let option = options.find(o => o.value.toLowerCase() === valueLower);
        
        // Try text match
        if (!option) {
          option = options.find(o => o.text.toLowerCase() === valueLower);
        }
        
        // Try partial match
        if (!option) {
          option = options.find(o => 
            o.text.toLowerCase().includes(valueLower) || 
            valueLower.includes(o.text.toLowerCase())
          );
        }
        
        // Try "Yes" for boolean-like questions
        if (!option && (valueLower === 'yes' || valueLower === 'true')) {
          option = options.find(o => 
            o.text.toLowerCase().includes('yes') || 
            o.value.toLowerCase() === 'yes' ||
            o.value === '1' || o.value === 'true'
          );
        }
        
        if (option) {
          element.value = option.value;
          this.fireEvents(element, option.value);
          return true;
        }
        
        return false;
      } catch (e) {
        console.warn('[AutofillEngine] setSelectValue error:', e);
        return false;
      }
    },

    // Set checkbox/radio value
    setCheckboxValue(element, checked) {
      if (!element) return false;
      
      try {
        if (element.checked !== checked) {
          element.checked = checked;
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('click', { bubbles: true }));
        }
        return element.checked === checked;
      } catch (e) {
        return false;
      }
    },

    // Attach file to input
    attachFile(input, file) {
      if (!input || !file) return false;
      
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        this.fireEvents(input, file.name);
        return input.files.length > 0;
      } catch (e) {
        console.warn('[AutofillEngine] attachFile error:', e);
        return false;
      }
    },

    // Fill a single field with appropriate value
    fillField(element, value) {
      if (!element || !value) return false;
      
      this.stats.fieldsAttempted++;
      let success = false;
      
      const tagName = element.tagName?.toLowerCase();
      const type = element.type?.toLowerCase();
      
      if (tagName === 'select') {
        success = this.setSelectValue(element, value);
      } else if (type === 'checkbox' || type === 'radio') {
        success = this.setCheckboxValue(element, value === true || value === 'true' || value === 'yes');
      } else if (type === 'file') {
        // File inputs need File object
        console.warn('[AutofillEngine] Use attachFile() for file inputs');
        return false;
      } else {
        success = this.setTextValue(element, value);
      }
      
      if (success) {
        this.stats.fieldsSucceeded++;
      } else {
        this.stats.fieldsFailed++;
      }
      
      return success;
    },

    // Fill all detected fields with profile data
    async fillFromProfile(profile) {
      if (!profile) {
        if (typeof ProfileStore !== 'undefined') {
          profile = await ProfileStore.load();
        } else {
          console.warn('[AutofillEngine] No profile provided and ProfileStore not available');
          return { success: false, filled: 0 };
        }
      }
      
      const fields = FieldDetector.findAllFields();
      let filled = 0;
      
      const fieldMapping = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName || `${profile.firstName} ${profile.lastName}`.trim(),
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zipCode: profile.zipCode,
        country: profile.country,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio,
        twitter: profile.twitter,
        company: profile.currentCompany,
        title: profile.title,
        experience: profile.yearsOfExperience
      };
      
      for (const [fieldType, elements] of fields) {
        const value = fieldMapping[fieldType];
        if (value && elements.length > 0) {
          for (const element of elements) {
            if (this.fillField(element, value)) {
              filled++;
              break; // Only fill first matching element
            }
          }
        }
      }
      
      console.log(`[AutofillEngine] Filled ${filled} fields from profile`);
      return { success: true, filled };
    },

    // Fill work authorization questions
    fillWorkAuth(profile) {
      const fields = FieldDetector.findAllFields();
      let filled = 0;
      
      // Work authorization
      if (fields.has('workAuth')) {
        for (const el of fields.get('workAuth')) {
          if (this.fillField(el, profile.workAuthorization === 'authorized' ? 'yes' : 'no')) {
            filled++;
            break;
          }
        }
      }
      
      // Sponsorship
      if (fields.has('sponsorship')) {
        for (const el of fields.get('sponsorship')) {
          if (this.fillField(el, profile.requiresSponsorship ? 'yes' : 'no')) {
            filled++;
            break;
          }
        }
      }
      
      return filled;
    },

    // Fill EEO/diversity questions
    fillDiversity(profile) {
      const fields = FieldDetector.findAllFields();
      let filled = 0;
      
      const diversityFields = ['gender', 'ethnicity', 'veteran', 'disability'];
      
      for (const fieldType of diversityFields) {
        if (fields.has(fieldType)) {
          for (const el of fields.get(fieldType)) {
            const value = profile[fieldType + 'Status'] || profile[fieldType] || 'prefer_not_to_say';
            if (this.fillField(el, value)) {
              filled++;
              break;
            }
          }
        }
      }
      
      return filled;
    },

    // Full autofill: profile + work auth + diversity
    async fullAutofill(profile) {
      const results = {
        profile: await this.fillFromProfile(profile),
        workAuth: this.fillWorkAuth(profile || ProfileStore.get()),
        diversity: this.fillDiversity(profile || ProfileStore.get())
      };
      
      const totalFilled = results.profile.filled + results.workAuth + results.diversity;
      console.log(`[AutofillEngine] Full autofill complete: ${totalFilled} fields`);
      
      return {
        success: true,
        totalFilled,
        details: results
      };
    },

    // Answer screening questions from saved responses
    async answerScreeningQuestions() {
      if (typeof ProfileStore === 'undefined') return { filled: 0 };
      
      const profile = ProfileStore.get();
      let filled = 0;
      
      // Find all question-like labels
      const questions = document.querySelectorAll('label, legend, .question-label, [class*="question"]');
      
      for (const questionEl of questions) {
        const questionText = questionEl.textContent?.trim();
        if (!questionText || questionText.length > 200) continue;
        
        const savedAnswer = ProfileStore.getResponse(questionText);
        if (!savedAnswer) continue;
        
        // Find associated input
        const container = questionEl.closest('fieldset, .field, .form-group, [class*="question"]') || questionEl.parentElement;
        if (!container) continue;
        
        const input = container.querySelector('input, textarea, select');
        if (input && this.fillField(input, savedAnswer)) {
          filled++;
        }
      }
      
      return { filled };
    },

    // Reset statistics
    resetStats() {
      this.stats = {
        fieldsAttempted: 0,
        fieldsSucceeded: 0,
        fieldsFailed: 0
      };
    }
  };

  // Export
  global.AutofillEngine = AutofillEngine;
  global.POWER2_AutofillEngine = AutofillEngine;

})(typeof window !== 'undefined' ? window : this);
