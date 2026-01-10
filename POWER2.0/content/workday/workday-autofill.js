// workday-autofill.js - POWER2.0 Workday-Specific Autofill
// Specialized autofill for Workday's unique field patterns
// Handles data-automation-id attributes and complex dropdowns

(function(global) {
  'use strict';

  const WorkdayAutofill = {
    // Workday field mappings (data-automation-id -> profile field)
    fieldMappings: {
      // Personal Info
      'firstName': 'firstName',
      'lastName': 'lastName',
      'email': 'email',
      'phone-number': 'phone',
      'phoneNumber': 'phone',
      'addressLine1': 'address',
      'city': 'city',
      'postalCode': 'zipCode',
      
      // Links
      'linkedin': 'linkedin',
      'linkedIn': 'linkedin',
      'portfolio': 'portfolio',
      'website': 'portfolio',
      
      // Experience
      'company': 'experience.company',
      'jobTitle': 'experience.title',
      'title': 'experience.title',
      
      // Education
      'school': 'education.school',
      'degree': 'education.degree',
      'field-of-study': 'education.major',
      'fieldOfStudy': 'education.major'
    },

    // Fill all Workday fields from profile
    async fillFromProfile(profile) {
      if (!profile) {
        profile = typeof ProfileStore !== 'undefined' ? ProfileStore.get() : {};
      }
      
      let filled = 0;
      
      // Fill by data-automation-id
      for (const [automationId, profilePath] of Object.entries(this.fieldMappings)) {
        const element = document.querySelector(`[data-automation-id="${automationId}"]`);
        if (!element) continue;
        
        const value = this.getProfileValue(profile, profilePath);
        if (!value) continue;
        
        if (this.fillElement(element, value)) {
          filled++;
        }
      }
      
      // Fill country dropdown
      this.fillCountryDropdown(profile.country || 'Ireland');
      
      // Fill phone type
      this.fillPhoneTypeDropdown('Mobile');
      
      console.log(`[WorkdayAutofill] Filled ${filled} fields`);
      return filled;
    },

    // Get nested profile value
    getProfileValue(profile, path) {
      const parts = path.split('.');
      let value = profile;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) return null;
      }
      return value;
    },

    // Fill an element with value
    fillElement(element, value) {
      const tagName = element.tagName?.toLowerCase();
      const type = element.type?.toLowerCase();
      
      if (tagName === 'select') {
        return this.fillDropdown(element, value);
      } else if (tagName === 'input' && (type === 'checkbox' || type === 'radio')) {
        return this.fillCheckbox(element, value);
      } else if (tagName === 'input' || tagName === 'textarea') {
        return this.fillTextInput(element, value);
      }
      
      return false;
    },

    // Fill text input with proper event firing
    fillTextInput(element, value) {
      try {
        element.focus();
        
        // Use native setter for React compatibility
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        
        if (nativeSetter) {
          nativeSetter.call(element, value);
        } else {
          element.value = value;
        }
        
        // Fire events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        
        return element.value === value;
      } catch (e) {
        console.warn('[WorkdayAutofill] fillTextInput error:', e);
        return false;
      }
    },

    // Fill Workday dropdown (complex multi-select widgets)
    fillDropdown(element, value) {
      // Try standard select
      if (element.tagName?.toLowerCase() === 'select') {
        const options = Array.from(element.options);
        const valueLower = value.toLowerCase();
        
        const option = options.find(o => 
          o.value.toLowerCase() === valueLower ||
          o.text.toLowerCase() === valueLower ||
          o.text.toLowerCase().includes(valueLower)
        );
        
        if (option) {
          element.value = option.value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      
      // Workday custom dropdown - click to open, then select option
      return this.fillWorkdayCustomDropdown(element, value);
    },

    // Fill Workday's custom dropdown widgets
    fillWorkdayCustomDropdown(container, value) {
      try {
        // Find the dropdown trigger
        const trigger = container.querySelector('[data-automation-id="promptOption"]') ||
                       container.querySelector('[data-automation-id="selectInputContainer"]') ||
                       container.querySelector('[role="combobox"]') ||
                       container;
        
        if (trigger) {
          trigger.click();
        }
        
        // Wait for dropdown to open
        setTimeout(() => {
          const valueLower = value.toLowerCase();
          
          // Find options
          const optionSelectors = [
            '[data-automation-id="promptOption"]',
            '[role="option"]',
            '[class*="option" i]'
          ];
          
          for (const sel of optionSelectors) {
            const options = document.querySelectorAll(sel);
            for (const option of options) {
              const optionText = option.textContent?.toLowerCase() || '';
              if (optionText.includes(valueLower) || valueLower.includes(optionText)) {
                option.click();
                return true;
              }
            }
          }
        }, 100);
        
        return false;
      } catch (e) {
        return false;
      }
    },

    // Fill checkbox
    fillCheckbox(element, checked) {
      const shouldBeChecked = checked === true || checked === 'true' || checked === 'yes';
      if (element.checked !== shouldBeChecked) {
        element.click();
      }
      return element.checked === shouldBeChecked;
    },

    // Fill country dropdown
    fillCountryDropdown(country = 'Ireland') {
      const selectors = [
        '[data-automation-id="countryDropdown"]',
        '[data-automation-id="country"]',
        '[data-automation-id="countryRegion"]'
      ];
      
      for (const sel of selectors) {
        const element = document.querySelector(sel);
        if (element) {
          this.fillDropdown(element, country);
          return true;
        }
      }
      return false;
    },

    // Fill phone type dropdown
    fillPhoneTypeDropdown(type = 'Mobile') {
      const selectors = [
        '[data-automation-id="phone-device-type"]',
        '[data-automation-id="phoneDeviceType"]'
      ];
      
      for (const sel of selectors) {
        const element = document.querySelector(sel);
        if (element) {
          this.fillDropdown(element, type);
          return true;
        }
      }
      return false;
    },

    // Fill work experience section
    async fillWorkExperience(experience) {
      if (!experience?.company) return false;
      
      let filled = 0;
      
      const company = document.querySelector('[data-automation-id="company"]');
      if (company) {
        this.fillTextInput(company, experience.company);
        filled++;
      }
      
      const title = document.querySelector('[data-automation-id="jobTitle"]') ||
                   document.querySelector('[data-automation-id="title"]');
      if (title) {
        this.fillTextInput(title, experience.title);
        filled++;
      }
      
      // Set current role checkbox
      const currentRole = document.querySelector('[data-automation-id="currentlyWorkHere"]') ||
                          document.querySelector('input[type="checkbox"][id*="current" i]');
      if (currentRole && experience.current) {
        this.fillCheckbox(currentRole, true);
        filled++;
      }
      
      return filled > 0;
    },

    // Fill education section
    async fillEducation(education) {
      if (!education?.school) return false;
      
      let filled = 0;
      
      const school = document.querySelector('[data-automation-id="school"]');
      if (school) {
        this.fillTextInput(school, education.school);
        filled++;
      }
      
      const degree = document.querySelector('[data-automation-id="degree"]');
      if (degree) {
        this.fillDropdown(degree, education.degree);
        filled++;
      }
      
      const major = document.querySelector('[data-automation-id="field-of-study"]') ||
                    document.querySelector('[data-automation-id="fieldOfStudy"]');
      if (major) {
        this.fillTextInput(major, education.major);
        filled++;
      }
      
      return filled > 0;
    },

    // Fill EEO/diversity section
    fillDiversity(profile) {
      let filled = 0;
      
      // Gender
      const gender = document.querySelector('[data-automation-id="gender"]');
      if (gender) {
        this.fillDropdown(gender, profile.gender || 'Prefer not to say');
        filled++;
      }
      
      // Ethnicity
      const ethnicity = document.querySelector('[data-automation-id="raceAndEthnicity"]') ||
                        document.querySelector('[data-automation-id="ethnicity"]');
      if (ethnicity) {
        this.fillDropdown(ethnicity, profile.ethnicity || 'Prefer not to say');
        filled++;
      }
      
      // Veteran status
      const veteran = document.querySelector('[data-automation-id="veteranStatus"]');
      if (veteran) {
        this.fillDropdown(veteran, profile.veteranStatus || 'I am not a protected veteran');
        filled++;
      }
      
      // Disability status
      const disability = document.querySelector('[data-automation-id="disabilityStatus"]');
      if (disability) {
        this.fillDropdown(disability, profile.disabilityStatus || 'I do not wish to answer');
        filled++;
      }
      
      return filled;
    },

    // Attach resume file
    async attachResume(file) {
      if (!file) return false;
      
      // Find file input
      const fileInput = document.querySelector('[data-automation-id="file-upload-input-ref"]') ||
                        document.querySelector('input[type="file"][accept*="pdf"]') ||
                        document.querySelector('input[type="file"]');
      
      if (!fileInput) {
        // Try clicking upload button first
        const uploadBtn = document.querySelector('[data-automation-id="file-upload-drop-zone"]');
        if (uploadBtn) uploadBtn.click();
        
        await new Promise(r => setTimeout(r, 300));
        
        // Try again
        const retryInput = document.querySelector('input[type="file"]');
        if (!retryInput) return false;
        
        return this.attachFileToInput(retryInput, file);
      }
      
      return this.attachFileToInput(fileInput, file);
    },

    // Attach file to input
    attachFileToInput(input, file) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        return input.files.length > 0;
      } catch (e) {
        console.error('[WorkdayAutofill] attachFile error:', e);
        return false;
      }
    },

    // Full Workday page autofill
    async fullPageAutofill(profile, options = {}) {
      const result = {
        personalFields: await this.fillFromProfile(profile),
        experience: 0,
        education: 0,
        diversity: 0
      };
      
      if (profile.experience && !options.skipExperience) {
        result.experience = await this.fillWorkExperience(profile.experience);
      }
      
      if (profile.education && !options.skipEducation) {
        result.education = await this.fillEducation(profile.education);
      }
      
      if (!options.skipDiversity) {
        result.diversity = this.fillDiversity(profile);
      }
      
      const total = result.personalFields + result.experience + result.education + result.diversity;
      console.log(`[WorkdayAutofill] Full page autofill complete: ${total} fields`);
      
      return result;
    }
  };

  // Export
  global.WorkdayAutofill = WorkdayAutofill;
  global.POWER2_WorkdayAutofill = WorkdayAutofill;

})(typeof window !== 'undefined' ? window : this);
