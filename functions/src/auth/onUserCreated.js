/**
 * onUserCreated.js
 * Firebase Auth trigger — fires automatically whenever a new user signs up.
 *
 * Creates two Firestore documents:
 *
 *   users/{uid}          — private profile (ELO, plan, role, streaks, etc.)
 *   publicProfiles/{uid} — public-facing data (username, ELO, tier, badges)
 *
 * Also:
 *   - Sets initial Firebase Auth custom claims { plan: "free", role: "user" }
 *   - Sanitises the display name / email into a valid username
 *   - Sends a welcome email via SendGrid (non-blocking)
 *
 * File location: functions/src/auth/onUserCreated.js
 */

"use strict";

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const { sendWelcomeEmail } = require("../lib/sendgrid");

const db   = admin.firestore();
const auth = getAuth();

module.exports = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL, providerData } = user;

  console.log(`onUserCreated: new user uid=${uid} email=${email}`);

  // ── Derive a clean username ───────────────────────────────────────────────
  // Priority: displayName → email prefix → uid prefix
  const rawName   = displayName || email?.split("@")[0] || uid.slice(0, 8);
  const username  = sanitizeUsername(rawName);

  // ── Determine auth provider ───────────────────────────────────────────────
  const provider = providerData?.[0]?.providerId || "password";

  const now = admin.firestore.FieldValue.serverTimestamp();

  // ── Private user profile ──────────────────────────────────────────────────
  const userDoc = {
    uid,
    email:          email || "",
    username,
    displayName:    displayName || username,
    photoURL:       photoURL || null,
    provider,

    // Plan & role
    plan:           "free",
    role:           "user",        // "user" | "mod" | "admin"

    // ELO
    elo:            0,             // starting ELO — earned through solving
    weeklyElo:      0,
    monthlyElo:     0,

    // Solve stats
    totalSolved:    0,
    correctSubmissions: 0,
    wrongSubmissions:   0,
    solvedByDifficulty: {
      easy:   0,
      medium: 0,
      hard:   0,
    },

    // Streak
    currentStreak:  0,
    maxStreak:      0,
    lastActiveDate: null,

    // Daily solve tracking (free tier limit)
    // Format: { "2024-01-15": 3 }  — written by submitAnswer
    dailySolves:    {},

    // Streak freezes (Pro feature)
    streakFreezes:  0,

    // Certifications
    certifications: {},   // { recruit: "certId", analyst: "certId", ... }
    totalCertificates: 0,

    // Flags / bans
    isBanned:       false,
    isFlagged:      false,
    warningCount:   0,
    flagCount:      0,

    // Badges
    badges:         [],   // ["speed_demon", "first_blood", ...]

    // Pro subscription
    proSince:       null,
    proExpiresAt:   null,
    billingPeriod:  null,
    lastPaymentId:  null,

    // Metadata
    createdAt:      now,
    lastLoginAt:    now,
  };

  // ── Public profile (minimal, used by leaderboard + public /profile pages) ─
  const publicDoc = {
    uid,
    username,
    plan:          "free",
    elo:           0,
    weeklyElo:     0,
    monthlyElo:    0,
    totalSolved:   0,
    currentStreak: 0,
    maxStreak:     0,
    badges:        [],
    latestCert:    null,
    createdAt:     now,
  };

  try {
    // ── Write both docs atomically ──────────────────────────────────────────
    const batch = db.batch();
    batch.set(db.collection("users").doc(uid),          userDoc);
    batch.set(db.collection("publicProfiles").doc(uid), publicDoc);
    await batch.commit();

    // ── Set initial custom claims ─────────────────────────────────────────
    // These go into the JWT so isPro / isAdmin are available client-side
    // without a Firestore read on every request.
    await auth.setCustomUserClaims(uid, {
      plan: "free",
      role: "user",
    });

    console.log(`onUserCreated: profile + claims created for uid=${uid} username="${username}"`);

  } catch (err) {
    console.error(`onUserCreated: failed to create profile for uid=${uid}`, err);
    // Don't throw — Auth user is already created; we don't want to break
    // sign-up. The profile can be recreated on first sign-in if missing.
    return;
  }

  // ── Send welcome email (non-blocking — failure is logged, not thrown) ─────
  if (email) {
    try {
      await sendWelcomeEmail({ email, username });
    } catch (err) {
      console.warn(`onUserCreated: welcome email failed for ${email}`, err.message);
    }
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sanitises an arbitrary string into a valid OSINT Arena username.
 * Rules: alphanumeric + underscores, 3–20 chars, no leading/trailing underscores.
 */
function sanitizeUsername(raw) {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")   // replace invalid chars with _
    .replace(/^_+|_+$/g, "")        // strip leading/trailing underscores
    .replace(/_+/g, "_")            // collapse consecutive underscores
    .slice(0, 20);                   // max 20 chars

  // Ensure minimum length
  if (cleaned.length < 3) {
    return `user_${cleaned.padEnd(3, "0")}`.slice(0, 20);
  }

  return cleaned;
}