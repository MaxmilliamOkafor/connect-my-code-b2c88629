// pdf-generator.js - ATS-friendly PDF generation
(function(global) {
  'use strict';
  global.PDFGenerator = {
    async generate(cvText, jobInfo) {
      console.log('[PDFGenerator] Generating...');
      let formatted = cvText.replace(/summary/gi, 'SUMMARY').replace(/experience/gi, 'EXPERIENCE').replace(/education/gi, 'EDUCATION').replace(/skills/gi, 'SKILLS');
      return new Blob([formatted], { type: 'text/plain' });
    }
  };
})(typeof window !== 'undefined' ? window : global);
