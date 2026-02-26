/**
 * index.js
 * Central entry point — wires every Cloud Function for OSINT Arena.
 *
 * Mix of v1 and v2 Firebase Functions SDKs:
 *  - Older challenge/admin/email/leaderboard functions: v1 (module.exports style)
 *  - Newer contest functions: v2 (named exports, onCall/onSchedule from v2)
 *
 * firebase-admin is initialised ONCE here. Every other file calls
 * getFirestore() / getAuth() after init has already run.
 *
 * Deployment:
 *   firebase deploy --only functions
 *
 * Individual function deploy:
 *   firebase deploy --only functions:submitAnswer
 *
 * File location: functions/src/index.js
 */

"use strict";

// ── Firebase Admin — init once ────────────────────────────────────────────────
const { initializeApp } = require("firebase-admin/app");
initializeApp();

// ────────────────────────────────────────────────────────────────────────────
// CHALLENGE FUNCTIONS  (v1 · HTTPS Callable)
// Client: httpsCallable(functions, "openChallenge")
//         httpsCallable(functions, "submitAnswer")
// ────────────────────────────────────────────────────────────────────────────
exports.openChallenge = require("./challenges/openChallenge");
exports.submitAnswer  = require("./challenges/submitAnswer");

// ────────────────────────────────────────────────────────────────────────────
// AUTH FUNCTIONS  (v1 · Auth triggers + HTTPS Callable)
// onUserCreated  → fires on every new Firebase Auth user
// setCustomClaims → called after Razorpay payment to grant pro claim
// ────────────────────────────────────────────────────────────────────────────
exports.onUserCreated   = require("./auth/onUserCreated");
exports.setCustomClaims = require("./auth/setCustomClaims");

// ────────────────────────────────────────────────────────────────────────────
// CONTEST FUNCTIONS  (v2 · HTTPS Callable + Scheduled)
// registerForContest  → Pro users register before deadline
// submitContestAnswer → CTF-style answer submission during live contest
// finalizeContest     → Scheduled every 5 min, ranks + awards ELO after end
// ────────────────────────────────────────────────────────────────────────────
const { registerForContest }  = require("./contests/registerForContest");
const { submitContestAnswer } = require("./contests/submitContestAnswer");
const { finalizeContest }     = require("./contests/finalizeContest");

exports.registerForContest  = registerForContest;
exports.submitContestAnswer = submitContestAnswer;
exports.finalizeContest     = finalizeContest;

// ────────────────────────────────────────────────────────────────────────────
// LEADERBOARD CRON JOBS  (v1 · Pub/Sub scheduled)
// resetWeeklyElo  → every Monday 00:00 UTC  — zeroes weeklyElo
// resetMonthlyElo → 1st of month 00:00 UTC  — zeroes monthlyElo
// ────────────────────────────────────────────────────────────────────────────
exports.resetWeeklyElo  = require("./leaderboard/resetWeeklyElo");
exports.resetMonthlyElo = require("./leaderboard/resetMonthlyElo");

// ────────────────────────────────────────────────────────────────────────────
// EMAIL FUNCTIONS  (v1 · Pub/Sub scheduled + HTTPS Callable)
// sendContestReminder → scheduled 1h before each contest start
// sendBroadcast       → admin-only callable to email all users
// ────────────────────────────────────────────────────────────────────────────
exports.sendContestReminder = require("./emails/sendContestReminder");
exports.sendBroadcast       = require("./emails/sendBroadcast");

// ────────────────────────────────────────────────────────────────────────────
// ADMIN FUNCTIONS  (v1 · HTTPS Callable — admin role required)
// adjustElo    → manually adjust a user's ELO with reason log
// resolveFlag  → dismiss / warn / ban a flagged user
// getAnalytics → dashboard analytics snapshot
// ────────────────────────────────────────────────────────────────────────────
exports.adjustElo    = require("./admin/adjustElo");
exports.resolveFlag  = require("./admin/resolveFlag");
exports.getAnalytics = require("./admin/getAnalytics");

// ────────────────────────────────────────────────────────────────────────────
// CERTIFICATION  (v1 · HTTPS Callable — Pro only)
// checkCertEligibility → checks if user has solved all challenges in a tier
//                        and issues a verifiable cert doc if eligible
// ────────────────────────────────────────────────────────────────────────────
exports.checkCertEligibility = require("./certifications/checkCertEligibility");