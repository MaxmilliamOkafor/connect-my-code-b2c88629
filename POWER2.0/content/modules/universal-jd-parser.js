// universal-jd-parser.js - Job Description Parser
(function(global) {
  'use strict';

  global.UniversalJDParser = {
    parse(doc = document) {
      return {
        title: this.extractTitle(doc),
        company: this.extractCompany(doc),
        location: this.extractLocation(doc),
        jdText: this.extractJDText(doc),
        url: window.location.href
      };
    },

    extractJDText(doc) {
      const selectors = ['[data-automation-id="jobPostingDescription"]', '.job-description', '#job-description', '[class*="description"]', 'article', 'main'];
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el?.textContent?.length > 200) return el.textContent.trim().substring(0, 10000);
      }
      return doc.body?.textContent?.substring(0, 10000) || '';
    },

    extractTitle(doc) {
      const selectors = ['[data-automation-id="jobPostingTitle"]', 'h1[class*="title"]', '.job-title', 'h1'];
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim().substring(0, 200);
      }
      return '';
    },

    extractCompany(doc) {
      const selectors = ['[data-automation-id="company"]', '.company-name', '[class*="company"]'];
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim().substring(0, 100);
      }
      return window.location.hostname.replace('www.', '').split('.')[0];
    },

    extractLocation(doc) {
      const selectors = ['[data-automation-id="location"]', '.job-location', '[class*="location"]'];
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim().substring(0, 100);
      }
      return '';
    }
  };
})(typeof window !== 'undefined' ? window : global);
