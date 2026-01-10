// turbo-pipeline.js - Fast CV tailoring pipeline
(function(global) {
  'use strict';
  global.TurboPipeline = {
    async execute(jobInfo, candidateData, options = {}) {
      const startTime = performance.now();
      console.log('[TurboPipeline] Starting...');
      
      const mandatoryKeywords = global.MandatoryKeywords?.extractMandatoryFromJD(jobInfo.jdText) || [];
      let keywords = global.ReliableExtractor?.extract(jobInfo.jdText, { maxKeywords: 35 }) || { all: [] };
      keywords = global.MandatoryKeywords?.mergeWithMandatory(keywords, mandatoryKeywords) || keywords;
      keywords = global.KeywordStrategy?.prioritize(keywords, jobInfo.jdText) || keywords;
      
      const cvText = candidateData?.cvText || '';
      const tailorResult = await global.TailorEngine?.tailorCV(cvText, keywords, { jobInfo }) || { tailoredCV: cvText, matchScore: 0 };
      
      console.log(`[TurboPipeline] Complete in ${(performance.now() - startTime).toFixed(0)}ms`);
      return { keywords, tailoredCV: tailorResult.tailoredCV, matchScore: tailorResult.matchScore, matchedKeywords: tailorResult.matchedKeywords, missingKeywords: tailorResult.missingKeywords, elapsed: performance.now() - startTime };
    }
  };
})(typeof window !== 'undefined' ? window : global);
