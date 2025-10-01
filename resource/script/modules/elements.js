// elements.js
// Collect and return all DOM element references used by the timer
export function findMuteButton() {
  const candidates = Array.from(document.querySelectorAll('.primary-buttons'));
  return candidates.find(b => {
    const img = b.querySelector('img');
    return img && img.alt && img.alt.toLowerCase().includes('mute');
  }) || null;
}

export function getElements() {
  return {
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.querySelector('#pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    skipBtn: document.getElementById('skip-btn'),
    plusBtn: document.getElementById('plus-time-btn'),
    timerLabelEl: document.getElementById('timer-label'),
    timerEl: document.getElementById('timer'),
    clockCircle: document.querySelector('.clock-circle'),
    workInput: document.getElementById('work-duration'),
    restInput: document.getElementById('rest-duration'),
    moreInput: document.getElementById('more-time-duration'),
    instantNextCheckbox: document.getElementById('instant-next'),
    systemNotificationCheckbox: document.getElementById('system-notification'),
    muteNotificationCheckbox: document.getElementById('mute-notification-tone'),
    muteAlarmCheckbox: document.getElementById('mute-alarm-tone'),
    alarmToneSelect: document.getElementById('alarm-tone'),
    alarmToneSample: document.getElementById('alarm-tone-sample'),
    announcementSelect: document.getElementById('spoken-announcement-lang'),
    announcementSample: document.getElementById('spoken-announcement-sample'),
    spokenAnnouncementsCheckbox: document.getElementById('spoken-announcements'),
    settingsCloseBtn: document.getElementById('settings-close-btn'),
    muteBtn: findMuteButton()
  };
}
