// audio.js
import { DEFAULTS } from './constants.js';
import { readStored, clampInt } from './storage.js';

export function ensureAudioCtx(context) {
  if (!context.audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    try { context.audioCtx = new AudioCtx(); } catch(e) { context.audioCtx = null; }
  }
  return !!context.audioCtx;
}

export function playBeep(context) {
  const stored = Object.assign({}, DEFAULTS, readStored());
  if (stored.muteNotification) return;
  if (!ensureAudioCtx(context)) return;
  const now = context.audioCtx.currentTime;
  const o = context.audioCtx.createOscillator();
  const g = context.audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 880;
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(context.audioCtx.destination);
  o.start(now);
  g.gain.linearRampToValueAtTime(0.15, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  o.stop(now + 0.15);
}

export function playSingleToneIfAllowed(context) {
  const stored = Object.assign({}, DEFAULTS, readStored());
  if (stored.muteNotification) return;
  playBeep(context);
}

export function buildPathForAlarmEntry(entry) {
  return `/resource/sounds/alarms/${entry.fileName || entry.audioName || ''}`;
}
export function buildPathForAnnouncementFile(entry, which) {
  if (!entry) return '';
  const fname = (which === 'rest') ? entry.rest : entry.work;
  return `/resource/sounds/announcement/${fname}`;
}

export function stopAlarmPlayback(context) {
  if (context.alarmAudioEl) {
    try { context.alarmAudioEl.pause(); context.alarmAudioEl.currentTime = 0; } catch(e) {}
    context.alarmAudioEl = null;
  }
  if (context.alarmStopTimeout) { clearTimeout(context.alarmStopTimeout); context.alarmStopTimeout = null; }
}

export function stopAnnouncementPlayback(context) {
  if (context.announcementAudioEl) {
    try { context.announcementAudioEl.pause(); context.announcementAudioEl.currentTime = 0; } catch(e) {}
    context.announcementAudioEl = null;
  } else {
    try { window.speechSynthesis.cancel(); } catch(e) {}
  }
}

export function playAlarmLoopForSeconds(context, alarmEntry, seconds) {
  const stored = Object.assign({}, DEFAULTS, readStored());
  if (stored.muteAlarm) return;
  if (!alarmEntry) return;
  stopAlarmPlayback(context);
  const url = buildPathForAlarmEntry(alarmEntry);
  context.alarmAudioEl = new Audio(url);
  context.alarmAudioEl.loop = true;
  context.alarmAudioEl.play().catch(e => console.warn('Alarm play failed', e));
  context.alarmStopTimeout = setTimeout(() => stopAlarmPlayback(context), Math.max(1, seconds) * 1000);
}

export async function playAnnouncementAudioFor(context, which) {
  const stored = Object.assign({}, DEFAULTS, readStored());
  if (!stored.spokenAnnouncements) return;
  const lib = stored.announcementLibrary || null;
  if (!lib || !Array.isArray(lib.audio)) {
    const text = (which === 'rest') ? 'Time to rest. Look twenty feet away for twenty seconds.' : 'Time to work. Back to work now.';
    try { const ut = new SpeechSynthesisUtterance(text); window.speechSynthesis.cancel(); window.speechSynthesis.speak(ut); } catch(e) { console.warn('SpeechSynthesis failed', e); }
    return;
  }
  const idx = clampInt(stored.announcementIndex || context.elements.announcementSelect?.value, 0);
  const entry = lib.audio[idx];
  if (!entry) return;
  const url = buildPathForAnnouncementFile(entry, which);
  stopAnnouncementPlayback(context);
  context.announcementAudioEl = new Audio(url);
  context.announcementAudioEl.play().catch(e => console.warn('Announcement play failed', e));
}
