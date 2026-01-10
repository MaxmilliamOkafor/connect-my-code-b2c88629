// tailor-engine.js - Universal CV tailoring
(function(global) {
  'use strict';
  global.TailorEngine = {
    async tailorCV(cvText, keywords, options = {}) {
      if (!cvText || !keywords?.all?.length) return { tailoredCV: cvText, matchScore: 0 };
      const tailored = global.CVEngine?.tailorCV(cvText, keywords, options.jobInfo) || cvText;
      const match = global.ReliableExtractor?.calculateMatch(tailored, keywords.all) || { score: 0 };
      return { tailoredCV: tailored, matchScore: match.score, matchedKeywords: match.matched || [], missingKeywords: match.missing || [] };
    }
  };
})(typeof window !== 'undefined' ? window : global);
