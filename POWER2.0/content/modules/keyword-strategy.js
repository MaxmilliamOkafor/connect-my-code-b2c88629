// keyword-strategy.js - Smart keyword prioritization
(function(global) {
  'use strict';
  global.KeywordStrategy = {
    prioritize(keywords, jdText) {
      if (!keywords?.all?.length) return keywords;
      const jdLower = (jdText || '').toLowerCase();
      const rescored = keywords.all.map(kw => {
        let score = 1;
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        score += ((jdLower.match(regex) || []).length) * 0.5;
        if (jdLower.includes('requirements') && jdLower.indexOf(kw) > jdLower.indexOf('requirements')) score += 2;
        return { keyword: kw, score };
      }).sort((a, b) => b.score - a.score);
      const all = rescored.map(r => r.keyword);
      return { ...keywords, all, highPriority: all.slice(0, 12), mediumPriority: all.slice(12, 24), lowPriority: all.slice(24) };
    }
  };
})(typeof window !== 'undefined' ? window : global);
