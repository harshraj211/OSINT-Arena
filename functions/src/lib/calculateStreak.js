/**
 * calculateStreak.js
 * Pure function — zero Firebase dependencies.
 * All dates normalized to UTC calendar day (YYYY-MM-DD).
 */

/**
 * Returns today's date as a UTC string: "YYYY-MM-DD"
 * @returns {string}
 */
function getTodayUTC() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Returns yesterday's date as a UTC string: "YYYY-MM-DD"
 * @returns {string}
 */
function getYesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

/**
 * Core streak update logic.
 * Called server-side after a CORRECT submission only.
 *
 * @param {Object} params
 * @param {string|null} params.lastActiveDate - "YYYY-MM-DD" or null if new user
 * @param {number} params.currentStreak       - current streak count
 * @param {number} params.maxStreak           - all-time max streak
 *
 * @returns {{
 *   currentStreak: number,
 *   maxStreak: number,
 *   lastActiveDate: string,
 *   streakChanged: boolean,
 *   action: 'no_change' | 'incremented' | 'reset'
 * }}
 */
function calculateStreak({ lastActiveDate, currentStreak, maxStreak }) {
  const today = getTodayUTC();
  const yesterday = getYesterdayUTC();

  // Already solved something today — streak unchanged
  if (lastActiveDate === today) {
    return {
      currentStreak,
      maxStreak,
      lastActiveDate,
      streakChanged: false,
      action: "no_change",
    };
  }

  let newStreak;
  let action;

  if (lastActiveDate === yesterday) {
    // Solved yesterday — extend streak
    newStreak = currentStreak + 1;
    action = "incremented";
  } else {
    // Gap in activity — reset streak to 1
    newStreak = 1;
    action = "reset";
  }

  const newMaxStreak = Math.max(maxStreak, newStreak);

  return {
    currentStreak: newStreak,
    maxStreak: newMaxStreak,
    lastActiveDate: today,
    streakChanged: true,
    action,
  };
}

/**
 * Applies a streak freeze for a missed day.
 * Called by a scheduled job that checks for users who had a streak
 * but didn't solve anything yesterday.
 *
 * @param {Object} params
 * @param {string} params.lastActiveDate   - "YYYY-MM-DD"
 * @param {number} params.currentStreak
 * @param {number} params.freezesAvailable - how many freeze days remain
 *
 * @returns {{
 *   currentStreak: number,
 *   freezesAvailable: number,
 *   freezeApplied: boolean,
 *   reason: string
 * }}
 */
function applyStreakFreeze({ lastActiveDate, currentStreak, freezesAvailable }) {
  const yesterday = getYesterdayUTC();

  // Only apply freeze if user missed exactly yesterday (not a longer gap)
  if (lastActiveDate !== yesterday) {
    return {
      currentStreak,
      freezesAvailable,
      freezeApplied: false,
      reason: "freeze_only_covers_single_day_gap",
    };
  }

  if (freezesAvailable <= 0) {
    return {
      currentStreak,
      freezesAvailable: 0,
      freezeApplied: false,
      reason: "no_freezes_available",
    };
  }

  return {
    currentStreak, // Streak preserved
    freezesAvailable: freezesAvailable - 1,
    freezeApplied: true,
    reason: "freeze_applied_successfully",
  };
}

/**
 * Calculates how many freeze days a Pro user should receive this month reset.
 * Called on 1st of every month.
 * @returns {number}
 */
function getMonthlyFreezeAllocation() {
  return 2;
}

module.exports = {
  calculateStreak,
  applyStreakFreeze,
  getMonthlyFreezeAllocation,
  getTodayUTC,
  getYesterdayUTC,
};