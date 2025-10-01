// Modular refactor entrypoint for the 20-20-20 timer
// This file wires together all modules and preserves original functionality.
import { DEFAULTS } from './modules/constants.js';
import { readStored, writeStored, clampInt } from './modules/storage.js';
import { getElements, findMuteButton } from './modules/elements.js';
import { formatMMSS, renderTimerDisplay, updateSkipLabel, updateAddLabel, enablePlusOnlyWhenRunning, setButtonsForState } from './modules/ui.js';
import { playBeep, playSingleToneIfAllowed, stopAlarmPlayback, stopAnnouncementPlayback, playAlarmLoopForSeconds, playAnnouncementAudioFor } from './modules/audio.js';
import { sendSystemNotification } from './modules/notifications.js';
import { loadLibrariesAndSettings, saveSettingsImmediate } from './modules/settings.js';

const context = {
  state: 'idle',
  currentCycle: 'work',
  remainingSeconds: 0,
  targetEnd: null,
  tickTimer: null,
  stateBeforePause: null,
  audioCtx: null,
  alarmAudioEl: null,
  announcementAudioEl: null,
  alarmStopTimeout: null,
  elements: getElements()
};

// Re-alias commonly used element references for readability
const el = context.elements;
// Ensure mute button reference is kept updated (HTML had duplicate id orig.)
el.muteBtn = el.muteBtn || findMuteButton();

function startTimerFor(seconds, cycle) {
  if (el.pauseBtn) el.pauseBtn.style.display = '';
  cancelTick();
  context.currentCycle = (cycle === 'rest') ? 'rest' : 'work';
  context.state = context.currentCycle;
  setButtonsForState(context, context.state);
  if (el.timerLabelEl) el.timerLabelEl.textContent = (context.state === 'work') ? 'Time remaining until rest' : 'Rest time remaining';
  context.remainingSeconds = seconds;
  renderTimerDisplay(context, context.remainingSeconds);
  context.targetEnd = Date.now() + seconds * 1000;
  context.tickTimer = setInterval(tickFunc, 250);
}

function tickFunc() {
  if (!context.targetEnd) return;
  const now = Date.now();
  const secLeft = Math.max(0, Math.round((context.targetEnd - now) / 1000));
  context.remainingSeconds = secLeft;
  renderTimerDisplay(context, secLeft);
  if (secLeft <= 0) {
    cancelTick();
    onTimerComplete();
  }
}

function cancelTick() {
  if (context.tickTimer) { clearInterval(context.tickTimer); context.tickTimer = null; }
  context.targetEnd = null;
}

async function onTimerComplete() {
  const stored = Object.assign({}, DEFAULTS, readStored());
  const instant = !!(el.instantNextCheckbox?.checked || stored.instantNext);
  const nextCycle = (context.currentCycle === 'work') ? 'rest' : 'work';

  if (instant) {
    playSingleToneIfAllowed(context);
    await playAnnouncementAudioFor(context, nextCycle);
    if (context.currentCycle === 'work') {
      const r = clampInt(el.restInput?.value, DEFAULTS.restSeconds);
      startTimerFor(r, 'rest');
    } else {
      const w = clampInt(el.workInput?.value, DEFAULTS.workMinutes) * 60;
      startTimerFor(w, 'work');
    }
    return;
  }

  context.state = 'alarming';
  if (el.clockCircle && !el.clockCircle.classList.contains('alarming')) el.clockCircle.classList.add('alarming');
  renderTimerDisplay(context, 0);

  if (nextCycle === 'rest') {
    const secondsToRest = clampInt(el.restInput?.value, DEFAULTS.restSeconds);
    if (el.timerLabelEl) el.timerLabelEl.textContent = `End of session, look 20 feet away for ${secondsToRest} seconds to rest your eyes.`;
  } else {
    const secondsToWork = clampInt(el.workInput?.value, DEFAULTS.workMinutes) * 60;
    if (el.timerLabelEl) el.timerLabelEl.textContent = `End of break, back to work for ${Math.floor(secondsToWork/60)} minutes.`;
  }

  setButtonsForState(context, 'alarming');
  playSingleToneIfAllowed(context);
  if (stored.spokenAnnouncements) await playAnnouncementAudioFor(context, nextCycle);

  const alarmLib = stored.alarmLibrary || null;
  let alarmEntry = null;
  if (alarmLib && Array.isArray(alarmLib.audio)) {
    const idx = clampInt(stored.alarmIndex || el.alarmToneSelect?.value, 0);
    alarmEntry = alarmLib.audio[idx];
  }
  playAlarmLoopForSeconds(context, alarmEntry, 60);
}

// Button handlers
el.startBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (context.state === 'idle') {
    const wm = clampInt(el.workInput?.value, DEFAULTS.workMinutes);
    startTimerFor(wm * 60, 'work');
  } else if (context.state === 'paused') {
    startTimerFor(context.remainingSeconds, context.stateBeforePause || context.currentCycle || 'work');
  } else if (context.state === 'alarming') {
    stopAlarmPlayback(context);
    stopAnnouncementPlayback(context);
    if (el.clockCircle) el.clockCircle.classList.remove('alarming');
    const nextCycle = (context.currentCycle === 'work') ? 'rest' : 'work';
    if (nextCycle === 'rest') {
      const rs = clampInt(el.restInput?.value, DEFAULTS.restSeconds);
      startTimerFor(rs, 'rest');
    } else {
      const ws = clampInt(el.workInput?.value, DEFAULTS.workMinutes) * 60;
      startTimerFor(ws, 'work');
    }
  }
});

