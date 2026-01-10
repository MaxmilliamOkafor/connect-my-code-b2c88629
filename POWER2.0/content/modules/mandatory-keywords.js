// mandatory-keywords.js - Pre-pass mandatory keyword extraction
(function(global) {
  'use strict';

  const MANDATORY_KEYWORDS = {
    programmingLanguages: new Set(['java', 'python', 'javascript', 'typescript', 'c#', 'c++', 'go', 'golang', 'rust', 'swift', 'kotlin', 'ruby', 'php', 'scala', 'sql', 'nosql']),
    frontendFrameworks: new Set(['react', 'react native', 'redux', 'angular', 'vue.js', 'vue', 'svelte', 'next.js', 'nextjs', 'tailwind', 'bootstrap']),
    backendFrameworks: new Set(['node.js', 'nodejs', 'express', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'spring boot', '.net', 'asp.net', 'laravel', 'rails']),
    cloudPlatforms: new Set(['aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'kubernetes', 'k8s', 'docker', 'terraform', 'cloudformation']),
    databases: new Set(['mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'oracle', 'sql server']),
    dataScience: new Set(['pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'machine learning', 'deep learning', 'nlp', 'llm', 'genai']),
    cicd: new Set(['jenkins', 'github actions', 'gitlab ci', 'circleci', 'ci/cd', 'devops', 'terraform', 'ansible']),
    testing: new Set(['jest', 'pytest', 'junit', 'cypress', 'selenium', 'playwright', 'unit testing', 'integration testing']),
    methodologies: new Set(['agile', 'scrum', 'kanban', 'safe', 'devops', 'sre'])
  };

  const ALL_MANDATORY = new Set();
  Object.values(MANDATORY_KEYWORDS).forEach(set => set.forEach(kw => ALL_MANDATORY.add(kw.toLowerCase())));

  function extractMandatoryFromJD(jdText) {
    if (!jdText) return [];
    const jdLower = jdText.toLowerCase();
    const found = [];
    ALL_MANDATORY.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(jdLower)) found.push(keyword);
    });
    return found;
  }

  function mergeWithMandatory(extracted, mandatory) {
    if (!mandatory?.length) return extracted;
    const all = [...new Set([...mandatory, ...(extracted.all || [])])].slice(0, 35);
    return { ...extracted, all, highPriority: all.slice(0, 12), mediumPriority: all.slice(12, 24), lowPriority: all.slice(24) };
  }

  global.MandatoryKeywords = { MANDATORY_KEYWORDS, ALL_MANDATORY, extractMandatoryFromJD, mergeWithMandatory };
})(typeof window !== 'undefined' ? window : global);
