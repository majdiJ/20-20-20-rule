(() => {
    let inProgress = false;

    async function clearAllClientData() {
        // Prevent double runs
        if (inProgress) return;
        inProgress = true;

        // 1) local/session storage
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (err) {
            // ignore storage errors (e.g. privacy mode)
            console.warn('Storage clear failed:', err);
        }

        // 2) Cache API
        if ('caches' in window) {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            } catch (err) {
                console.warn('Cache API clear failed:', err);
            }
        }

        // 3) IndexedDB
        if ('indexedDB' in window) {
            try {
                // indexedDB.databases() is not available in all browsers
                if (typeof indexedDB.databases === 'function') {
                    const dbs = await indexedDB.databases();
                    await Promise.all(dbs.map(db => {
                        if (!db.name) return Promise.resolve(false);
                        return new Promise((res) => {
                            const req = indexedDB.deleteDatabase(db.name);
                            req.onsuccess = () => res(true);
                            req.onerror = () => res(false);
                            req.onblocked = () => res(false);
                        });
                    }));
                } else {
                    // older browsers: best-effort — nothing universal we can enumerate. skip.
                }
            } catch (err) {
                console.warn('IndexedDB clear failed:', err);
            }
        }

        // 4) Service Workers
        if ('serviceWorker' in navigator) {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister().catch(() => { })));
            } catch (err) {
                console.warn('Service worker unregister failed:', err);
            }
        }

        // 5) Cookies (cannot remove HttpOnly cookies)
        try {
            const cookies = document.cookie ? document.cookie.split(';') : [];
            cookies.forEach(c => {
                const eqPos = c.indexOf('=');
                const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
                if (!name) return;
                // expire on path=/ and attempt hostname
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                try {
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
                } catch (e) {
                    // some browsers may throw on setting domain in certain contexts
                }
            });
        } catch (err) {
            console.warn('Cookie clear failed:', err);
        }

        // finished: notify user and reload
        try {
            alert('Local storage cleared!');
        } catch (err) {
            // if alert is blocked, still try to reload
            console.warn('Alert failed:', err);
        }

        // Force reload (true reload from server)
        try {
            window.location.reload();
        } catch (err) {
            console.warn('Reload failed:', err);
        }
    }

    // Delegated listener: catches clicks on any element with class 'clear-cache-action'
    document.addEventListener('click', (ev) => {
        const btn = ev.target.closest && ev.target.closest('.clear-cache-action');
        if (!btn) return;
        ev.preventDefault();
        clearAllClientData();
    }, false);

    // Optionally expose for debugging:
    // window.__clearClientData = clearAllClientData;
})();
