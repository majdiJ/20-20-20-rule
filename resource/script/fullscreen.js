
(() => {
    const btn = document.getElementById('full-screen-toggle');
    if (!btn) return; // safe-guard

    const img = btn.querySelector('img');

    const ICON_FULLSCREEN = '/resource/icon/fullscreen.svg';
    const ICON_EXIT = '/resource/icon/fullscreen_exit.svg';

    // cross-browser check for fullscreen element
    function isFullScreen() {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    // request fullscreen on the whole document
    async function enterFullscreen() {
        const el = document.documentElement;
        if (el.requestFullscreen) return el.requestFullscreen();
        if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
        if (el.msRequestFullscreen) return el.msRequestFullscreen();
        // nothing supported
        return Promise.reject(new Error('Fullscreen API is not supported'));
    }

    async function exitFullscreen() {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
        if (document.msExitFullscreen) return document.msExitFullscreen();
        return Promise.reject(new Error('Fullscreen API is not supported'));
    }

    // update icon/title/alt to match current state
    function updateIcon() {
        if (!img) return;
        if (isFullScreen()) {
            img.src = ICON_EXIT;
            img.alt = 'Exit Full Screen';
            btn.title = 'Exit Full Screen';
        } else {
            img.src = ICON_FULLSCREEN;
            img.alt = 'Toggle Full Screen';
            btn.title = 'Toggle Full Screen';
        }
    }

    // toggle on click
    btn.addEventListener('click', async () => {
        try {
            if (!isFullScreen()) {
                await enterFullscreen();
            } else {
                await exitFullscreen();
            }
            // icon will also update on fullscreenchange event, but update here too for immediate UX
            updateIcon();
        } catch (err) {
            console.error('Fullscreen toggle failed:', err);
        }
    });

    // listen for fullscreen changes (including Esc key / native controls)
    const changeEvents = [
        'fullscreenchange',
        'webkitfullscreenchange',
        'mozfullscreenchange',
        'MSFullscreenChange'
    ];
    changeEvents.forEach(ev => document.addEventListener(ev, updateIcon, false));

    // initial sync
    updateIcon();
})();
