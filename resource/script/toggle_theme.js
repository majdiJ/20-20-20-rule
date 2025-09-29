
(() => {
    const ICON_MOON_SUN = '/resource/icon/moon_sun.svg'; // system
    const ICON_MOON = '/resource/icon/moon.svg';        // dark
    const ICON_SUN = '/resource/icon/sun.svg';          // light

    const STORAGE_KEY = 'theme-preference'; // stores 'dark'|'light'|'system'
    const CYCLE = ['dark', 'light', 'system']; // cycle order for the top button

    // elements
    const toggleBtn = document.getElementById('light-dark-toggle');
    const toggleImg = toggleBtn ? toggleBtn.querySelector('img') : null;
    const select = document.getElementById('theme');

    // helpers for storage
    const readStored = () => {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            return v === 'dark' || v === 'light' || v === 'system' ? v : null;
        } catch (e) {
            return null;
        }
    };
    const writeStored = (val) => {
        try {
            localStorage.setItem(STORAGE_KEY, val);
        } catch (e) {
            // ignore storage errors (e.g. privacy mode)
        }
    };

    // apply theme: 'dark'|'light'|'system'
    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else { // system
            root.removeAttribute('data-theme');
        }
        // update UI parts (select + button icon)
        syncUIWithTheme(theme);
        // persist
        writeStored(theme);
    }

    // decide initial theme: stored or system
    function initTheme() {
        const stored = readStored();
        const initial = stored || 'system';
        // apply without double-saving (applyTheme writes to storage; that's fine for first-run)
        applyTheme(initial);
    }

    // return the currently active logical theme: 'dark'|'light'|'system'
    // note: we prefer reading storage because that's the user's logical preference.
    // if nothing stored, returns 'system'.
    function getCurrentThemeLogical() {
        const stored = readStored();
        return stored || 'system';
    }

    // update the button icon & select value to reflect the given logical theme
    function syncUIWithTheme(theme) {
        if (select) select.value = theme;

        if (toggleImg) {
            if (theme === 'dark') {
                toggleImg.src = ICON_MOON;
                toggleImg.alt = 'Dark mode';
                if (toggleBtn) toggleBtn.title = 'Switch to Light / System';
            } else if (theme === 'light') {
                toggleImg.src = ICON_SUN;
                toggleImg.alt = 'Light mode';
                if (toggleBtn) toggleBtn.title = 'Switch to System / Dark';
            } else { // system
                toggleImg.src = ICON_MOON_SUN;
                toggleImg.alt = 'System theme';
                if (toggleBtn) toggleBtn.title = 'Switch to Dark';
            }
        }
    }

    // cycle to the next theme in CYCLE array based on current logical theme
    function cycleTheme() {
        const cur = getCurrentThemeLogical();
        // find index: if cur not in CYCLE (shouldn't happen), treat as system
        let idx = CYCLE.indexOf(cur);
        if (idx === -1) idx = CYCLE.indexOf('system');
        const next = CYCLE[(idx + 1) % CYCLE.length];
        applyTheme(next);
    }

    // handle select changes (user chooses from settings)
    if (select) {
        select.addEventListener('change', (e) => {
            const v = (e.target.value || '').toString();
            if (v === 'dark' || v === 'light' || v === 'system') {
                applyTheme(v);
            }
        });
    }

    // handle top button (cycles)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cycleTheme();
        });
    }

    // listen for OS theme changes: only relevant if logical preference === 'system'
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    function systemPrefChangeHandler() {
        // Only visual CSS variables change automatically, but we might want to keep some sync:
        // If logical choice is 'system', keep UI in sync (we keep icon as moon_sun for system, so nothing to change).
        if (getCurrentThemeLogical() === 'system') {
            syncUIWithTheme('system');
        }
    }
    if (mq) {
        // modern
        if (mq.addEventListener) {
            mq.addEventListener('change', systemPrefChangeHandler);
        } else if (mq.addListener) {
            mq.addListener(systemPrefChangeHandler); // older browsers
        }
    }

    // initialize
    initTheme();

    // expose for debugging (optional)
    // window.__themeManager = { applyTheme, getCurrentThemeLogical, cycleTheme };
})();
