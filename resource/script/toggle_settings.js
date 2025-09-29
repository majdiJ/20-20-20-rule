
// grab the elements
const openBtn = document.getElementById('settings-open-btn');
const closeBtn = document.getElementById('settings-close-btn');
const panels = document.querySelectorAll('.settings-panel-section');

// helper functions to show/hide all panels with that class
function showSettings() {
    panels.forEach(panel => panel.style.display = 'block'); // "true" -> block
}

function hideSettings() {
    panels.forEach(panel => panel.style.display = 'none');  // "false" -> none
}

// attach events (safe if buttons are missing)
if (openBtn) openBtn.addEventListener('click', showSettings);
if (closeBtn) closeBtn.addEventListener('click', hideSettings);