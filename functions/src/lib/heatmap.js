/**
 * heatmap.js
 * Pure functions — zero Firebase dependencies.
 *
 * Heatmap data structure in Firestore:
 *   heatmap/{userId}/{year}  →  { "2026-02-25": 3, "2026-02-26": 1, ... }
 *
 * Frontend renders 365 days as a grid (GitHub contribution style).
 */

const { getTodayUTC } = require("./calculateStreak");

/**
 * Returns the current UTC year as a string.
 * Used as the Firestore document ID under heatmap/{userId}/{year}
 * @returns {string}  e.g. "2026"
 */
function getCurrentYear() {
  return new Date().getUTCFullYear().toString();
}

/**
 * Increments the solve count for today in a heatmap year-document.
 * Returns the updated map to be written back to Firestore.
 *
 * @param {Object} existingYearMap - Current heatmap doc data (may be empty for new year)
 * @returns {{ updatedMap: Object, dateKey: string, newCount: number }}
 */
function incrementHeatmapDay(existingYearMap = {}) {
  const dateKey = getTodayUTC();
  const currentCount = existingYearMap[dateKey] || 0;
  const newCount = currentCount + 1;

  return {
    updatedMap: {
      ...existingYearMap,
      [dateKey]: newCount,
    },
    dateKey,
    newCount,
  };
}

/**
 * Generates an array of the last N days as "YYYY-MM-DD" strings.
 * Used by the frontend to build the heatmap grid.
 *
 * @param {number} [days=365]
 * @returns {string[]}
 */
function getLastNDays(days = 365) {
  const result = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    result.push(d.toISOString().split("T")[0]);
  }

  return result;
}

/**
 * Merges heatmap data from multiple year documents into a single flat map.
 * Needed when 365-day window spans two calendar years.
 *
 * @param {Object[]} yearDocs - Array of year doc data objects
 * @returns {Object} - Merged { "YYYY-MM-DD": count } map
 */
function mergeYearDocs(yearDocs = []) {
  return yearDocs.reduce((acc, doc) => ({ ...acc, ...doc }), {});
}

/**
 * Maps a solve count to a heatmap color class.
 * Used both on frontend (CSS classes) and for any SSR/export.
 *
 * Color thresholds match GitHub contribution graph convention:
 *   0    → grey   (#161B22)
 *   1    → light  (#9be9a8)
 *   2-3  → medium (#40c463)
 *   4+   → dark   (#216e39)
 *
 * @param {number} count
 * @returns {{ level: 0|1|2|3, color: string, className: string }}
 */
function getHeatmapColor(count) {
  if (!count || count === 0) {
    return { level: 0, color: "#161B22", className: "heatmap-empty" };
  }
  if (count === 1) {
    return { level: 1, color: "#9be9a8", className: "heatmap-light" };
  }
  if (count <= 3) {
    return { level: 2, color: "#40c463", className: "heatmap-medium" };
  }
  return { level: 3, color: "#216e39", className: "heatmap-dark" };
}

/**
 * Builds the full 365-day dataset for frontend rendering.
 * Combines date grid + solve counts + colors in one pass.
 *
 * @param {Object} mergedHeatmapData - Flat { "YYYY-MM-DD": count } map
 * @param {number} [days=365]
 * @returns {Array<{
 *   date: string,
 *   count: number,
 *   level: number,
 *   color: string,
 *   className: string
 * }>}
 */
function buildHeatmapDataset(mergedHeatmapData = {}, days = 365) {
  const dateRange = getLastNDays(days);

  return dateRange.map((date) => {
    const count = mergedHeatmapData[date] || 0;
    const colorInfo = getHeatmapColor(count);
    return {
      date,
      count,
      ...colorInfo,
    };
  });
}

/**
 * Calculates total solves from a merged heatmap map.
 * Useful for profile stats.
 *
 * @param {Object} mergedHeatmapData
 * @returns {number}
 */
function getTotalSolvesFromHeatmap(mergedHeatmapData = {}) {
  return Object.values(mergedHeatmapData).reduce((sum, count) => sum + count, 0);
}

module.exports = {
  getCurrentYear,
  incrementHeatmapDay,
  getLastNDays,
  mergeYearDocs,
  getHeatmapColor,
  buildHeatmapDataset,
  getTotalSolvesFromHeatmap,
};