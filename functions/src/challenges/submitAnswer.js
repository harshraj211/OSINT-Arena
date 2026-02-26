/**
 * submitAnswer.js
 * Cloud Function — HTTPS Callable
 *
 * The most critical function in OSINT Arena.
 * Handles the full solve pipeline:
 *   1. Auth + input validation
 *   2. Fetch activeSession → calculate timeTaken (server-side)
 *   3. Anti-cheat checks (rate limit, speed anomaly)
 *   4. Answer normalization + hash verification
 *   5a. CORRECT: ELO gain, streak update, heatmap update, badge check, log submission
 *   5b. INCORRECT: ELO deduction, log attempt, enforce rate limit
 *   6. Return result (NEVER return correct answer or hash)
 *
 * Input:  { challengeId: string, answer: string, hintUsed: boolean, contestId?: string }
 * Output: { correct: boolean, eloChange: number, ... } (see return shapes below)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// ── Lib imports (pure, portable) ──────────────────────────────────────────────
const { calculateEloGain, calculateWrongAttemptDeduction } = require("../lib/calculateElo");
const { calculateStreak } = require("../lib/calculateStreak");
const { normalizeAnswer } = require("../lib/normalizeAnswer");
const { verifyAnswer } = require("../lib/hashAnswer");
const { runAntiCheatChecks } = require("../lib/antiCheat");
const { incrementHeatmapDay, getCurrentYear } = require("../lib/heatmap");

// ── Init guard ────────────────────────────────────────────────────────────────
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

module.exports = functions.https.onCall(async (data, context) => {
  const nowMs = Date.now();

  // ── 1. Auth check ─────────────────────────────────────────────────────────────
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to submit an answer."
    );
  }

  const userId = context.auth.uid;

  // ── 2. Input validation ───────────────────────────────────────────────────────
  const { challengeId, answer, hintUsed = false, contestId = null } = data;

  if (!challengeId || typeof challengeId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "challengeId is required.");
  }
  if (!answer || typeof answer !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "answer is required.");
  }
  if (answer.length > 500) {
    throw new functions.https.HttpsError("invalid-argument", "Answer exceeds maximum length.");
  }

  // ── 3. Fetch challenge doc ────────────────────────────────────────────────────
  const challengeRef = db.collection("challenges").doc(challengeId);
  const challengeSnap = await challengeRef.get();

  if (!challengeSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Challenge not found.");
  }

  const challenge = challengeSnap.data();

  if (!challenge.isActive) {
    throw new functions.https.HttpsError("failed-precondition", "Challenge is not active.");
  }

  // ── 4. Fetch activeSession → server-side timeTaken ────────────────────────────
  const sessionId = `${userId}_${challengeId}`;
  const sessionSnap = await db.collection("activeSessions").doc(sessionId).get();

  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No active session found. Please open the challenge first."
    );
  }

  const session = sessionSnap.data();
  const timeTaken = Math.floor((nowMs - session.openTimestamp) / 1000); // seconds

  // ── 5. Fetch user doc ─────────────────────────────────────────────────────────
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User profile not found.");
  }

  const user = userSnap.data();
  const isPro = user.plan === "pro" || user.role === "admin";

  // ── 5b. Access control gate ───────────────────────────────────────────────────
  // Easy:   always free
  // Medium: free only if challenge.freeForAll === true (the 30%)
  // Hard:   free only if it's the weekly free challenge (config/weeklyFreeChallenge)
  if (!isPro) {
    const difficulty = challenge.difficulty;

    if (difficulty === "medium" && !challenge.freeForAll) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "This challenge requires a Pro subscription."
      );
    }

    if (difficulty === "hard") {
      // Check weekly free hard challenge
      const weeklyFreeSnap = await db.collection("config").doc("weeklyFreeChallenge").get();
      const weeklyFreeId   = weeklyFreeSnap.exists ? weeklyFreeSnap.data().challengeId : null;

      if (challengeId !== weeklyFreeId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Hard challenges require a Pro subscription. One hard challenge is free each week."
        );
      }
    }
  }
  const recentAttemptsSnap = await db
    .collection("submissions")
    .where("userId", "==", userId)
    .where("challengeId", "==", challengeId)
    .where("timestamp", ">=", admin.firestore.Timestamp.fromMillis(nowMs - 30 * 60 * 1000))
    .orderBy("timestamp", "desc")
    .get();

  const recentAttemptTimestamps = recentAttemptsSnap.docs.map(
    (d) => d.data().timestamp.toMillis()
  );

  // Count wrong attempts this session (for ELO penalty)
  const wrongAttemptsThisSession = recentAttemptsSnap.docs.filter(
    (d) => !d.data().isCorrect
  ).length;

  // ── 7. Anti-cheat checks ──────────────────────────────────────────────────────
  const ip =
    context.rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    context.rawRequest?.ip ||
    "unknown";

  const antiCheat = runAntiCheatChecks({
    timeTaken,
    difficulty: challenge.difficulty,
    recentAttemptTimestamps,
    nowMs,
    ip,
  });

  if (antiCheat.shouldBlock) {
    throw new functions.https.HttpsError("resource-exhausted", antiCheat.blockReason);
  }

  // Flag account if suspicious (don't block — process submission normally)
  if (antiCheat.shouldFlag) {
    await db.collection("flags").add({
      userId,
      reason: antiCheat.flagReason,
      submissionId: null, // Will update after submission is created
      challengeId,
      timeTaken,
      ip,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: null,
      resolvedAt: null,
    });

    // Mark user as flagged
    await userRef.update({
      isFlagged: true,
      flagReason: antiCheat.flagReason,
    });
  }

  // ── 8. Verify answer ──────────────────────────────────────────────────────────
  const isCorrect = verifyAnswer(
    answer,
    challenge.answerHash,
    challenge.answerNormalizationRules || {}
  );

  // ── 9a. WRONG ANSWER ──────────────────────────────────────────────────────────
  if (!isCorrect) {
    const eloDeduction = calculateWrongAttemptDeduction(wrongAttemptsThisSession);
    const newElo = Math.max(0, (user.elo || 0) + eloDeduction); // ELO floor at 0

    // Batch write: log submission + update user ELO
    const batch = db.batch();

    const submissionRef = db.collection("submissions").doc();
    batch.set(submissionRef, {
      userId,
      challengeId,
      isCorrect: false,
      timeTaken,
      eloChange: eloDeduction,
      wrongAttemptsBefore: wrongAttemptsThisSession,
      hintUsed,
      ipAddress: ip,
      contestId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      isSuspicious: antiCheat.shouldFlag,
    });

    batch.update(userRef, {
      elo: newElo,
      wrongSubmissions: admin.firestore.FieldValue.increment(1),
    });

    // Update challenge attempt count
    batch.update(challengeRef, {
      attemptCount: admin.firestore.FieldValue.increment(1),
    });

    await batch.commit();

    return {
      correct: false,
      eloChange: eloDeduction,
      newElo,
      attemptsInWindow: antiCheat.rateLimitInfo.attemptsInWindow + 1,
      maxAttemptsInWindow: 5,
      message: "Incorrect answer. Try again.",
    };
  }

  // ── 9b. CORRECT ANSWER ────────────────────────────────────────────────────────

  // Check if already solved (no double ELO — allow re-solve for practice)
  const alreadySolvedSnap = await db
    .collection("submissions")
    .where("userId", "==", userId)
    .where("challengeId", "==", challengeId)
    .where("isCorrect", "==", true)
    .limit(1)
    .get();

  const alreadySolved = !alreadySolvedSnap.empty;

  // Calculate ELO gain (0 if already solved — practice mode)
  let eloGainResult = { finalEloGain: 0, timeBonus: 1, hintPenalty: 1, attemptPenalty: 1 };
  if (!alreadySolved) {
    eloGainResult = calculateEloGain({
      difficulty: challenge.difficulty,
      expectedTime: challenge.expectedTime,
      timeTaken,
      hintUsed,
      wrongAttempts: wrongAttemptsThisSession,
    });
  }

  const { finalEloGain } = eloGainResult;

  // Calculate streak update
  const streakResult = alreadySolved
    ? { currentStreak: user.currentStreak, maxStreak: user.maxStreak, lastActiveDate: user.lastActiveDate, streakChanged: false }
    : calculateStreak({
        lastActiveDate: user.lastActiveDate || null,
        currentStreak: user.currentStreak || 0,
        maxStreak: user.maxStreak || 0,
      });

  // Calculate heatmap update
  const currentYear = getCurrentYear();
  const heatmapRef = db.collection("heatmap").doc(userId).collection("years").doc(currentYear);
  const heatmapSnap = await heatmapRef.get();
  const existingHeatmap = heatmapSnap.exists ? heatmapSnap.data() : {};
  const { updatedMap: updatedHeatmap } = incrementHeatmapDay(existingHeatmap);

  // Update challenge avgSolveTime (running average)
  const currentAvg = challenge.avgSolveTime || 0;
  const currentSolveCount = challenge.solveCount || 0;
  const newAvgSolveTime = alreadySolved
    ? currentAvg
    : Math.round((currentAvg * currentSolveCount + timeTaken) / (currentSolveCount + 1));

  // ── Batch write: everything in one atomic operation ───────────────────────────
  const batch = db.batch();

  // Log submission
  const submissionRef = db.collection("submissions").doc();
  batch.set(submissionRef, {
    userId,
    challengeId,
    isCorrect: true,
    timeTaken,
    eloChange: finalEloGain,
    wrongAttemptsBefore: wrongAttemptsThisSession,
    hintUsed,
    ipAddress: ip,
    contestId,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    isSuspicious: antiCheat.shouldFlag,
    isPracticeRe_solve: alreadySolved,
  });

  // Update user doc
  const userUpdate = {
    elo: admin.firestore.FieldValue.increment(finalEloGain),
    weeklyElo: admin.firestore.FieldValue.increment(finalEloGain),
    monthlyElo: admin.firestore.FieldValue.increment(finalEloGain),
    correctSubmissions: admin.firestore.FieldValue.increment(1),
    lastActiveDate: streakResult.lastActiveDate,
    currentStreak: streakResult.currentStreak,
    maxStreak: streakResult.maxStreak,
  };

  if (!alreadySolved) {
    userUpdate.totalSolved = admin.firestore.FieldValue.increment(1);
    // Denormalised per-difficulty counter — used by checkCertEligibility
    userUpdate[`solvedByDifficulty.${challenge.difficulty}`] =
      admin.firestore.FieldValue.increment(1);
  }

  batch.update(userRef, userUpdate);

  // Update challenge stats
  if (!alreadySolved) {
    batch.update(challengeRef, {
      solveCount: admin.firestore.FieldValue.increment(1),
      attemptCount: admin.firestore.FieldValue.increment(1),
      avgSolveTime: newAvgSolveTime,
    });
  }

  // Update heatmap
  batch.set(heatmapRef, updatedHeatmap);

  // Delete active session (solved — no longer needed)
  batch.delete(db.collection("activeSessions").doc(sessionId));

  await batch.commit();

  // ── Contest submission logging (outside main batch — non-blocking) ─────────────
  if (contestId && !alreadySolved) {
    db.collection("contestSubmissions").add({
      contestId,
      userId,
      challengeId,
      isCorrect: true,
      timeTaken,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }).catch((err) => console.error("Contest submission log failed:", err));
  }

  // ── Badge check (async, non-blocking — runs after response) ──────────────────
  // Trigger badge evaluation without awaiting — don't delay user response
  checkAndAwardBadges(userId, {
    challengeId,
    difficulty: challenge.difficulty,
    timeTaken,
    expectedTime: challenge.expectedTime,
    streak: streakResult.currentStreak,
    tags: challenge.tags || [],
  }).catch((err) => console.error("Badge check failed:", err));

  // ── Return result ─────────────────────────────────────────────────────────────
  return {
    correct: true,
    alreadySolved,
    eloChange: finalEloGain,
    newElo: (user.elo || 0) + finalEloGain,
    breakdown: {
      baseElo: eloGainResult.baseElo,
      timeBonus: eloGainResult.timeBonus,
      hintPenalty: eloGainResult.hintPenalty,
      attemptPenalty: eloGainResult.attemptPenalty,
    },
    streak: {
      current: streakResult.currentStreak,
      max: streakResult.maxStreak,
      changed: streakResult.streakChanged,
      action: streakResult.action,
    },
    timeTaken,
    message: alreadySolved
      ? "Already solved — practice mode. No ELO awarded."
      : "Correct! Well done.",
  };
});

// ── Badge evaluation (internal — not exported) ────────────────────────────────
/**
 * Checks and awards badges after a correct solve.
 * Runs async after response is sent — never blocks the solve flow.
 *
 * @param {string} userId
 * @param {Object} solveContext
 */
