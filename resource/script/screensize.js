
(function () {
  // Config
  const CSS_VAR = '--clock-circle-scale';
  const SELECTOR = '.clock-section .clock-circle';
  const SECTION_SELECTOR = '.clock-section';
  const MAX_DIAMETER_PX = 800;     // absolute maximum outer diameter
  const VIEWPORT_MARGIN_PX = 40;   // breathing room from edges
  const MIN_SCALE = 0.25;         // don't shrink smaller than this

  // Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Compute and apply scale
  function applyScale() {
    const circle = document.querySelector(SELECTOR);
    if (!circle) return;

    // measure the real base diameter including borders
    const baseRect = circle.getBoundingClientRect();
    const baseDiameter = baseRect.width || 600; // fallback if something weird

    // prefer sizing relative to the clock-section container if present
    const section = document.querySelector(SECTION_SELECTOR);
    let available;
    if (section) {
      const sRect = section.getBoundingClientRect();
      available = Math.min(sRect.width, sRect.height);
    } else {
      // fallback to viewport size
      available = Math.min(window.innerWidth, window.innerHeight);
    }

    // compute allowed outer diameter: viewport/container minus margin, but capped by MAX_DIAMETER_PX
    const allowedDiameter = clamp(available - VIEWPORT_MARGIN_PX, 0, MAX_DIAMETER_PX);

    // scale = how much to multiply the baseDiameter by so it becomes allowedDiameter
    let scale = allowedDiameter / baseDiameter;

    // clamp scale so we don't get too tiny or too large
    const maxScale = MAX_DIAMETER_PX / baseDiameter;
    scale = clamp(scale, MIN_SCALE, maxScale);

    // set CSS var on root
    document.documentElement.style.setProperty(CSS_VAR, String(scale));
  }

  // rAF debounce for resize
  let rafId = null;
  function scheduleApply() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => { applyScale(); rafId = null; });
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyScale();
    });
  } else {
    applyScale();
  }

  // window resize -> adjust
  window.addEventListener('resize', scheduleApply);

  // If clock-section changes size (e.g. layout changes), observe it
  const section = document.querySelector(SECTION_SELECTOR);
  if (section && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(scheduleApply);
    ro.observe(section);
  }
})();