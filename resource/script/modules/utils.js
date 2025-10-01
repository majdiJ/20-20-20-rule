
export function clampInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && !isNaN(n) ? n : fallback;
}

export async function fetchJsonSafe(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn('fetchJsonSafe', url, e);
    return null;
  }
}
