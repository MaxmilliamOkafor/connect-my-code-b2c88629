// cv-engine.js - CV content tailoring
(function(global) {
  'use strict';
  global.CVEngine = {
    tailorCV(cvText, keywords, jobInfo) {
      if (!cvText || !keywords?.all?.length) return cvText;
      let tailored = cvText;
      const missing = keywords.all.filter(kw => !cvText.toLowerCase().includes(kw.toLowerCase()));
      if (missing.length > 0) {
        tailored += `\n\nAdditional Skills: ${missing.slice(0, 10).join(', ')}`;
      }
      return tailored;
    }
  };
})(typeof window !== 'undefined' ? window : global);