async function checkAndAwardBadges(userId, solveContext) {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const user = userSnap.data();
  const currentBadges = user.badges || [];

  const newBadges = [];

  // "Speed Demon" — solved with 2x time bonus (timeTaken <= expectedTime / 2)
  if (solveContext.timeTaken <= solveContext.expectedTime / 2) {
    const speedSolves = (user.speedDemonProgress || 0) + 1;
    await userRef.update({ speedDemonProgress: speedSolves });
    if (speedSolves >= 10 && !currentBadges.includes("speed_demon")) {
      newBadges.push("speed_demon");
    }
  }

  // "Streak Master" — 30-day streak
  if (solveContext.streak >= 30 && !currentBadges.includes("streak_master")) {
    newBadges.push("streak_master");
  }

  // "First Blood" — check if this user is the first to solve this challenge
  const firstBloodSnap = await db
    .collection("submissions")
    .where("challengeId", "==", solveContext.challengeId)
    .where("isCorrect", "==", true)
    .orderBy("timestamp", "asc")
    .limit(1)
    .get();

  if (!firstBloodSnap.empty) {
    const firstSolver = firstBloodSnap.docs[0].data().userId;
    if (firstSolver === userId && !currentBadges.includes("first_blood")) {
      newBadges.push("first_blood");
    }
  }

  // Award new badges if any
  if (newBadges.length > 0) {
    await userRef.update({
      badges: admin.firestore.FieldValue.arrayUnion(...newBadges),
    });
  }
}