
import {
  DEFAULTS, readStored, writeStored
} from './modules/storage.js';
import {
  playBeep, playAlarmLoopForSeconds, playAnnouncementAudioFor, stopAlarmPlayback, stopAnnouncementPlayback, buildPathForAlarmEntry, buildPathForAnnouncementFile, playSingleToneIfAllowed
} from './modules/audio.js';
import {
  formatMMSS, renderTimerDisplay, updateSkipLabel, updateAddLabel, enablePlusOnlyWhenRunning, setButtonsForState, populateAlarmSelect, populateAnnouncementSelect
} from './modules/ui.js';
import {
  clampInt, fetchJsonSafe
} from './modules/utils.js';

(() => {
  // Elements
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.querySelector('#pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const skipBtn = document.getElementById('skip-btn');
  const plusBtn = document.getElementById('plus-time-btn');
  const timerLabelEl = document.getElementById('timer-label');
  const timerEl = document.getElementById('timer');
  const clockCircle = document.querySelector('.clock-circle');
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

  function findMuteButton() {
    const candidates = Array.from(document.querySelectorAll('.primary-buttons'));
    return candidates.find(b => {
      const img = b.querySelector('img');
      return img && img.alt && img.alt.toLowerCase().includes('mute');
    }) || null;
  }
  let muteBtn = findMuteButton();

  // State
  let state = 'idle';
  let currentCycle = 'work';
  let remainingSeconds = 0;
  let targetEnd = null;
  let tickTimer = null;
  let stateBeforePause = null;

  async function loadLibrariesAndSettings() {
    const stored = Object.assign({}, DEFAULTS, readStored());

    if (workInput) workInput.value = clampInt(stored.workMinutes, DEFAULTS.workMinutes);
    if (restInput) restInput.value = clampInt(stored.restSeconds, DEFAULTS.restSeconds);
    if (moreInput) moreInput.value = clampInt(stored.moreSeconds, DEFAULTS.moreSeconds);
    if (instantNextCheckbox) instantNextCheckbox.checked = !!stored.instantNext;
    if (systemNotificationCheckbox) systemNotificationCheckbox.checked = !!stored.systemNotification;
    if (muteNotificationCheckbox) muteNotificationCheckbox.checked = !!stored.muteNotification;
    if (muteAlarmCheckbox) muteAlarmCheckbox.checked = !!stored.muteAlarm;
    if (spokenAnnouncementsCheckbox) spokenAnnouncementsCheckbox.checked = !!stored.spokenAnnouncements;

    const alarmLib = await fetchJsonSafe('/resource/sounds/alarms/library.json');
    if (alarmLib && Array.isArray(alarmLib.audio)) {
      stored.alarmLibrary = alarmLib;
      writeStored(stored);
      populateAlarmSelect(alarmToneSelect, alarmLib, stored.alarmIndex);
    } else {
      if (alarmToneSelect && alarmToneSelect.options.length > 0) {
        alarmToneSelect.value = stored.alarmIndex || 0;
      }
    }

    const annLib = await fetchJsonSafe('/resource/sounds/announcement/library.json');
    if (annLib && Array.isArray(annLib.audio)) {
      stored.announcementLibrary = annLib;
      writeStored(stored);
      populateAnnouncementSelect(announcementSelect, annLib, stored.announcementIndex);
    } else {
      if (announcementSelect && announcementSelect.options.length > 0) {
        announcementSelect.value = stored.announcementIndex || 0;
      }
    }
  }

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

    if (alarmToneSelect) s.alarmIndex = clampInt(alarmToneSelect.value, 0);
    if (announcementSelect) s.announcementIndex = clampInt(announcementSelect.value, 0);

    if (prev.alarmLibrary) s.alarmLibrary = prev.alarmLibrary;
    if (prev.announcementLibrary) s.announcementLibrary = prev.announcementLibrary;

    writeStored(s);

    updateAddLabel(plusBtn, moreInput);
    updateSkipLabel(skipBtn, state, stateBeforePause);
    enablePlusOnlyWhenRunning(plusBtn, state);

    if (state === 'idle') {
      remainingSeconds = s.workMinutes * 60;
      renderTimerDisplay(timerEl, remainingSeconds);
      timerLabelEl.textContent = 'Time remaining until rest';
    }
  }

  function sendSystemNotification(title, body) {
    const stored = Object.assign({}, DEFAULTS, readStored());
    if (!stored.systemNotification) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch (e) { console.warn(e); }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          try { new Notification(title, { body }); } catch (e) { }
        }
      }).catch(() => { });
    }
  }

  function startTimerFor(seconds, cycle) {
    if (pauseBtn) pauseBtn.style.display = '';
    cancelTick();
    currentCycle = (cycle === 'rest') ? 'rest' : 'work';
    state = (cycle === 'rest') ? 'rest' : 'work';
    setButtonsForState(state, startBtn, pauseBtn, resetBtn, skipBtn, plusBtn, muteBtn, findMuteButton, stateBeforePause);
    timerLabelEl.textContent = (state === 'work') ? 'Time remaining until rest' : 'Rest time remaining';
    remainingSeconds = seconds;
    renderTimerDisplay(timerEl, remainingSeconds);
    targetEnd = Date.now() + seconds * 1000;
    tickTimer = setInterval(tickFunc, 250);
  }

  function tickFunc() {
    if (!targetEnd) return;
    const now = Date.now();
    const secLeft = Math.max(0, Math.round((targetEnd - now) / 1000));
    remainingSeconds = secLeft;
    renderTimerDisplay(timerEl, secLeft);
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

    state = 'alarming';
    if (clockCircle && !clockCircle.classList.contains('alarming')) clockCircle.classList.add('alarming');
    renderTimerDisplay(timerEl, 0);

    if (nextCycle === 'rest') {
      const secondsToRest = clampInt(restInput?.value, DEFAULTS.restSeconds);
      timerLabelEl.textContent = `End of session, look 20 feet away for ${secondsToRest} seconds to rest your eyes.`;
    } else {
      const secondsToWork = clampInt(workInput?.value, DEFAULTS.workMinutes) * 60;
      timerLabelEl.textContent = `End of break, back to work for ${Math.floor(secondsToWork / 60)} minutes.`;
    }

    setButtonsForState('alarming', startBtn, pauseBtn, resetBtn, skipBtn, plusBtn, muteBtn, findMuteButton, stateBeforePause);
    playSingleToneIfAllowed();
    if (stored.spokenAnnouncements) await playAnnouncementAudioFor(nextCycle);

    const alarmLib = stored.alarmLibrary || null;
    let alarmEntry = null;
    if (alarmLib && Array.isArray(alarmLib.audio)) {
      const idx = clampInt(stored.alarmIndex || alarmToneSelect?.value, 0);
      alarmEntry = alarmLib.audio[idx];
    }
    playAlarmLoopForSeconds(alarmEntry, 60);
  }

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
      setButtonsForState('paused', startBtn, pauseBtn, resetBtn, skipBtn, plusBtn, muteBtn, findMuteButton, stateBeforePause);
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
    renderTimerDisplay(timerEl, remainingSeconds);
    timerLabelEl.textContent = 'Time remaining until rest';
    setButtonsForState('idle', startBtn, pauseBtn, resetBtn, skipBtn, plusBtn, muteBtn, findMuteButton, stateBeforePause);
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

  if (plusBtn) plusBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const extra = clampInt(moreInput?.value, DEFAULTS.moreSeconds);
    if (state === 'work' || state === 'rest') {
      if (targetEnd) {
        targetEnd += extra * 1000;
      } else {
        remainingSeconds += extra;
      }
      renderTimerDisplay(timerEl, remainingSeconds);
    }
  });

  muteBtn = muteBtn || findMuteButton();
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      stopAlarmPlayback();
      stopAnnouncementPlayback();
    });
  }

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
      try { const a = new Audio(url); a.play().catch(() => { }); } catch (e) { console.warn(e); }
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
      try { const a = new Audio(url); a.play().catch(() => { }); } catch (e) { console.warn(e); }
    });
  }

  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      saveSettingsImmediate();
    });
  }

  [workInput, restInput, moreInput, instantNextCheckbox, systemNotificationCheckbox, muteNotificationCheckbox, muteAlarmCheckbox, alarmToneSelect, announcementSelect, spokenAnnouncementsCheckbox].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => {
      saveSettingsImmediate();
    });
  });

  (async function init() {
    await loadLibrariesAndSettings();
    const wm = clampInt(workInput?.value, DEFAULTS.workMinutes);
    remainingSeconds = wm * 60;
    renderTimerDisplay(timerEl, remainingSeconds);
    timerLabelEl.textContent = 'Time remaining until rest';
    setButtonsForState('idle', startBtn, pauseBtn, resetBtn, skipBtn, plusBtn, muteBtn, findMuteButton, stateBeforePause);

    const stored = Object.assign({}, DEFAULTS, readStored());
    if (stored.systemNotification && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  })();

  window.__twenty20_clock = {
    getState: () => ({ state, currentCycle, remainingSeconds }),
    start: () => startBtn && startBtn.click(),
    pause: () => pauseBtn && pauseBtn.click(),
    reset: () => resetBtn && resetBtn.click()
  };
})();
