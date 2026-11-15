// Shared playback speed for everything simulated on the page.
export const ROTATION_PERIOD_S = 16.11 * 3600; // Neptune's sidereal day (16.11 h)
export const SCREEN_SECONDS_PER_DAY = 60; // speed-up so one Neptune day takes a minute on screen
export const TIME_SCALE = ROTATION_PERIOD_S / SCREEN_SECONDS_PER_DAY; // simulated seconds per real second
