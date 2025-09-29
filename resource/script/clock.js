/* /resource/script/clock.js
   Updated: persist alarm/announcement index reliably, enable +time only during running timer
*/

(() => {
  // Elements
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.querySelector('#pause-btn'); // first pause button
  const resetBtn = document.getElementById('reset-btn');
  const skipBtn = document.getElementById('skip-btn');
  const plusBtn = document.getElementById('plus-time-btn');

  const timerLabelEl = document.getElementById('timer-label');
  const timerEl = document.getElementById('timer');
  const clockCircle = document.querySelector('.clock-circle');

  // settings inputs
  const workInput = document.getElementById('work-duration');
  const restInput = document.getElementById('rest-duration');
  const moreInput = document.getElementById('more-time-duration');
  const instantNextCheckbox = document.getElementById('instant-next');

  const systemNotificationCheckbox = document.getElementById('system-notification');
  const muteNotificationCheckbox = document.getElementById('mute-notification-tone');
  const muteAlarmCheckbox = document.getElementById('mute-alarm-tone');

  const alarmToneSelect = document.getElementById('alarm-tone');
  const alarmToneSample = document.getElementById('alarm-tone-sample');
  const announcementSelect = document.getElementById('spoken-announcement-lang');
  const announcementSample = document.getElementById('spoken-announcement-sample');

  const spokenAnnouncementsCheckbox = document.getElementById('spoken-announcements');
  const settingsCloseBtn = document.getElementById('settings-close-btn');

  // helper to find the 'mute/dismiss' primary button (duplicate id in HTML)
  function findMuteButton() {
    const candidates = Array.from(document.querySelectorAll('.primary-buttons'));
    return candidates.find(b => {
      const img = b.querySelector('img');
      return img && img.alt && img.alt.toLowerCase().includes('mute');
    }) || null;
  }
  let muteBtn = findMuteButton();

  // storage
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

  // state
  let state = 'idle'; // idle | work | rest | paused | alarming
  let currentCycle = 'work';
  let remainingSeconds = 0;
  let targetEnd = null;
  let tickTimer = null;
  let stateBeforePause = null;

  // audio
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  let alarmAudioEl = null;
  let announcementAudioEl = null;
  let alarmStopTimeout = null;

  // util
  function readStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('readStored error', e);
      return {};
    }
  }
  function writeStored(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('writeStored error', e);
    }
  }
  function clampInt(v, fallback) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && !isNaN(n) ? n : fallback;
  }
  function ensureAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new AudioCtx(); } catch (e) { audioCtx = null; }
    }
    return !!audioCtx;
  }

  /* --- small beep (notification) --- */
  function playBeep() {
    const stored = Object.assign({}, DEFAULTS, readStored());
    if (stored.muteNotification) return;
    if (!ensureAudioCtx()) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.stop(now + 0.15);
  }

  /* --- render helpers --- */
  function formatMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.max(0, sec % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function renderTimerDisplay(sec) {
    if (timerEl) timerEl.textContent = formatMMSS(sec);
  }

  function updateSkipLabel() {
    if (!skipBtn) return;
    const inRest = (state === 'rest' || (state === 'paused' && stateBeforePause === 'rest'));
    const textSpan = skipBtn.querySelector('.button-text');
    if (textSpan) textSpan.textContent = inRest ? 'Skip to work' : 'Skip to rest';
  }

  function updateAddLabel() {
    if (!plusBtn || !moreInput) return;
    const n = clampInt(moreInput.value, DEFAULTS.moreSeconds);
    const textSpan = plusBtn.querySelector('.button-text');
    if (textSpan) textSpan.textContent = `Add +${n} sec`;
  }

  function enablePlusOnlyWhenRunning() {
    // enable only while running (work or rest). Disabled in paused, alarming, idle.
    if (!plusBtn) return;
    plusBtn.disabled = !(state === 'work' || state === 'rest');
  }

  function setButtonsForState(s) {
    // restore basic defaults
    if (pauseBtn) { pauseBtn.style.display = ''; pauseBtn.disabled = true; }
    if (startBtn) startBtn.disabled = false;
    if (resetBtn) resetBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    if (plusBtn) plusBtn.disabled = true;
    if (muteBtn) { muteBtn.style.display = 'none'; }

    if (s === 'idle') {
      if (startBtn) startBtn.disabled = false;
      if (pauseBtn) pauseBtn.disabled = true;
      if (resetBtn) resetBtn.disabled = true;
    } else if (s === 'work' || s === 'rest') {
      if (startBtn) startBtn.disabled = true;
      if (pauseBtn) pauseBtn.disabled = false;
      if (resetBtn) resetBtn.disabled = false;
      if (plusBtn) plusBtn.disabled = false;
      if (skipBtn) skipBtn.disabled = false;
    } else if (s === 'paused') {
      if (startBtn) startBtn.disabled = false;
      if (pauseBtn) pauseBtn.disabled = true;
      if (resetBtn) resetBtn.disabled = false;
      if (plusBtn) plusBtn.disabled = true; // paused => not running
      if (skipBtn) skipBtn.disabled = !(stateBeforePause === 'work');
    } else if (s === 'alarming') {
      if (pauseBtn) pauseBtn.style.display = 'none';
      muteBtn = muteBtn || findMuteButton();
      if (muteBtn) { muteBtn.style.display = ''; muteBtn.disabled = false; }
      if (startBtn) startBtn.disabled = false; // proceed
      if (resetBtn) resetBtn.disabled = false;
      if (skipBtn) skipBtn.disabled = true;
      if (plusBtn) plusBtn.disabled = true; // per your request: disabled when complete/alarming
    }

    updateSkipLabel();
    updateAddLabel();
    enablePlusOnlyWhenRunning();
  }

  /* --- libraries (JSON) and saving selections robustly --- */
  async function fetchJsonSafe(url) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      console.warn('fetchJsonSafe', url, e);
      return null;
    }
  }

  // Populate selects without overwriting user selection if already present in storage
  async function loadLibrariesAndSettings() {
    const stored = Object.assign({}, DEFAULTS, readStored());

    // apply stored to inputs
    if (workInput) workInput.value = clampInt(stored.workMinutes, DEFAULTS.workMinutes);
    if (restInput) restInput.value = clampInt(stored.restSeconds, DEFAULTS.restSeconds);
    if (moreInput) moreInput.value = clampInt(stored.moreSeconds, DEFAULTS.moreSeconds);
    if (instantNextCheckbox) instantNextCheckbox.checked = !!stored.instantNext;
    if (systemNotificationCheckbox) systemNotificationCheckbox.checked = !!stored.systemNotification;
    if (muteNotificationCheckbox) muteNotificationCheckbox.checked = !!stored.muteNotification;
    if (muteAlarmCheckbox) muteAlarmCheckbox.checked = !!stored.muteAlarm;
    if (spokenAnnouncementsCheckbox) spokenAnnouncementsCheckbox.checked = !!stored.spokenAnnouncements;

    // alarm library
    const alarmLib = await fetchJsonSafe('/resource/sounds/alarms/library.json');
    if (alarmLib && Array.isArray(alarmLib.audio)) {
      // store library to storage (do not overwrite user index)
      stored.alarmLibrary = alarmLib;
      writeStored(stored); // persist libraries for later reference
      populateAlarmSelect(alarmLib, stored.alarmIndex);
    } else {
      // leave existing options as-is, but ensure selected using stored index
      if (alarmToneSelect && alarmToneSelect.options.length > 0) {
        alarmToneSelect.value = stored.alarmIndex || 0;
      }
    }

    // announcement library
    const annLib = await fetchJsonSafe('/resource/sounds/announcement/library.json');
    if (annLib && Array.isArray(annLib.audio)) {
      stored.announcementLibrary = annLib;
      writeStored(stored);
      populateAnnouncementSelect(annLib, stored.announcementIndex);
    } else {
      if (announcementSelect && announcementSelect.options.length > 0) {
        announcementSelect.value = stored.announcementIndex || 0;
      }
    }
  }

  function populateAlarmSelect(lib, selectedIdx) {
    if (!alarmToneSelect || !lib || !Array.isArray(lib.audio)) return;
    alarmToneSelect.innerHTML = '';
    lib.audio.forEach((entry, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = entry.audioName || `Alarm ${idx+1}`;
      alarmToneSelect.appendChild(opt);
    });
    // Only set selection to stored index if present (do NOT override stored selection)
    const stored = readStored();
    const idxToUse = (typeof stored.alarmIndex === 'number') ? stored.alarmIndex : (selectedIdx || 0);
    alarmToneSelect.value = Math.min(idxToUse, alarmToneSelect.options.length - 1);
  }

  function populateAnnouncementSelect(lib, selectedIdx) {
    if (!announcementSelect || !lib || !Array.isArray(lib.audio)) return;
    announcementSelect.innerHTML = '';
    lib.audio.forEach((entry, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = entry.audioName || `Announcement ${idx+1}`;
      announcementSelect.appendChild(opt);
    });
    const stored = readStored();
    const idxToUse = (typeof stored.announcementIndex === 'number') ? stored.announcementIndex : (selectedIdx || 0);
    announcementSelect.value = Math.min(idxToUse, announcementSelect.options.length - 1);
  }

  // Save settings persistently including selected alarm/announcement indices
  function saveSettingsImmediate() {
    const prev = Object.assign({}, DEFAULTS, readStored());
    const s = Object.assign({}, prev);
    s.workMinutes = clampInt(workInput?.value, DEFAULTS.workMinutes);
    s.restSeconds = clampInt(restInput?.value, DEFAULTS.restSeconds);
    s.moreSeconds = clampInt(moreInput?.value, DEFAULTS.moreSeconds);
    s.instantNext = !!instantNextCheckbox?.checked;
    s.systemNotification = !!systemNotificationCheckbox?.checked;
    s.muteNotification = !!muteNotificationCheckbox?.checked;
    s.muteAlarm = !!muteAlarmCheckbox?.checked;
    s.spokenAnnouncements = !!spokenAnnouncementsCheckbox?.checked;

    // here's the important part: persist indices *directly* when user changes them
    if (alarmToneSelect) s.alarmIndex = clampInt(alarmToneSelect.value, 0);
    if (announcementSelect) s.announcementIndex = clampInt(announcementSelect.value, 0);

    // keep loaded libraries if present
    if (prev.alarmLibrary) s.alarmLibrary = prev.alarmLibrary;
    if (prev.announcementLibrary) s.announcementLibrary = prev.announcementLibrary;

    writeStored(s);

    // update UI instantly
    updateAddLabel();
    updateSkipLabel();
    enablePlusOnlyWhenRunning();

    if (state === 'idle') {
      remainingSeconds = s.workMinutes * 60;
      renderTimerDisplay(remainingSeconds);
      timerLabelEl.textContent = 'Time remaining until rest';
    }
  }

  /* --- alarm & announcement playback --- */
  function buildPathForAlarmEntry(entry) {
    return `/resource/sounds/alarms/${entry.fileName || entry.audioName || ''}`;
  }
  function buildPathForAnnouncementFile(entry, which) {
    if (!entry) return '';
    const fname = (which === 'rest') ? entry.rest : entry.work;
    return `/resource/sounds/announcement/${fname}`;
  }

  function stopAlarmPlayback() {
    if (alarmAudioEl) {
      try { alarmAudioEl.pause(); alarmAudioEl.currentTime = 0; } catch(e) {}
      alarmAudioEl = null;
    }
    if (alarmStopTimeout) { clearTimeout(alarmStopTimeout); alarmStopTimeout = null; }
  }
  function stopAnnouncementPlayback() {
    if (announcementAudioEl) {
      try { announcementAudioEl.pause(); announcementAudioEl.currentTime = 0; } catch(e) {}
      announcementAudioEl = null;
    } else {
      try { window.speechSynthesis.cancel(); } catch(e){}
    }
  }

  function playAlarmLoopForSeconds(alarmEntry, seconds) {
    const stored = Object.assign({}, DEFAULTS, readStored());
    if (stored.muteAlarm) return;
    if (!alarmEntry) return;
    stopAlarmPlayback();
    const url = buildPathForAlarmEntry(alarmEntry);
    alarmAudioEl = new Audio(url);
    alarmAudioEl.loop = true;
    alarmAudioEl.play().catch(e => console.warn('Alarm play failed', e));
    alarmStopTimeout = setTimeout(() => stopAlarmPlayback(), Math.max(1, seconds) * 1000);
  }

  function playSingleToneIfAllowed() {
    const stored = Object.assign({}, DEFAULTS, readStored());
    if (stored.muteNotification) return;
    playBeep();
  }

  async function playAnnouncementAudioFor(which) {
    const stored = Object.assign({}, DEFAULTS, readStored());
    if (!stored.spokenAnnouncements) return;
    const lib = stored.announcementLibrary || null;
    if (!lib || !Array.isArray(lib.audio)) {
      const text = (which === 'rest') ? 'Time to rest. Look twenty feet away for twenty seconds.' : 'Time to work. Back to work now.';
      try { const ut = new SpeechSynthesisUtterance(text); window.speechSynthesis.cancel(); window.speechSynthesis.speak(ut); }
      catch (e) { console.warn('SpeechSynthesis failed', e); }
      return;
    }
    const idx = clampInt(stored.announcementIndex || announcementSelect?.value, 0);
    const entry = lib.audio[idx];
    if (!entry) return;
    const url = buildPathForAnnouncementFile(entry, which);
    stopAnnouncementPlayback();
    announcementAudioEl = new Audio(url);
    announcementAudioEl.play().catch(e => console.warn('Announcement play failed', e));
  }

  /* --- notification wrapper --- */
  function sendSystemNotification(title, body) {
    const stored = Object.assign({}, DEFAULTS, readStored());
    if (!stored.systemNotification) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch(e) { console.warn(e); }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          try { new Notification(title, { body }); } catch(e){}
        }
      }).catch(()=>{});
    }
  }

  /* --- timer core --- */
  function startTimerFor(seconds, cycle) {
    if (pauseBtn) pauseBtn.style.display = '';
    cancelTick();
    currentCycle = (cycle === 'rest') ? 'rest' : 'work';
    state = (cycle === 'rest') ? 'rest' : 'work';
    setButtonsForState(state);
    timerLabelEl.textContent = (state === 'work') ? 'Time remaining until rest' : 'Rest time remaining';
    remainingSeconds = seconds;
    renderTimerDisplay(remainingSeconds);
    targetEnd = Date.now() + seconds * 1000;
    tickTimer = setInterval(tickFunc, 250);
  }

  function tickFunc() {
    if (!targetEnd) return;
    const now = Date.now();
    const secLeft = Math.max(0, Math.round((targetEnd - now) / 1000));
    remainingSeconds = secLeft;
    renderTimerDisplay(secLeft);
    if (secLeft <= 0) {
      cancelTick();
      onTimerComplete();
    }
  }

  function cancelTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    targetEnd = null;
  }

  async function onTimerComplete() {
    const stored = Object.assign({}, DEFAULTS, readStored());
    const instant = !!(instantNextCheckbox?.checked || stored.instantNext);
    const nextCycle = (currentCycle === 'work') ? 'rest' : 'work';

    if (instant) {
      playSingleToneIfAllowed();
      await playAnnouncementAudioFor(nextCycle);
      if (currentCycle === 'work') {
        const r = clampInt(restInput?.value, DEFAULTS.restSeconds);
        startTimerFor(r, 'rest');
      } else {
        const w = clampInt(workInput?.value, DEFAULTS.workMinutes) * 60;
        startTimerFor(w, 'work');
      }
      return;
    }

    // non-instant -> alarming UI, user must dismiss/proceed
    state = 'alarming';
    if (clockCircle && !clockCircle.classList.contains('alarming')) clockCircle.classList.add('alarming');
    renderTimerDisplay(0);

    if (nextCycle === 'rest') {
      const secondsToRest = clampInt(restInput?.value, DEFAULTS.restSeconds);
      timerLabelEl.textContent = `End of session, look 20 feet away for ${secondsToRest} seconds to rest your eyes.`;
    } else {
      const secondsToWork = clampInt(workInput?.value, DEFAULTS.workMinutes) * 60;
      timerLabelEl.textContent = `End of break, back to work for ${Math.floor(secondsToWork/60)} minutes.`;
    }

    setButtonsForState('alarming');

    // play short tone, optionally announcement, then alarm loop (60s)
    playSingleToneIfAllowed();
    if (stored.spokenAnnouncements) await playAnnouncementAudioFor(nextCycle);

    // choose alarm entry from persisted index
    const alarmLib = stored.alarmLibrary || null;
    let alarmEntry = null;
    if (alarmLib && Array.isArray(alarmLib.audio)) {
      const idx = clampInt(stored.alarmIndex || alarmToneSelect?.value, 0);
      alarmEntry = alarmLib.audio[idx];
    }
    playAlarmLoopForSeconds(alarmEntry, 60);
  }

  /* --- button handlers --- */
  if (startBtn) startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (state === 'idle') {
      const wm = clampInt(workInput?.value, DEFAULTS.workMinutes);
      startTimerFor(wm * 60, 'work');
    } else if (state === 'paused') {
      startTimerFor(remainingSeconds, stateBeforePause || currentCycle || 'work');
    } else if (state === 'alarming') {
      stopAlarmPlayback();
      stopAnnouncementPlayback();
      if (clockCircle) clockCircle.classList.remove('alarming');
      const nextCycle = (currentCycle === 'work') ? 'rest' : 'work';
      if (nextCycle === 'rest') {
        const rs = clampInt(restInput?.value, DEFAULTS.restSeconds);
        startTimerFor(rs, 'rest');
      } else {
        const ws = clampInt(workInput?.value, DEFAULTS.workMinutes) * 60;
        startTimerFor(ws, 'work');
      }
    }
  });

  if (pauseBtn) pauseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (state === 'work' || state === 'rest') {
      stateBeforePause = state;
      cancelTick();
      state = 'paused';
      timerLabelEl.textContent = 'Paused';
      setButtonsForState('paused');
    }
  });

  if (resetBtn) resetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    stopAlarmPlayback();
    stopAnnouncementPlayback();
    if (clockCircle) clockCircle.classList.remove('alarming');
    cancelTick();
    state = 'idle';
    const wm = clampInt(workInput?.value, DEFAULTS.workMinutes);
    remainingSeconds = wm * 60;
    renderTimerDisplay(remainingSeconds);
    timerLabelEl.textContent = 'Time remaining until rest';
    setButtonsForState('idle');
    if (pauseBtn) pauseBtn.style.display = '';
  });

  if (skipBtn) skipBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (state === 'work' || (state === 'paused' && stateBeforePause === 'work')) {
      cancelTick();
      const r = clampInt(restInput?.value, DEFAULTS.restSeconds);
      startTimerFor(r, 'rest');
    } else if (state === 'rest' || (state === 'paused' && stateBeforePause === 'rest')) {
      cancelTick();
      const w = clampInt(workInput?.value, DEFAULTS.workMinutes) * 60;
      startTimerFor(w, 'work');
    }
  });

  // +time is only allowed while the timer is running (work or rest)
  if (plusBtn) plusBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const extra = clampInt(moreInput?.value, DEFAULTS.moreSeconds);
    if (state === 'work' || state === 'rest') {
      if (targetEnd) {
        targetEnd += extra * 1000;
      } else {
        remainingSeconds += extra;
      }
      renderTimerDisplay(remainingSeconds);
    } else {
      // disabled in other states; do nothing (guard)
    }
  });

  // one-shot mute/dismiss button (find it)
  muteBtn = muteBtn || findMuteButton();
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // stop playback only (do not reset or change persistent settings)
      stopAlarmPlayback();
      stopAnnouncementPlayback();
      // keep alarming UI; user still must press Start or Reset
    });
  }

  // samples
  if (alarmToneSample) {
    alarmToneSample.addEventListener('click', (e) => {
      e.preventDefault();
      const stored = Object.assign({}, DEFAULTS, readStored());
      const lib = stored.alarmLibrary || null;
      if (!lib || !Array.isArray(lib.audio)) return;
      const idx = clampInt(alarmToneSelect?.value, stored.alarmIndex || 0);
      const entry = lib.audio[idx];
      if (!entry) return;
      const url = `/resource/sounds/alarms/${entry.fileName || entry.audioName || ''}`;
      try { const a = new Audio(url); a.play().catch(()=>{}); } catch(e){ console.warn(e); }
    });
  }
  if (announcementSample) {
    announcementSample.addEventListener('click', (e) => {
      e.preventDefault();
      const stored = Object.assign({}, DEFAULTS, readStored());
      const lib = stored.announcementLibrary || null;
      if (!lib || !Array.isArray(lib.audio)) return;
      const idx = clampInt(announcementSelect?.value, stored.announcementIndex || 0);
      const entry = lib.audio[idx];
      if (!entry) return;
      const fname = entry.rest || entry.work || entry.fileName;
      const url = `/resource/sounds/announcement/${fname}`;
      try { const a = new Audio(url); a.play().catch(()=>{}); } catch(e){ console.warn(e); }
    });
  }

  // save settings on close (no panel visibility change)
  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      saveSettingsImmediate();
    });
  }

  // persist changes when inputs change
  [workInput, restInput, moreInput, instantNextCheckbox, systemNotificationCheckbox, muteNotificationCheckbox, muteAlarmCheckbox, alarmToneSelect, announcementSelect, spokenAnnouncementsCheckbox].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => {
      saveSettingsImmediate();
    });
  });

  function saveSettingsImmediate() {
    const prev = Object.assign({}, DEFAULTS, readStored());
    const s = Object.assign({}, prev);
    s.workMinutes = clampInt(workInput?.value, DEFAULTS.workMinutes);
    s.restSeconds = clampInt(restInput?.value, DEFAULTS.restSeconds);
    s.moreSeconds = clampInt(moreInput?.value, DEFAULTS.moreSeconds);
    s.instantNext = !!instantNextCheckbox?.checked;
    s.systemNotification = !!systemNotificationCheckbox?.checked;
    s.muteNotification = !!muteNotificationCheckbox?.checked;
    s.muteAlarm = !!muteAlarmCheckbox?.checked;
    s.spokenAnnouncements = !!spokenAnnouncementsCheckbox?.checked;

    // IMPORTANT: store indices when user chooses them. This ensures user's choice persists
    if (alarmToneSelect) s.alarmIndex = clampInt(alarmToneSelect.value, 0);
    if (announcementSelect) s.announcementIndex = clampInt(announcementSelect.value, 0);

    // preserve loaded libraries
    if (prev.alarmLibrary) s.alarmLibrary = prev.alarmLibrary;
    if (prev.announcementLibrary) s.announcementLibrary = prev.announcementLibrary;

    writeStored(s);

    // update UI immediately
    updateAddLabel();
    updateSkipLabel();
    enablePlusOnlyWhenRunning();

    if (state === 'idle') {
      remainingSeconds = s.workMinutes * 60;
      renderTimerDisplay(remainingSeconds);
      timerLabelEl.textContent = 'Time remaining until rest';
    }
  }

  // init
  (async function init() {
    await loadLibrariesAndSettings();
    const wm = clampInt(workInput?.value, DEFAULTS.workMinutes);
    remainingSeconds = wm * 60;
    renderTimerDisplay(remainingSeconds);
    timerLabelEl.textContent = 'Time remaining until rest';
    setButtonsForState('idle');

    const stored = Object.assign({}, DEFAULTS, readStored());
    if (stored.systemNotification && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(()=>{});
    }
  })();

  // expose for debug (optional)
  window.__twenty20_clock = {
    getState: () => ({ state, currentCycle, remainingSeconds }),
    start: () => startBtn && startBtn.click(),
    pause: () => pauseBtn && pauseBtn.click(),
    reset: () => resetBtn && resetBtn.click()
  };
})();
