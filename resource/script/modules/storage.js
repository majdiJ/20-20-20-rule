
export const STORAGE_KEY = 'twenty20timer:settings:v2';

export const DEFAULTS = {
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

export function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('readStored error', e);
    return {};
  }
}

export function writeStored(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('writeStored error', e);
  }
}
