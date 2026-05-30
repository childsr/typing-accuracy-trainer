// Letter sets for practice
export const CHAR_SET_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CHAR_SET_VOWELS = 'AEIOU';
export const CHAR_SET_TOP_ROW = 'QWERTYUIOP';
export const CHAR_SET_HOME_ROW = 'ASDFGHJKL';
export const CHAR_SET_BOTTOM_ROW = 'ZXCVBNM';
export const CHAR_SET_LEFT_HAND = 'QWERTASDFGZXCVB';
export const CHAR_SET_RIGHT_HAND = 'YUIOPHJKLNM';

export const CHAR_SETS = [
  { id: 'all', name: 'Full Alphabet', chars: CHAR_SET_ALPHABET },
  { id: 'vowels', name: 'Vowels Only', chars: CHAR_SET_VOWELS },
  { id: 'homerow', name: 'Home Row (ASDF...)', chars: CHAR_SET_HOME_ROW },
  { id: 'toprow', name: 'Top Row (QWER...)', chars: CHAR_SET_TOP_ROW },
  { id: 'bottomrow', name: 'Bottom Row (ZXCV...)', chars: CHAR_SET_BOTTOM_ROW },
  { id: 'lefthand', name: 'Left Hand Only', chars: CHAR_SET_LEFT_HAND },
  { id: 'righthand', name: 'Right Hand Only', chars: CHAR_SET_RIGHT_HAND },
];

export const STORAGE_KEY_HISTORY = 'speed_typer_history_v2';
export const HISTORY_LENGTH = 20;

export const INSTANT_FEEDBACK_DURATION_MS = 200;

export const SPRINT_CHAR_COUNT = 30; // Target length for 30-Letter Sprint mode

// Dynamic timer speed configuration
export const TIMER_START_MS = 3000;
export const TIMER_MIN_MS = 500;
export const TIMER_REDUCTION_PER_STREAK_MS = 100; // Decreases limit by 100ms on each increment of the streak

const TIMER_CURVE_SHALLOWNESS = 6.25;
/**
 * Calculates current time limit based on the number of letters typed so far (n/streak).
 * The limit decreases dynamically as the streak increases, with a floor of TIMER_MIN_MS.
 */
export function getTimerLimitMs(n: number): number {
  // return Math.max(TIMER_MIN_MS, TIMER_START_MS - n * TIMER_REDUCTION_PER_STREAK_MS);
  return TIMER_CURVE_SHALLOWNESS * TIMER_START_MS / (n + TIMER_CURVE_SHALLOWNESS);
}

