/**
 * index.js
 * Central export file for all Firebase Cloud Functions.
 * Add new functions here as the platform grows.
 *
 * Naming convention: camelCase → becomes the callable function name
 * e.g. exports.submitAnswer → client calls functions.httpsCallable("submitAnswer")
 */

// ── Challenge Functions ───────────────────────────────────────────────────────
exports.openChallenge = require("./challenges/openChallenge");
exports.submitAnswer  = require("./challenges/submitAnswer");

// ── Auth Functions ────────────────────────────────────────────────────────────
exports.onUserCreated   = require("./auth/onUserCreated");
exports.setCustomClaims = require("./auth/setCustomClaims");

// ── Leaderboard Cron Jobs ─────────────────────────────────────────────────────
exports.resetWeeklyElo  = require("./leaderboard/resetWeeklyElo");
exports.resetMonthlyElo = require("./leaderboard/resetMonthlyElo");

// ── Contest Functions ─────────────────────────────────────────────────────────
exports.registerForContest    = require("./contests/registerForContest");
exports.submitContestAnswer   = require("./contests/submitContestAnswer");
exports.finalizeContest       = require("./contests/finalizeContest");

// ── Email Functions ───────────────────────────────────────────────────────────
exports.sendContestReminder = require("./emails/sendContestReminder");
exports.sendBroadcast       = require("./emails/sendBroadcast");

// ── Admin Functions ───────────────────────────────────────────────────────────
exports.adjustElo    = require("./admin/adjustElo");
exports.resolveFlag  = require("./admin/resolveFlag");
exports.getAnalytics = require("./admin/getAnalytics");

// ── Certification Functions ───────────────────────────────────────────────────
exports.checkCertEligibility = require("./certifications/checkCertEligibility");