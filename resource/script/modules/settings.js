// settings.js
import { DEFAULTS } from './constants.js';
import { readStored, writeStored, clampInt } from './storage.js';
import { updateAddLabel, updateSkipLabel, enablePlusOnlyWhenRunning, renderTimerDisplay } from './ui.js';

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

function populateAlarmSelect(context, lib, selectedIdx) {
  const sel = context.elements.alarmToneSelect;
  if (!sel || !lib || !Array.isArray(lib.audio)) return;
  sel.innerHTML = '';
  lib.audio.forEach((entry, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = entry.audioName || `Alarm ${idx+1}`;
    sel.appendChild(opt);
  });
  const stored = readStored();
  const idxToUse = (typeof stored.alarmIndex === 'number') ? stored.alarmIndex : (selectedIdx || 0);
  sel.value = Math.min(idxToUse, sel.options.length - 1);
}

function populateAnnouncementSelect(context, lib, selectedIdx) {
  const sel = context.elements.announcementSelect;
  if (!sel || !lib || !Array.isArray(lib.audio)) return;
  sel.innerHTML = '';
  lib.audio.forEach((entry, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = entry.audioName || `Announcement ${idx+1}`;
    sel.appendChild(opt);
  });
  const stored = readStored();
  const idxToUse = (typeof stored.announcementIndex === 'number') ? stored.announcementIndex : (selectedIdx || 0);
  sel.value = Math.min(idxToUse, sel.options.length - 1);
}

export async function loadLibrariesAndSettings(context) {
  const stored = Object.assign({}, DEFAULTS, readStored());
  const el = context.elements;

  if (el.workInput) el.workInput.value = clampInt(stored.workMinutes, DEFAULTS.workMinutes);
  if (el.restInput) el.restInput.value = clampInt(stored.restSeconds, DEFAULTS.restSeconds);
  if (el.moreInput) el.moreInput.value = clampInt(stored.moreSeconds, DEFAULTS.moreSeconds);
  if (el.instantNextCheckbox) el.instantNextCheckbox.checked = !!stored.instantNext;
  if (el.systemNotificationCheckbox) el.systemNotificationCheckbox.checked = !!stored.systemNotification;
  if (el.muteNotificationCheckbox) el.muteNotificationCheckbox.checked = !!stored.muteNotification;
  if (el.muteAlarmCheckbox) el.muteAlarmCheckbox.checked = !!stored.muteAlarm;
  if (el.spokenAnnouncementsCheckbox) el.spokenAnnouncementsCheckbox.checked = !!stored.spokenAnnouncements;

  const alarmLib = await fetchJsonSafe('/resource/sounds/alarms/library.json');
  if (alarmLib && Array.isArray(alarmLib.audio)) {
    stored.alarmLibrary = alarmLib;
    writeStored(stored);
    populateAlarmSelect(context, alarmLib, stored.alarmIndex);
  } else if (el.alarmToneSelect && el.alarmToneSelect.options.length > 0) {
    el.alarmToneSelect.value = stored.alarmIndex || 0;
  }

  const annLib = await fetchJsonSafe('/resource/sounds/announcement/library.json');
  if (annLib && Array.isArray(annLib.audio)) {
    stored.announcementLibrary = annLib;
    writeStored(stored);
    populateAnnouncementSelect(context, annLib, stored.announcementIndex);
  } else if (el.announcementSelect && el.announcementSelect.options.length > 0) {
    el.announcementSelect.value = stored.announcementIndex || 0;
  }
}

export function saveSettingsImmediate(context) {
  const { elements: el } = context;
  const prev = Object.assign({}, DEFAULTS, readStored());
  const s = Object.assign({}, prev);
  s.workMinutes = clampInt(el.workInput?.value, DEFAULTS.workMinutes);
  s.restSeconds = clampInt(el.restInput?.value, DEFAULTS.restSeconds);
  s.moreSeconds = clampInt(el.moreInput?.value, DEFAULTS.moreSeconds);
  s.instantNext = !!el.instantNextCheckbox?.checked;
  s.systemNotification = !!el.systemNotificationCheckbox?.checked;
  s.muteNotification = !!el.muteNotificationCheckbox?.checked;
  s.muteAlarm = !!el.muteAlarmCheckbox?.checked;
  s.spokenAnnouncements = !!el.spokenAnnouncementsCheckbox?.checked;
  if (el.alarmToneSelect) s.alarmIndex = clampInt(el.alarmToneSelect.value, 0);
  if (el.announcementSelect) s.announcementIndex = clampInt(el.announcementSelect.value, 0);
  if (prev.alarmLibrary) s.alarmLibrary = prev.alarmLibrary;
  if (prev.announcementLibrary) s.announcementLibrary = prev.announcementLibrary;
  writeStored(s);
  updateAddLabel(context);
  updateSkipLabel(context);
  enablePlusOnlyWhenRunning(context);
  if (context.state === 'idle') {
    context.remainingSeconds = s.workMinutes * 60;
    renderTimerDisplay(context, context.remainingSeconds);
    if (el.timerLabelEl) el.timerLabelEl.textContent = 'Time remaining until rest';
  }
}
