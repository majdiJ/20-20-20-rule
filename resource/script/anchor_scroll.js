// anchor-scroll.js
(function () {
  'use strict';

  // Attach click handlers to hash links
  function initAnchorScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', function (e) {
        const id = this.getAttribute('href').slice(1);
        if (!id) return; // allow href="#" or empty hashes to behave normally

        const el = document.getElementById(id);
        if (!el) return;

        e.preventDefault(); // stop default jump
        // center element in viewport with smooth behavior
        if ('scrollIntoView' in el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } else {
          // fallback calculation
          const rect = el.getBoundingClientRect();
          const top = window.pageYOffset + rect.top - (window.innerHeight / 2) + (rect.height / 2);
          window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'smooth' });
        }

        // update hash without causing another jump
        history.pushState(null, '', '#' + id);

        // accessibility: focus the element without scrolling again
        try {
          el.tabIndex = -1;
          el.focus({ preventScroll: true });
        } catch (err) {
          // older browsers may not support preventScroll
          el.focus();
        }
      });
    });
  }

  // Re-center on initial load if the URL already has a hash
  function handleInitialHash() {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;

    // Slight delay to allow browser initial jump/layout
    setTimeout(() => {
      if ('scrollIntoView' in el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } else {
        const rect = el.getBoundingClientRect();
        const top = window.pageYOffset + rect.top - (window.innerHeight / 2) + (rect.height / 2);
        window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'smooth' });
      }
      try {
        el.tabIndex = -1;
        el.focus({ preventScroll: true });
      } catch (err) {
        el.focus();
      }
    }, 0);
  }

  // init on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    initAnchorScroll();
    handleInitialHash();
  });

  // expose for testing / manual init if needed
  window.__anchorScrollInit = initAnchorScroll;
})();
