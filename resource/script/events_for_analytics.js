// events_for_analytics.js
// Centralised click-to-GA4 tracking for your timer app (updated to use explicit IDs
// for clear-cache and reset-defaults links).

(function () {
  'use strict';

  function sendAnalyticsEvent(eventName, params = {}) {
    params = Object.assign({
      button_id: params.button_id || null,
      button_text: params.button_text || null,
      page_path: window.location.pathname || null
    }, params);

    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', eventName, params);
        return;
      } catch (e) {
        // fall through
      }
    }

    if (Array.isArray(window.dataLayer)) {
      try {
        window.dataLayer.push(Object.assign({ event: eventName }, params));
        return;
      } catch (e) {
        // fall through
      }
    }

    // eslint-disable-next-line no-console
    console.log('[analytics fallback] event:', eventName, params);
  }

  function attachOnce(el, event, handler) {
    if (!el) return;
    var key = 'analyticsAttached';
    if (el.dataset && el.dataset[key]) return;
    el.addEventListener(event, handler);
    if (el.dataset) el.dataset[key] = '1';
  }

  function makeHandler(eventName, getParams) {
    return function (ev) {
      try {
        var params = getParams && typeof getParams === 'function'
          ? getParams(ev)
          : {};
        sendAnalyticsEvent(eventName, params);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Analytics handler error:', err);
      }
    };
  }

  var trackingMap = [
    // Primary buttons
    { sel: '#start-btn', event: 'start_button_click', category: 'timer' },
    { sel: '#pause-btn', event: 'pause_button_click', category: 'timer' },
    { sel: '#reset-btn', event: 'reset_button_click', category: 'timer' },

    // Optional
    { sel: '#skip-btn', event: 'skip_to_rest_click', category: 'timer' },
    { sel: '#plus-time-btn', event: 'add_time_click', category: 'timer' },

    // Settings / UI controls
    { sel: '#settings-open-btn', event: 'open_settings_click', category: 'settings' },
    { sel: '#light-dark-toggle', event: 'toggle_theme_click', category: 'settings' },
    { sel: '#full-screen-toggle', event: 'toggle_fullscreen_click', category: 'settings' },

    // Shared settings actions
    { sel: '#save-shared-settings-btn', event: 'save_shared_settings_click', category: 'settings' },
    { sel: '#session-shared-settings-btn', event: 'use_shared_settings_session_click', category: 'settings' },
    { sel: '#discard-shared-settings-btn', event: 'discard_shared_settings_click', category: 'settings' },

    // Explicit IDs for clearing/resetting (updated to use IDs)
    { sel: '#clear-cache-btn', event: 'clear_cache_and_data_click', category: 'settings' },
    { sel: '#reset-defaults-btn', event: 'reset_to_default_settings_click', category: 'settings' }
  ];

  function initMappedTracking() {
    trackingMap.forEach(function (entry) {
      var el = document.querySelector(entry.sel);
      if (!el) return;
      attachOnce(el, 'click', makeHandler(entry.event, function () {
        // Prefer a readable button text for anchors or buttons
        var text = '';
        try { text = (el.textContent || el.innerText || '').trim(); } catch (e) { text = null; }
        return {
          button_id: el.id || null,
          button_text: text || null,
          category: entry.category || null
        };
      }));
    });
  }

  function enableAutoAttachForDynamic() {
    var observer;
    try {
      observer = new MutationObserver(function (mutationsList) {
        var recheck = false;
        for (var i = 0; i < mutationsList.length; i++) {
          if (mutationsList[i].addedNodes && mutationsList[i].addedNodes.length > 0) {
            recheck = true;
            break;
          }
        }
        if (recheck) {
          initMappedTracking();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      // ignore if MutationObserver isn't available
    }
  }

  function start() {
    initMappedTracking();
    enableAutoAttachForDynamic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Expose minimal API for manual testing if needed
  window._eventsForAnalytics = {
    sendAnalyticsEvent: sendAnalyticsEvent,
    start: start
  };
})();
