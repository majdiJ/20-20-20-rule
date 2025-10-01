// ui.js
import { DEFAULTS } from './constants.js';
import { clampInt } from './storage.js';

export function formatMMSS(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function renderTimerDisplay(context, sec) {
  if (context.elements.timerEl) context.elements.timerEl.textContent = formatMMSS(sec);
}

export function updateSkipLabel(context) {
  const { skipBtn } = context.elements;
  if (!skipBtn) return;
  const inRest = (context.state === 'rest' || (context.state === 'paused' && context.stateBeforePause === 'rest'));
  const textSpan = skipBtn.querySelector('.button-text');
  if (textSpan) textSpan.textContent = inRest ? 'Skip to work' : 'Skip to rest';
}

export function updateAddLabel(context) {
  const { plusBtn, moreInput } = context.elements;
  if (!plusBtn || !moreInput) return;
  const n = clampInt(moreInput.value, DEFAULTS.moreSeconds);
  const textSpan = plusBtn.querySelector('.button-text');
  if (textSpan) textSpan.textContent = `Add +${n} sec`;
}

export function enablePlusOnlyWhenRunning(context) {
  const { plusBtn } = context.elements;
  if (!plusBtn) return;
  plusBtn.disabled = !(context.state === 'work' || context.state === 'rest');
}

export function setButtonsForState(context, s) {
  const { startBtn, pauseBtn, resetBtn, skipBtn, plusBtn, muteBtn } = context.elements;

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
    if (skipBtn) skipBtn.disabled = !(context.stateBeforePause === 'work');
  } else if (s === 'alarming') {
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (muteBtn) { muteBtn.style.display = ''; muteBtn.disabled = false; }
    if (startBtn) startBtn.disabled = false;
    if (resetBtn) resetBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = true;
    if (plusBtn) plusBtn.disabled = true;
  }
  updateSkipLabel(context);
  updateAddLabel(context);
  enablePlusOnlyWhenRunning(context);
}
