
import { DEFAULTS, readStored } from './storage.js';
import { clampInt } from './utils.js';

export function formatMMSS(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function renderTimerDisplay(timerEl, sec) {
  if (timerEl) timerEl.textContent = formatMMSS(sec);
}

export function updateSkipLabel(skipBtn, state, stateBeforePause) {
  if (!skipBtn) return;
  const inRest = (state === 'rest' || (state === 'paused' && stateBeforePause === 'rest'));
  const textSpan = skipBtn.querySelector('.button-text');
  if (textSpan) textSpan.textContent = inRest ? 'Skip to work' : 'Skip to rest';
}

export function updateAddLabel(plusBtn, moreInput) {
  if (!plusBtn || !moreInput) return;
  const n = clampInt(moreInput.value, DEFAULTS.moreSeconds);
  const textSpan = plusBtn.querySelector('.button-text');
  if (textSpan) textSpan.textContent = `Add +${n} sec`;
}

export function enablePlusOnlyWhenRunning(plusBtn, state) {
  if (!plusBtn) return;
  plusBtn.disabled = !(state === 'work' || state === 'rest');
}

export function setButtonsForState(s, startBtn, pauseBtn, resetBtn, skipBtn, plusBtn, muteBtn, findMuteButton, stateBeforePause) {
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
    if (plusBtn) plusBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = !(stateBeforePause === 'work');
  } else if (s === 'alarming') {
    if (pauseBtn) pauseBtn.style.display = 'none';
    muteBtn = muteBtn || findMuteButton();
    if (muteBtn) { muteBtn.style.display = ''; muteBtn.disabled = false; }
    if (startBtn) startBtn.disabled = false;
    if (resetBtn) resetBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = true;
    if (plusBtn) plusBtn.disabled = true;
  }
}

export function populateAlarmSelect(alarmToneSelect, lib, selectedIdx) {
  if (!alarmToneSelect || !lib || !Array.isArray(lib.audio)) return;
  alarmToneSelect.innerHTML = '';
  lib.audio.forEach((entry, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = entry.audioName || `Alarm ${idx+1}`;
    alarmToneSelect.appendChild(opt);
  });
  const stored = readStored();
  const idxToUse = (typeof stored.alarmIndex === 'number') ? stored.alarmIndex : (selectedIdx || 0);
  alarmToneSelect.value = Math.min(idxToUse, alarmToneSelect.options.length - 1);
}

export function populateAnnouncementSelect(announcementSelect, lib, selectedIdx) {
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
