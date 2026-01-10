// score-engine.js - Real-time match score calculation
(function(global) {
  'use strict';
  global.ScoreEngine = {
    calculate(cvText, keywords) { return global.ReliableExtractor?.calculateMatch(cvText, keywords) || { score: 0 }; },
    getColor(score) { return score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444'; },
    getLabel(score) { return score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work'; }
  };
})(typeof window !== 'undefined' ? window : global);
