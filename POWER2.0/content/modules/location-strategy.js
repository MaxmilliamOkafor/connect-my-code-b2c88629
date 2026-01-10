// location-strategy.js - Location parsing
(function(global) {
  'use strict';
  global.LocationStrategy = {
    parse(loc) {
      if (!loc) return { city: '', state: '', country: '', remote: false };
      const remote = loc.toLowerCase().includes('remote');
      const parts = loc.split(/[,;]/);
      return { city: parts[0]?.trim() || '', state: parts[1]?.trim() || '', country: parts[2]?.trim() || '', remote, original: loc };
    },
    format(parsed, defaultLoc = 'Dublin, IE') {
      if (parsed.remote && !parsed.city) return defaultLoc;
      return [parsed.city, parsed.state, parsed.country].filter(Boolean).join(', ') || defaultLoc;
    }
  };
})(typeof window !== 'undefined' ? window : global);
