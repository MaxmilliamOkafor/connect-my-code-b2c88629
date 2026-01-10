// file-attacher.js - File attachment to ATS forms
(function(global) {
  'use strict';
  global.FileAttacher = {
    async attachFile(file, type = 'resume') {
      console.log(`[FileAttacher] Attaching ${type}...`);
      const selectors = type === 'resume' 
        ? ['input[type="file"][name*="resume"]', 'input[type="file"][name*="cv"]', '[data-automation-id="file-upload-input-ref"]', 'input[type="file"]']
        : ['input[type="file"][name*="cover"]', 'input[type="file"][name*="letter"]'];
      for (const sel of selectors) {
        const input = document.querySelector(sel);
        if (input?.type === 'file') {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
          console.log(`[FileAttacher] Attached to ${sel}`);
          return true;
        }
      }
      return false;
    }
  };
})(typeof window !== 'undefined' ? window : global);
