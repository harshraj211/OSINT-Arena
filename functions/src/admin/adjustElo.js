/**
 * adjustElo.js
 * Cloud Function — HTTPS Callable (Admin only)
 *
 * Allows admins to manually adjust a user's ELO up or down.
 * Every adjustment is logged to adminLogs with a mandatory reason.
 * Also updates weeklyElo and monthlyElo proportionally.
 *
 * Input:
 *  {
 *    targetUserId: string   (required)
 *    adjustment:   number   (required — positive or negative, e.g. +50 or -30)
 *    reason:       string   (required — shown in audit log)
 *  }
 *
 * Output:
 *  { success: true, previousElo: number, newElo: number, adjustment: number }
 *
 * File location: functions/src/admin/adjustElo.js
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

module.exports = functions.https.onCall(async (data, context) => {

  // ── 1. Admin auth check ───────────────────────────────────────────────────
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  if (context.auth.token.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin role required.");
  }

  // ── 2. Input validation ───────────────────────────────────────────────────
  const { targetUserId, adjustment, reason } = data;

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "targetUserId is required.");
  }
  if (typeof adjustment !== "number" || isNaN(adjustment) || adjustment === 0) {
    throw new functions.https.HttpsError("invalid-argument", "adjustment must be a non-zero number.");
  }
  if (Math.abs(adjustment) > 1000) {
    throw new functions.https.HttpsError("invalid-argument", "adjustment cannot exceed ±1000 in a single operation.");
  }
  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    throw new functions.https.HttpsError("invalid-argument", "reason is required (min 10 characters).");
  }

  // ── 3. Fetch target user ──────────────────────────────────────────────────
  const userRef = db.collection("users").doc(targetUserId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Target user not found.");
  }

  const user = userSnap.data();
  const previousElo = user.elo || 0;
  const newElo = Math.max(0, previousElo + adjustment); // Floor at 0

  // ── 4. Batch update user + log ────────────────────────────────────────────
  const batch = db.batch();

  // Update user ELO fields
  batch.update(userRef, {
    elo: newElo,
    // Also adjust weekly/monthly proportionally if adjustment is positive
    // If negative (punishment), only reduce global ELO
    ...(adjustment > 0 && {
      weeklyElo:  admin.firestore.FieldValue.increment(adjustment),
      monthlyElo: admin.firestore.FieldValue.increment(adjustment),
    }),
  });

  // Log to adminLogs
  const logRef = db.collection("adminLogs").doc();
  batch.set(logRef, {
    type: "manual_elo_adjustment",
    targetUserId,
    targetUsername: user.username || "unknown",
    adjustment,
    previousElo,
    newElo,
    reason: reason.trim(),
    performedBy: context.auth.uid,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  console.log(`adjustElo: ${user.username} ${previousElo} → ${newElo} (${adjustment > 0 ? "+" : ""}${adjustment}) by admin ${context.auth.uid}`);

  return {
    success: true,
    targetUsername: user.username,
    previousElo,
    newElo,
    adjustment,
  };
});