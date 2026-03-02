/**
 * unlockHint.js
 * Cloud Function — HTTPS Callable
 *
 * SECURITY: hintUsed is never trusted from the client.
 * When a user clicks "Unlock Hint", this function sets hintUsed: true
 * on the activeSession document server-side.
 * submitAnswer.js then reads hintUsed from the session, not from the client.
 *
 * Input:  { challengeId: string }
 * Output: { success: true, hint: string }
 *
 * File location: functions/src/challenges/unlockHint.js
 */

const functions = require("firebase-functions");
const admin     = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

module.exports = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }

  const userId      = context.auth.uid;
  const { challengeId } = data;

  if (!challengeId || typeof challengeId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "challengeId required.");
  }

  const sessionId  = `${userId}_${challengeId}`;
  const sessionRef = db.collection("activeSessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No active session. Open the challenge first."
    );
  }

  // Fetch challenge to get the hint text
  const challengeSnap = await db.collection("challenges").doc(challengeId).get();
  if (!challengeSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Challenge not found.");
  }

  const challenge = challengeSnap.data();
  if (!challenge.hint) {
    throw new functions.https.HttpsError("not-found", "This challenge has no hint.");
  }

  // Verify user has Pro access if hint is pro-only (optional — remove if hints are free)
  const userSnap = await db.collection("users").doc(userId).get();
  const user = userSnap.data();
  const isPro = user?.plan === "pro" || user?.role === "admin";
  if (challenge.hintProOnly && !isPro) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "This hint requires a Pro subscription."
    );
  }

  // Mark hint as used on the session — server-side only
  await sessionRef.update({ hintUsed: true });

  return { success: true, hint: challenge.hint };
});