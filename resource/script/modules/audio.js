
import { DEFAULTS, readStored } from './storage.js';

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let alarmAudioEl = null;
let announcementAudioEl = null;
let alarmStopTimeout = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new AudioCtx(); } catch (e) { audioCtx = null; }
  }
  return !!audioCtx;
}

export function playBeep() {
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

export function buildPathForAlarmEntry(entry) {
  return `/resource/sounds/alarms/${entry.fileName || entry.audioName || ''}`;
}

export function buildPathForAnnouncementFile(entry, which) {
  if (!entry) return '';
  const fname = (which === 'rest') ? entry.rest : entry.work;
  return `/resource/sounds/announcement/${fname}`;
}

export function stopAlarmPlayback() {
  if (alarmAudioEl) {
    try { alarmAudioEl.pause(); alarmAudioEl.currentTime = 0; } catch(e) {}
    alarmAudioEl = null;
  }
  if (alarmStopTimeout) { clearTimeout(alarmStopTimeout); alarmStopTimeout = null; }
}

export function stopAnnouncementPlayback() {
  if (announcementAudioEl) {
    try { announcementAudioEl.pause(); announcementAudioEl.currentTime = 0; } catch(e) {}
    announcementAudioEl = null;
  } else {
    try { window.speechSynthesis.cancel(); } catch(e){}
  }
}

export function playAlarmLoopForSeconds(alarmEntry, seconds) {
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

export async function playAnnouncementAudioFor(which) {
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

export function playSingleToneIfAllowed() {
  const stored = Object.assign({}, DEFAULTS, readStored());
  if (stored.muteNotification) return;
  playBeep();
}
