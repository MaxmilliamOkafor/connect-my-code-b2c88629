// reliable-extractor.js - Keyword Extraction Engine
(function(global) {
  'use strict';

  global.ReliableExtractor = {
    extract(jdText, options = {}) {
      if (!jdText) return { all: [], highPriority: [], mediumPriority: [], lowPriority: [] };
      const maxKeywords = options.maxKeywords || 35;
      const words = jdText.toLowerCase().replace(/[^a-z0-9\s\.\+\#\-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && w.length < 30);
      const freq = {};
      words.forEach(w => freq[w] = (freq[w] || 0) + 1);
      
      const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'with', 'this', 'that', 'from', 'they', 'your', 'what', 'their', 'about', 'which', 'would', 'there', 'these', 'other']);
      const scored = {};
      for (const [word, count] of Object.entries(freq)) {
        if (stopWords.has(word)) continue;
        let score = count;
        if (global.MandatoryKeywords?.ALL_MANDATORY?.has(word)) score *= 3;
        scored[word] = score;
      }
      
      const sorted = Object.entries(scored).sort((a, b) => b[1] - a[1]).slice(0, maxKeywords).map(([w]) => w);
      return { all: sorted, highPriority: sorted.slice(0, 12), mediumPriority: sorted.slice(12, 24), lowPriority: sorted.slice(24), total: sorted.length };
    },

    calculateMatch(cvText, keywords) {
      if (!cvText || !keywords?.length) return { score: 0, matched: [], missing: [] };
      const cvLower = cvText.toLowerCase();
      const matched = [], missing = [];
      keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        (regex.test(cvLower) ? matched : missing).push(kw);
      });
      return { score: Math.round((matched.length / keywords.length) * 100), matched, missing };
    }
  };
})(typeof window !== 'undefined' ? window : global);
