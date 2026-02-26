/**
 * rotateWeeklyFreeChallenge.js
 * Scheduled Cloud Function — runs every Monday at 00:00 UTC.
 *
 * Picks a new hard challenge to be free for the week and writes it to
 * config/weeklyFreeChallenge. The submitAnswer gate and Challenges.jsx
 * both read from this doc to decide whether a hard challenge is accessible
 * to free-tier users.
 *
 * Selection algorithm:
 *   1. Fetch all active hard challenges
 *   2. Exclude the last 4 weeks of picks (stored in config/weeklyFreeHistory)
 *      so the same challenge doesn't repeat too often
 *   3. Prefer challenges that have been solved the fewest times (surface less-seen ones)
 *   4. If all challenges have been shown recently, reset history and pick the
 *      least-solved overall
 *
 * Firestore writes:
 *   config/weeklyFreeChallenge  → { challengeId, title, slug, difficulty, setAt, expiresAt }
 *   config/weeklyFreeHistory    → { picks: [...last 4 challengeIds] }
 *   challenges/{id}.isFreeThisWeek → true  (on new pick)
 *   challenges/{prevId}.isFreeThisWeek → false  (on previous pick)
 *   adminLogs/{auto}            → rotation log entry
 *
 * File location: functions/src/challenges/rotateWeeklyFreeChallenge.js
 */

"use strict";

const { onSchedule }  = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// How many recent picks to exclude from selection
const HISTORY_SIZE = 4;

exports.rotateWeeklyFreeChallenge = onSchedule(
  {
    schedule:  "every monday 00:00",
    timeZone:  "UTC",
  },
  async () => {
    console.log("rotateWeeklyFreeChallenge: starting rotation");

    // ── 1. Fetch all active hard challenges ───────────────────────────────
    const challengesSnap = await db
      .collection("challenges")
      .where("difficulty", "==", "hard")
      .where("isActive",   "==", true)
      .get();

    if (challengesSnap.empty) {
      console.warn("rotateWeeklyFreeChallenge: no active hard challenges found");
      return;
    }

    const allHard = challengesSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    // ── 2. Load recent pick history ───────────────────────────────────────
    const historyRef  = db.collection("config").doc("weeklyFreeHistory");
    const historySnap = await historyRef.get();
    const recentPicks = historySnap.exists
      ? (historySnap.data().picks || [])
      : [];

    // ── 3. Filter out recently-shown challenges ───────────────────────────
    let candidates = allHard.filter(c => !recentPicks.includes(c.id));

    // If all challenges have been shown recently, reset and use all
    if (candidates.length === 0) {
      console.log("rotateWeeklyFreeChallenge: history exhausted — resetting");
      candidates = allHard;
    }

    // ── 4. Sort by solveCount ASC (least solved first) ────────────────────
    // Surface challenges that fewer users have seen
    candidates.sort((a, b) => (a.solveCount || 0) - (b.solveCount || 0));

    // Pick from the bottom quartile of solve counts to add variety
    // (don't always pick the single least-solved — rotate among the bottom 25%)
    const poolSize  = Math.max(1, Math.ceil(candidates.length * 0.25));
    const pool      = candidates.slice(0, poolSize);
    const picked    = pool[Math.floor(Math.random() * pool.length)];

    console.log(`rotateWeeklyFreeChallenge: picked "${picked.title}" (id=${picked.id}, solves=${picked.solveCount || 0})`);

    // ── 5. Load current free challenge (to unmark it) ─────────────────────
    const currentRef  = db.collection("config").doc("weeklyFreeChallenge");
    const currentSnap = await currentRef.get();
    const prevChallengeId = currentSnap.exists
      ? currentSnap.data().challengeId
      : null;

    // ── 6. Compute expiry (next Monday 00:00 UTC) ─────────────────────────
    const now      = new Date();
    const expiresAt = nextMonday(now);

    // ── 7. Batch write everything ─────────────────────────────────────────
    const batch = db.batch();

    // Update config/weeklyFreeChallenge
    batch.set(currentRef, {
      challengeId: picked.id,
      title:       picked.title       || "",
      slug:        picked.slug        || "",
      difficulty:  picked.difficulty  || "hard",
      basePoints:  picked.basePoints  || 100,
      setAt:       Timestamp.now(),
      expiresAt:   Timestamp.fromDate(expiresAt),
    });

    // Update pick history (keep last HISTORY_SIZE entries)
    const newHistory = [...recentPicks, picked.id].slice(-HISTORY_SIZE);
    batch.set(historyRef, { picks: newHistory });

    // Mark new challenge as free this week
    batch.update(picked.ref, { isFreeThisWeek: true });

    // Unmark previous challenge (if different)
    if (prevChallengeId && prevChallengeId !== picked.id) {
      const prevRef = db.collection("challenges").doc(prevChallengeId);
      batch.update(prevRef, { isFreeThisWeek: false });
    }

    // Log the rotation
    batch.set(db.collection("adminLogs").doc(), {
      type:              "weekly_free_rotated",
      newChallengeId:    picked.id,
      newChallengeTitle: picked.title,
      prevChallengeId:   prevChallengeId || null,
      expiresAt:         Timestamp.fromDate(expiresAt),
      timestamp:         Timestamp.now(),
    });

    await batch.commit();

    console.log(`rotateWeeklyFreeChallenge: done. "${picked.title}" is free until ${expiresAt.toISOString()}`);
  }
);

// ── Helper — next Monday at 00:00 UTC ─────────────────────────────────────────
function nextMonday(from) {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  // getUTCDay(): 0=Sun, 1=Mon ... 6=Sat
  const daysUntilMonday = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d;
}