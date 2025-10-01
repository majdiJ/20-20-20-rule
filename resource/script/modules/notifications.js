// notifications.js
import { DEFAULTS } from './constants.js';
import { readStored } from './storage.js';

export function sendSystemNotification(title, body) {
  const stored = Object.assign({}, DEFAULTS, readStored());
  if (!stored.systemNotification) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch(e) { console.warn(e); }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        try { new Notification(title, { body }); } catch(e) {}
      }
    }).catch(()=>{});
  }
}
