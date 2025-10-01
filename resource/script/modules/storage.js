// storage.js
import { STORAGE_KEY } from './constants.js';

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

export function clampInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && !isNaN(n) ? n : fallback;
}
