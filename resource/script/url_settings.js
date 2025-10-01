// /resource/script/url_settings.js
// Parse URL settings, validate, show shared-configuration overlay, let user Save/Use/Discard.
//
// Usage: include this file BEFORE clock.js in the page (both can use `defer`).
// It will set window.__twenty20_url_settings for session-only application,
// or write to the same localStorage key used by clock.js for persistence.

(() => {
  const STORAGE_KEY = 'twenty20timer:settings:v2';
  const DEFAULTS = {
    workMinutes: 20,
    restSeconds: 20,
    moreSeconds: 60,
    instantNext: false,
    systemNotification: true,
    muteNotification: false,
    muteAlarm: false,
    spokenAnnouncements: false,
    alarmIndex: 0,
    announcementIndex: 0,
    alarmLibrary: null,
    announcementLibrary: null
  };

  // mapping param name -> { key: internalKey, type: 'int'|'bool' }
  const PARAM_MAP = {
    work: { key: 'workMinutes', type: 'int', min: 1, max: 300 },
    rest: { key: 'restSeconds', type: 'int', min: 1, max: 1800 },
    more: { key: 'moreSeconds', type: 'int', min: 1, max: 1800 },
    instant: { key: 'instantNext', type: 'bool' },
    sys: { key: 'systemNotification', type: 'bool' },
    muteNotif: { key: 'muteNotification', type: 'bool' },
    muteAlarm: { key: 'muteAlarm', type: 'bool' },
    spoken: { key: 'spokenAnnouncements', type: 'bool' },
    alarm: { key: 'alarmIndex', type: 'int', min: 0 },
    announcement: { key: 'announcementIndex', type: 'int', min: 0 }
  };

  // human-readable labels for the overlay review
  const LABELS = {
    workMinutes: 'Work duration',
    restSeconds: 'Rest duration',
    moreSeconds: 'More time duration',
    instantNext: 'Instantly go to next rest / work period',
    systemNotification: 'Use system notification',
    muteNotification: 'Mute Notification tone',
    muteAlarm: 'Mute Alarm tone',
    alarmIndex: 'Alarm tone',
    spokenAnnouncements: 'Spoken announcements',
    announcementIndex: 'Spoken announcement language'
  };

  // parse boolean accepting true/false (case-insensitive) or 1/0
  function parseBoolRaw(raw) {
    if (raw == null) return undefined;
    const r = String(raw).trim().toLowerCase();
    if (r === '1' || r === 'true') return true;
    if (r === '0' || r === 'false') return false;
    return undefined;
  }

  function clampInt(n, min = -Infinity, max = Infinity) {
    if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) return undefined;
    if (min !== -Infinity) n = Math.max(min, n);
    if (max !== Infinity) n = Math.min(max, n);
    return Math.trunc(n);
  }

  function parseUrlSettings() {
    const qp = new URLSearchParams(window.location.search);
    const parsed = {};
    const presentParams = []; // keep keys in original param order that were present & valid

    for (const [param, info] of Object.entries(PARAM_MAP)) {
      if (!qp.has(param)) continue;
      const raw = qp.get(param);
      if (info.type === 'bool') {
        const b = parseBoolRaw(raw);
        if (typeof b === 'boolean') {
          parsed[info.key] = b;
          presentParams.push(info.key);
        } // invalid -> ignore
      } else if (info.type === 'int') {
        const nRaw = parseInt(raw, 10);
        if (!Number.isNaN(nRaw) && Number.isFinite(nRaw)) {
          const n = clampInt(nRaw, info.min !== undefined ? info.min : -Infinity, info.max !== undefined ? info.max : Infinity);
          if (typeof n === 'number') {
            parsed[info.key] = n;
            presentParams.push(info.key);
          }
        }
      }
    }

    return { parsed, presentParams };
  }

  function readStoredRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('url_settings: readStoredRaw error', e);
      return {};
    }
  }

  function writeStoredRaw(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('url_settings: writeStoredRaw error', e);
    }
  }

  // Build a human-friendly display value for a key in the overlay review
  function humanValueFor(key, value) {
    if (key === 'workMinutes') return `${value} minute${value === 1 ? '' : 's'}`;
    if (key === 'restSeconds' || key === 'moreSeconds') return `${value} second${value === 1 ? '' : 's'}`;
    if (key === 'instantNext' || key === 'systemNotification' || key === 'muteNotification' || key === 'muteAlarm' || key === 'spokenAnnouncements') {
      return value ? 'Yes' : 'No';
    }
    if (key === 'alarmIndex' || key === 'announcementIndex') {
      const idx = Number.isFinite(value) ? Number(value) : 0;
      return `option${idx + 1} (index ${idx})`;
    }
    return String(value);
  }

  // populate overlay review with only the present keys (presentParams array)
  function populateReview(presentParams, parsed) {
    const reviewEl = document.querySelector('.shared-configuration-dyanmic-review');
    if (!reviewEl) return;
    const lines = [];
    for (const key of presentParams) {
      const label = LABELS[key] || key;
      const display = humanValueFor(key, parsed[key]);
      lines.push(`${label}: ${display}`);
    }
    reviewEl.innerHTML = lines.length ? lines.join('<br>\n') : 'No valid shared settings found in the URL.';
  }

  // Show/hide must affect the parent container too because CSS often hides parent by default.
  function showOverlay() {
    const container = document.querySelector('.shared-configuration-section');
    const overlay = document.getElementById('shared-configuration-section-overlay');
    if (container) container.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
  }
  function hideOverlay() {
    const container = document.querySelector('.shared-configuration-section');
    const overlay = document.getElementById('shared-configuration-section-overlay');
    if (overlay) overlay.style.display = 'none';
    if (container) container.style.display = 'none';
  }

  // Apply session-only settings (store them in window and ask clock.js to reload)
  async function applySessionSettings(parsed) {
    // store for clock.js to pick up
    window.__twenty20_url_settings = Object.assign({}, parsed);

    if (window.__twenty20_clock && typeof window.__twenty20_clock.applyUrlSettings === 'function') {
      try {
        await window.__twenty20_clock.applyUrlSettings(parsed, false);
      } catch (e) {
        console.warn('url_settings: applyUrlSettings failed', e);
      }
    } else {
      // flag for clock.js to consume at init
      window.__twenty20_url_settings_pending = { settings: parsed, persist: false };
    }

    // hide overlay after user action (only hide; actual apply/persist handled above)
    hideOverlay();
  }

  // Save to device (persist into localStorage)
  async function persistSettings(parsed) {
    // merge defaults <- stored <- parsed
    const prev = Object.assign({}, DEFAULTS, readStoredRaw());
    const merged = Object.assign({}, prev, parsed);

    // preserve libraries if present in prev
    if (prev.alarmLibrary) merged.alarmLibrary = prev.alarmLibrary;
    if (prev.announcementLibrary) merged.announcementLibrary = prev.announcementLibrary;

    writeStoredRaw(merged);

    if (window.__twenty20_clock && typeof window.__twenty20_clock.applyUrlSettings === 'function') {
      try {
        // ask clock.js to re-load from storage/merged settings
        await window.__twenty20_clock.applyUrlSettings(merged, true);
      } catch (e) {
        console.warn('url_settings: applyUrlSettings (persist) failed', e);
      }
    } else {
      // store a flag pending for clock to apply at init
      window.__twenty20_url_settings_pending = { settings: merged, persist: true };
    }

    // hide overlay after user action (only hide; actual persistence handled above)
    hideOverlay();
  }

  // --- NEW: remove only the shared params from URL without reloading ---
  function removeSharedParamsFromUrl() {
    try {
      const url = new URL(window.location.href);
      const qp = url.searchParams;
      for (const param of Object.keys(PARAM_MAP)) {
        if (qp.has(param)) qp.delete(param);
      }
      const newSearch = qp.toString();
      // build a relative URL (keeps pathname and hash)
      const newUrl = url.pathname + (newSearch ? `?${newSearch}` : '') + (url.hash || '');
      history.replaceState(null, '', newUrl);
    } catch (e) {
      console.warn('url_settings: removeSharedParamsFromUrl failed', e);
    }
  }

  // Discard simply hides overlay and does nothing (now also removes shared URL params)
  function discardSettings() {
    delete window.__twenty20_url_settings_pending;
    delete window.__twenty20_url_settings;
    hideOverlay();

    // remove the shared settings params from the URL so dismissed settings aren't reused/shared
    removeSharedParamsFromUrl();
  }

  // Wire up overlay buttons
  function wireButtons(parsed) {
    const saveBtn = document.getElementById('save-shared-settings-btn');
    const sessionBtn = document.getElementById('session-shared-settings-btn');
    const discardBtn = document.getElementById('discard-shared-settings-btn');
    const closeBtn = document.querySelector('#shared-configuration-close-btn');

    if (saveBtn) {
      saveBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        persistSettings(parsed);
      });
    }
    if (sessionBtn) {
      sessionBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        applySessionSettings(parsed);
      });
    }
    if (discardBtn) {
      discardBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        discardSettings();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        discardSettings();
      });
    }
  }

  // Run the parser and show overlay only if there are valid params present
  document.addEventListener('DOMContentLoaded', () => {
    const { parsed, presentParams } = parseUrlSettings();
    if (!presentParams.length) {
      // no valid shared settings in URL — nothing to do
      return;
    }

    // populate review with only present params
    populateReview(presentParams, parsed);

    // show overlay (ensures both overlay and its parent container become visible)
    showOverlay();

    // wire buttons
    wireButtons(parsed);
  });
})();