el.pauseBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (context.state === 'work' || context.state === 'rest') {
    context.stateBeforePause = context.state;
    cancelTick();
    context.state = 'paused';
    if (el.timerLabelEl) el.timerLabelEl.textContent = 'Paused';
    setButtonsForState(context, 'paused');
  }
});

el.resetBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  stopAlarmPlayback(context);
  stopAnnouncementPlayback(context);
  if (el.clockCircle) el.clockCircle.classList.remove('alarming');
  cancelTick();
  context.state = 'idle';
  const wm = clampInt(el.workInput?.value, DEFAULTS.workMinutes);
  context.remainingSeconds = wm * 60;
  renderTimerDisplay(context, context.remainingSeconds);
  if (el.timerLabelEl) el.timerLabelEl.textContent = 'Time remaining until rest';
  setButtonsForState(context, 'idle');
  if (el.pauseBtn) el.pauseBtn.style.display = '';
});

el.skipBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (context.state === 'work' || (context.state === 'paused' && context.stateBeforePause === 'work')) {
    cancelTick();
    const r = clampInt(el.restInput?.value, DEFAULTS.restSeconds);
    startTimerFor(r, 'rest');
  } else if (context.state === 'rest' || (context.state === 'paused' && context.stateBeforePause === 'rest')) {
    cancelTick();
    const w = clampInt(el.workInput?.value, DEFAULTS.workMinutes) * 60;
    startTimerFor(w, 'work');
  }
});

el.plusBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  const extra = clampInt(el.moreInput?.value, DEFAULTS.moreSeconds);
  if (context.state === 'work' || context.state === 'rest') {
    if (context.targetEnd) {
      context.targetEnd += extra * 1000;
    } else {
      context.remainingSeconds += extra;
    }
    renderTimerDisplay(context, context.remainingSeconds);
  }
});

el.muteBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  stopAlarmPlayback(context);
  stopAnnouncementPlayback(context);
});

el.alarmToneSample?.addEventListener('click', (e) => {
  e.preventDefault();
  const stored = Object.assign({}, DEFAULTS, readStored());
  const lib = stored.alarmLibrary || null;
  if (!lib || !Array.isArray(lib.audio)) return;
  const idx = clampInt(el.alarmToneSelect?.value, stored.alarmIndex || 0);
  const entry = lib.audio[idx];
  if (!entry) return;
  const url = `/resource/sounds/alarms/${entry.fileName || entry.audioName || ''}`;
  try { const a = new Audio(url); a.play().catch(()=>{}); } catch(err) { console.warn(err); }
});

el.announcementSample?.addEventListener('click', (e) => {
  e.preventDefault();
  const stored = Object.assign({}, DEFAULTS, readStored());
  const lib = stored.announcementLibrary || null;
  if (!lib || !Array.isArray(lib.audio)) return;
  const idx = clampInt(el.announcementSelect?.value, stored.announcementIndex || 0);
  const entry = lib.audio[idx];
  if (!entry) return;
  const fname = entry.rest || entry.work || entry.fileName;
  const url = `/resource/sounds/announcement/${fname}`;
  try { const a = new Audio(url); a.play().catch(()=>{}); } catch(err) { console.warn(err); }
});

el.settingsCloseBtn?.addEventListener('click', (ev) => {
  ev.preventDefault();
  saveSettingsImmediate(context);
});

[
  el.workInput, el.restInput, el.moreInput, el.instantNextCheckbox, el.systemNotificationCheckbox,
  el.muteNotificationCheckbox, el.muteAlarmCheckbox, el.alarmToneSelect, el.announcementSelect,
  el.spokenAnnouncementsCheckbox
].forEach(domEl => {
  if (!domEl) return;
  domEl.addEventListener('change', () => saveSettingsImmediate(context));
});

(async function init() {
  await loadLibrariesAndSettings(context);
  const wm = clampInt(el.workInput?.value, DEFAULTS.workMinutes);
  context.remainingSeconds = wm * 60;
  renderTimerDisplay(context, context.remainingSeconds);
  if (el.timerLabelEl) el.timerLabelEl.textContent = 'Time remaining until rest';
  setButtonsForState(context, 'idle');
  const stored = Object.assign({}, DEFAULTS, readStored());
  if (stored.systemNotification && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(()=>{});
  }
})();

// Debug helpers
window.__twenty20_clock = {
  getState: () => ({ state: context.state, currentCycle: context.currentCycle, remainingSeconds: context.remainingSeconds }),
  start: () => el.startBtn && el.startBtn.click(),
  pause: () => el.pauseBtn && el.pauseBtn.click(),
  reset: () => el.resetBtn && el.resetBtn.click()
};

