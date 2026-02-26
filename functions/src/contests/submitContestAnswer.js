/**
 * submitContestAnswer.js
 * HTTPS Callable — submits an answer during an active contest.
 *
 * Key differences from submitAnswer (free practice):
 *  - Must be registered participant
 *  - Contest must be in progress (started, not ended)
 *  - Wrong answers add a TIME PENALTY (5 min per wrong answer, CTF-style)
 *  - Correct answers update participant score + solveCount atomically
 *  - No ELO change mid-contest — ELO is awarded by finalizeContest
 *  - No daily solve limit applies
 *  - Hints cost double (40% penalty on final ELO award vs 20% in practice)
 *  - Per-challenge attempt rate limit: 10s cooldown after wrong answer
 *
 * Scoring model:
 *  score = sum of challenge basePoints × time_factor for each correct solve
 *  time_factor = 1 - (timeSinceContestStart / contestDuration) × 0.5
 *  (solving earlier in the contest gives more points, min factor 0.5)
 *
 * File location: functions/src/contests/submitContestAnswer.js
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { normalizeAnswer } = require("../lib/normalizeAnswer");
const { hashAnswer }      = require("../lib/hashAnswer");

const db = getFirestore();

const WRONG_ANSWER_PENALTY_SECONDS = 5 * 60; // 5 min per wrong answer
const RATE_LIMIT_SECONDS = 10;               // cooldown per challenge after wrong

exports.submitContestAnswer = onCall({ enforceAppCheck: false }, async (request) => {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const { auth } = request;
  if (!auth) throw new HttpsError("unauthenticated", "Must be signed in.");
  if (!auth.token.email_verified) throw new HttpsError("failed-precondition", "Email not verified.");

  const userId = auth.uid;
  const { contestId, challengeId, answer, hintUsed } = request.data;

  if (!contestId || !challengeId || !answer) {
    throw new HttpsError("invalid-argument", "contestId, challengeId, and answer are required.");
  }

  // ── Fetch contest ─────────────────────────────────────────────────────────
  const contestRef  = db.collection("contests").doc(contestId);
  const contestSnap = await contestRef.get();
  if (!contestSnap.exists) throw new HttpsError("not-found", "Contest not found.");
  const contest = contestSnap.data();

  const now          = Date.now();
  const startMs      = contest.startTime?.toMillis?.() ?? 0;
  const endMs        = contest.endTime?.toMillis?.() ?? 0;

  if (now < startMs) {
    throw new HttpsError("failed-precondition", "Contest has not started yet.");
  }
  if (now > endMs) {
    throw new HttpsError("failed-precondition", "Contest has ended.");
  }
  if (!contest.isActive) {
    throw new HttpsError("failed-precondition", "Contest is not active.");
  }

  // ── Check participant registration ────────────────────────────────────────
  const participantRef  = contestRef.collection("participants").doc(userId);
  const participantSnap = await participantRef.get();
  if (!participantSnap.exists) {
    throw new HttpsError("permission-denied", "Not registered for this contest.");
  }
  const participant = participantSnap.data();

  // ── Fetch challenge ───────────────────────────────────────────────────────
  const challengeSnap = await db.collection("challenges").doc(challengeId).get();
  if (!challengeSnap.exists) throw new HttpsError("not-found", "Challenge not found.");
  const challenge = challengeSnap.data();

  // Verify challenge is part of this contest
  if (!contest.challengeIds?.includes(challengeId)) {
    throw new HttpsError("invalid-argument", "Challenge is not part of this contest.");
  }

  // ── Check per-challenge attempt rate limit ────────────────────────────────
  const attemptRef  = contestRef
    .collection("participants").doc(userId)
    .collection("attempts").doc(challengeId);
  const attemptSnap = await attemptRef.get();
  const attemptData = attemptSnap.exists ? attemptSnap.data() : null;

  if (attemptData?.lastWrongAt) {
    const secsSinceWrong = (now - attemptData.lastWrongAt.toMillis()) / 1000;
    if (secsSinceWrong < RATE_LIMIT_SECONDS) {
      const waitSecs = Math.ceil(RATE_LIMIT_SECONDS - secsSinceWrong);
      throw new HttpsError(
        "resource-exhausted",
        `Wait ${waitSecs}s before retrying this challenge.`
      );
    }
  }

  // ── Check if already solved this challenge in this contest ───────────────
  if (attemptData?.solved) {
    throw new HttpsError("already-exists", "Already solved this challenge in this contest.");
  }

  // ── Verify answer ─────────────────────────────────────────────────────────
  const normalizedAnswer = normalizeAnswer(answer);
  const hashedSubmission = hashAnswer(normalizedAnswer);
  const isCorrect        = hashedSubmission === challenge.answerHash;

  const timeSinceStartMs  = now - startMs;
  const contestDurationMs = endMs - startMs;

  // ── Wrong answer path ─────────────────────────────────────────────────────
  if (!isCorrect) {
    const batch = db.batch();

    // Update attempt record
    batch.set(attemptRef, {
      challengeId,
      solved:       false,
      wrongCount:   FieldValue.increment(1),
      lastWrongAt:  FieldValue.serverTimestamp(),
    }, { merge: true });

    // Add time penalty to participant
    batch.update(participantRef, {
      penalties: FieldValue.increment(WRONG_ANSWER_PENALTY_SECONDS),
    });

    // Log submission
    batch.set(db.collection("contestSubmissions").doc(), {
      contestId,
      challengeId,
      userId,
      answer:    normalizedAnswer,
      isCorrect: false,
      timestamp: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      correct:         false,
      penaltyAdded:    WRONG_ANSWER_PENALTY_SECONDS,
      totalPenalties:  (participant.penalties || 0) + WRONG_ANSWER_PENALTY_SECONDS,
    };
  }

  // ── Correct answer path ───────────────────────────────────────────────────

  // Time-based score factor (1.0 early → 0.5 at contest end)
  const timeFactor = Math.max(
    0.5,
    1 - (timeSinceStartMs / contestDurationMs) * 0.5
  );
  const hintMultiplier = hintUsed ? 0.6 : 1.0; // hint = 40% penalty
  const basePoints     = challenge.basePoints || 100;
  const pointsEarned   = Math.round(basePoints * timeFactor * hintMultiplier);

  const batch = db.batch();

  // Mark attempt as solved
  batch.set(attemptRef, {
    challengeId,
    solved:      true,
    solvedAt:    FieldValue.serverTimestamp(),
    wrongCount:  attemptData?.wrongCount || 0,
    pointsEarned,
    hintUsed:    !!hintUsed,
  }, { merge: true });

  // Update participant score + solveCount
  const newSolveCount = (participant.solveCount || 0) + 1;
  const allSolved     = newSolveCount >= (contest.challengeIds?.length || 0);

  batch.update(participantRef, {
    score:      FieldValue.increment(pointsEarned),
    solveCount: FieldValue.increment(1),
    ...(allSolved ? { finishTime: Timestamp.fromMillis(now) } : {}),
  });

  // Log submission
  batch.set(db.collection("contestSubmissions").doc(), {
    contestId,
    challengeId,
    userId,
    answer:       normalizedAnswer,
    isCorrect:    true,
    pointsEarned,
    hintUsed:     !!hintUsed,
    timeSinceStartMs,
    timestamp:    FieldValue.serverTimestamp(),
  });

  // Increment challenge solveCount globally
  batch.update(db.collection("challenges").doc(challengeId), {
    solveCount: FieldValue.increment(1),
  });

  await batch.commit();

  return {
    correct:          true,
    pointsEarned,
    timeFactor:       parseFloat(timeFactor.toFixed(3)),
    hintMultiplier,
    allSolved,
    newScore:         (participant.score || 0) + pointsEarned,
    solveCount:       newSolveCount,
    totalChallenges:  contest.challengeIds?.length || 0,
  };
});