// profile-store.js - POWER2.0 Profile Management
// Unified profile storage for autofill across all platforms
// Emulates Jobright's profile approach with enhanced structure

(function(global) {
  'use strict';

  const ProfileStore = {
    // Default profile structure
    defaultProfile: {
      // Personal Info
      firstName: '',
      lastName: '',
      fullName: '',
      email: '',
      phone: '',
      
      // Location
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      location: '', // Combined location string
      
      // Professional Links
      linkedin: '',
      github: '',
      portfolio: '',
      website: '',
      twitter: '',
      
      // Professional Info
      headline: '',
      title: '',
      yearsOfExperience: '',
      currentCompany: '',
      
      // Work Authorization
      workAuthorization: 'authorized', // authorized, sponsorship_required, citizen
      requiresSponsorship: false,
      veteranStatus: 'not_veteran',
      disabilityStatus: 'prefer_not_to_say',
      gender: 'prefer_not_to_say',
      ethnicity: 'prefer_not_to_say',
      
      // Education (most recent)
      education: {
        school: '',
        degree: '',
        major: '',
        graduationYear: '',
        gpa: ''
      },
      
      // Experience (most recent, for quick autofill)
      experience: {
        company: '',
        title: '',
        startDate: '',
        endDate: '',
        current: true,
        description: ''
      },
      
      // Skills
      skills: [],
      
      // Screening Question Defaults
      expectedSalary: '',
      noticePeriod: '',
      willingToRelocate: true,
      remotePreference: 'hybrid', // remote, hybrid, onsite
      
      // Saved Responses (question -> answer mapping)
      savedResponses: {}
    },

    // Current profile in memory
    _profile: null,

    // Load profile from storage
    async load() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['power2_profile'], (result) => {
          this._profile = { ...this.defaultProfile, ...(result.power2_profile || {}) };
          
          // Also check legacy ats_profile for migration
          chrome.storage.local.get(['ats_profile'], (localResult) => {
            if (localResult.ats_profile && !result.power2_profile) {
              // Migrate from ats_profile
              this._profile = { ...this._profile, ...this.migrateFromATS(localResult.ats_profile) };
              this.save();
            }
            resolve(this._profile);
          });
        });
      });
    },

    // Save profile to storage
    async save() {
      return new Promise((resolve) => {
        chrome.storage.sync.set({ power2_profile: this._profile }, resolve);
      });
    },

    // Get current profile (sync)
    get() {
      return this._profile || this.defaultProfile;
    },

    // Update profile fields
    async update(updates) {
      if (!this._profile) await this.load();
      this._profile = { ...this._profile, ...updates };
      
      // Auto-generate fullName if firstName/lastName updated
      if (updates.firstName || updates.lastName) {
        this._profile.fullName = `${this._profile.firstName} ${this._profile.lastName}`.trim();
      }
      
      await this.save();
      return this._profile;
    },

    // Migrate from legacy ats_profile format
    migrateFromATS(atsProfile) {
      return {
        firstName: atsProfile.firstName || atsProfile.first_name || '',
        lastName: atsProfile.lastName || atsProfile.last_name || '',
        email: atsProfile.email || '',
        phone: atsProfile.phone || '',
        city: atsProfile.city || atsProfile.location || '',
        linkedin: atsProfile.linkedin || '',
        github: atsProfile.github || '',
        portfolio: atsProfile.portfolio || ''
      };
    },

    // Get value for a field (with aliases)
    getField(fieldName) {
      const profile = this.get();
      const aliases = {
        'first_name': 'firstName',
        'last_name': 'lastName',
        'full_name': 'fullName',
        'name': 'fullName',
        'email_address': 'email',
        'phone_number': 'phone',
        'mobile': 'phone',
        'cell': 'phone',
        'linkedin_url': 'linkedin',
        'github_url': 'github',
        'portfolio_url': 'portfolio',
        'zip': 'zipCode',
        'postal_code': 'zipCode',
        'postal': 'zipCode'
      };
      
      const normalizedField = fieldName.toLowerCase().replace(/[^a-z_]/g, '_');
      const actualField = aliases[normalizedField] || normalizedField;
      
      // Handle nested fields
      if (actualField.includes('.')) {
        const parts = actualField.split('.');
        let value = profile;
        for (const part of parts) {
          value = value?.[part];
        }
        return value || '';
      }
      
      return profile[actualField] || '';
    },

    // Save a response for a question
    async saveResponse(question, answer) {
      if (!this._profile) await this.load();
      const normalizedQuestion = this.normalizeQuestion(question);
      this._profile.savedResponses = this._profile.savedResponses || {};
      this._profile.savedResponses[normalizedQuestion] = answer;
      await this.save();
    },

    // Get saved response for a question
    getResponse(question) {
      const profile = this.get();
      const normalizedQuestion = this.normalizeQuestion(question);
      return profile.savedResponses?.[normalizedQuestion] || null;
    },

    // Normalize question text for matching
    normalizeQuestion(question) {
      return (question || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100); // Limit length for storage
    },

    // Get location string for CV (strips Remote)
    getLocationForCV() {
      const profile = this.get();
      let location = profile.city || profile.location || '';
      
      // Strip Remote tokens
      location = location
        .replace(/\b(remote|work\s*from\s*home|wfh|virtual|fully\s*remote)\b/gi, '')
        .replace(/\s*[\(\[]?\s*(remote|wfh|virtual)\s*[\)\]]?\s*/gi, '')
        .replace(/\s*(\||,|\/|-)\s*$/g, '')
        .replace(/^\s*(\||,|\/|-)\s*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      return location || 'Dublin, IE'; // Default
    }
  };

  // Initialize on load
  ProfileStore.load();

  // Export
  global.ProfileStore = ProfileStore;
  global.POWER2_ProfileStore = ProfileStore;

})(typeof window !== 'undefined' ? window : this);
