// field-detector.js - POWER2.0 Universal Field Detection
// Detects form fields across all ATS platforms with pattern matching
// Inspired by Jobright's comprehensive field detection

(function(global) {
  'use strict';

  const FieldDetector = {
    // Field type patterns for detection
    patterns: {
      // Personal Info
      firstName: /(first\s*name|given\s*name|forename|fname)/i,
      lastName: /(last\s*name|family\s*name|surname|lname)/i,
      fullName: /(full\s*name|your\s*name|name\s*$|^name$)/i,
      email: /(e-?mail|email\s*address)/i,
      phone: /(phone|mobile|cell|telephone|contact\s*number)/i,
      
      // Address
      address: /(street\s*address|address\s*line|mailing\s*address|home\s*address)/i,
      city: /(city|town|municipality)/i,
      state: /(state|province|region)/i,
      zipCode: /(zip|postal\s*code|postcode)/i,
      country: /(country|nation)/i,
      
      // Links
      linkedin: /(linkedin|linked\s*in)/i,
      github: /(github|git\s*hub)/i,
      portfolio: /(portfolio|personal\s*website|website|blog)/i,
      twitter: /(twitter|x\.com)/i,
      
      // Professional
      company: /(current\s*company|company\s*name|employer|organization)/i,
      title: /(job\s*title|current\s*title|position|role)/i,
      experience: /(years?\s*of\s*experience|experience\s*years?|yoe)/i,
      
      // Documents
      resume: /(resume|cv|curriculum\s*vitae)/i,
      coverLetter: /(cover\s*letter|covering\s*letter|motivation\s*letter)/i,
      
      // EEO/Diversity
      gender: /(gender|sex)/i,
      ethnicity: /(ethnicity|race|ethnic\s*background)/i,
      veteran: /(veteran|military\s*service|armed\s*forces)/i,
      disability: /(disability|disabled|handicap|impairment)/i,
      
      // Work Authorization
      workAuth: /(work\s*authorization|authorized\s*to\s*work|legally\s*authorized|right\s*to\s*work)/i,
      sponsorship: /(sponsorship|visa\s*sponsorship|require\s*sponsorship|need\s*sponsorship)/i,
      
      // Salary & Availability
      salary: /(salary|compensation|pay|expected\s*salary|desired\s*salary)/i,
      startDate: /(start\s*date|availability|when\s*can\s*you\s*start|available\s*to\s*start)/i,
      noticePeriod: /(notice\s*period|current\s*notice|notice\s*required)/i,
      
      // Education
      school: /(school|university|college|institution|alma\s*mater)/i,
      degree: /(degree|qualification|diploma)/i,
      major: /(major|field\s*of\s*study|concentration|specialization)/i,
      graduationYear: /(graduation|graduated|grad\s*year|completion\s*year)/i,
      gpa: /(gpa|grade\s*point|grades?)/i,
      
      // Skills
      skills: /(skills?|competencies|proficiencies|technologies)/i,
      
      // Relocation
      relocation: /(relocation|willing\s*to\s*relocate|open\s*to\s*relocation)/i,
      remoteWork: /(remote\s*work|work\s*from\s*home|wfh|hybrid)/i
    },

    // Get all text associated with an element
    getElementContext(element) {
      const parts = [];
      
      // Element's own attributes
      parts.push(element.name || '');
      parts.push(element.id || '');
      parts.push(element.placeholder || '');
      parts.push(element.getAttribute('aria-label') || '');
      parts.push(element.getAttribute('data-qa') || '');
      parts.push(element.getAttribute('data-automation-id') || '');
      parts.push(element.getAttribute('data-testid') || '');
      
      // Associated label
      if (element.labels?.[0]) {
        parts.push(element.labels[0].textContent || '');
      }
      
      // Label via for attribute
      if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) parts.push(label.textContent || '');
      }
      
      // Closest label
      const closestLabel = element.closest('label');
      if (closestLabel) {
        parts.push(closestLabel.textContent || '');
      }
      
      // Parent context (up to 3 levels, limited text)
      let parent = element.parentElement;
      for (let i = 0; i < 3 && parent; i++) {
        const parentText = parent.textContent?.substring(0, 100) || '';
        parts.push(parentText);
        parent = parent.parentElement;
      }
      
      return parts.join(' ').toLowerCase();
    },

    // Detect field type from element
    detectFieldType(element) {
      const context = this.getElementContext(element);
      const type = element.type?.toLowerCase() || '';
      
      // Check HTML5 input types first
      if (type === 'email') return 'email';
      if (type === 'tel') return 'phone';
      if (type === 'url' && context.includes('linkedin')) return 'linkedin';
      if (type === 'url' && context.includes('github')) return 'github';
      if (type === 'url') return 'portfolio';
      if (type === 'file') {
        if (this.patterns.coverLetter.test(context) && !this.patterns.resume.test(context)) {
          return 'coverLetter';
        }
        return 'resume';
      }
      
      // Pattern matching
      for (const [fieldType, pattern] of Object.entries(this.patterns)) {
        if (pattern.test(context)) {
          return fieldType;
        }
      }
      
      return null;
    },

    // Is this a CV/Resume field?
    isCVField(element) {
      const context = this.getElementContext(element);
      return this.patterns.resume.test(context) && !this.patterns.coverLetter.test(context);
    },

    // Is this a Cover Letter field?
    isCoverLetterField(element) {
      const context = this.getElementContext(element);
      return this.patterns.coverLetter.test(context);
    },

    // Find all form fields on page
    findAllFields() {
      const fields = new Map();
      
      // Text inputs
      document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type])').forEach(input => {
        const fieldType = this.detectFieldType(input);
        if (fieldType) {
          if (!fields.has(fieldType)) fields.set(fieldType, []);
          fields.get(fieldType).push(input);
        }
      });
      
      // Textareas
      document.querySelectorAll('textarea').forEach(textarea => {
        const fieldType = this.detectFieldType(textarea);
        if (fieldType) {
          if (!fields.has(fieldType)) fields.set(fieldType, []);
          fields.get(fieldType).push(textarea);
        }
      });
      
      // Selects
      document.querySelectorAll('select').forEach(select => {
        const fieldType = this.detectFieldType(select);
        if (fieldType) {
          if (!fields.has(fieldType)) fields.set(fieldType, []);
          fields.get(fieldType).push(select);
        }
      });
      
      // File inputs
      document.querySelectorAll('input[type="file"]').forEach(input => {
        const fieldType = this.detectFieldType(input);
        if (fieldType) {
          if (!fields.has(fieldType)) fields.set(fieldType, []);
          fields.get(fieldType).push(input);
        }
      });
      
      // Checkboxes and radios (for yes/no questions)
      document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
        const fieldType = this.detectFieldType(input);
        if (fieldType) {
          if (!fields.has(fieldType)) fields.set(fieldType, []);
          fields.get(fieldType).push(input);
        }
      });
      
      return fields;
    },

    // Find CV/Resume upload field
    findResumeField() {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      for (const input of fileInputs) {
        if (this.isCVField(input)) return input;
      }
      // Fallback: first file input
      return fileInputs[0] || null;
    },

    // Find Cover Letter upload field
    findCoverLetterField() {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      for (const input of fileInputs) {
        if (this.isCoverLetterField(input)) return input;
      }
      return null;
    },

    // Check if page has required field errors
    hasRequiredFieldErrors() {
      // Common error patterns
      const errorSelectors = [
        '[class*="error"]:not([style*="display: none"])',
        '[class*="invalid"]:not([style*="display: none"])',
        '[aria-invalid="true"]',
        '.validation-error',
        '.field-error',
        '[data-automation-id*="error"]'
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

    // Get all visible error messages
    getErrorMessages() {
      const messages = [];
      const errorSelectors = [
        '[class*="error"]:not([style*="display: none"])',
        '[aria-invalid="true"] ~ [class*="message"]',
        '.validation-error',
        '.field-error'
      ];
      
      for (const selector of errorSelectors) {
        document.querySelectorAll(selector).forEach(el => {
          if (el.offsetParent !== null && el.textContent?.trim()) {
            messages.push(el.textContent.trim());
          }
        });
      }
      
      return [...new Set(messages)];
    }
  };

  // Export
  global.FieldDetector = FieldDetector;
  global.POWER2_FieldDetector = FieldDetector;

})(typeof window !== 'undefined' ? window : this);
