/**
 * checkCertEligibility.js
 * HTTPS Callable — checks if a Pro user has earned a tier certification
 * and issues one if eligible.
 *
 * Eligibility rules per tier:
 *   Recruit  (0–199 ELO)   — solve ALL easy challenges
 *   Analyst  (200–499)     — solve ALL easy + ALL free medium challenges
 *   Agent    (500–999)     — solve ALL easy + ALL medium challenges (Pro)
 *   Operator (1000–1999)   — solve ALL easy + medium + 25% of hard
 *   Elite    (2000–3999)   — solve ALL easy + medium + 75% of hard
 *   Phantom  (4000+)       — solve ALL challenges + ELO ≥ 4000
 *
 * Guards:
 *   - Must be authenticated + email verified
 *   - Must have plan === "pro" (except Recruit which is free-tier achievable)
 *   - Must not already hold a valid (non-expired) cert for this tier
 *
 * On issue:
 *   - Writes certifications/{certId} with full cert data
 *   - Writes users/{uid}.certifications.{tier} = certId
 *   - Writes publicProfiles/{uid}.latestCert = { tier, certId }
 *   - certId is a short, human-readable ID: {tier}-{uid6}-{timestamp6}
 *
 * Certificate expiry:
 *   Recruit/Analyst: 1 year
 *   Agent/Operator:  2 years
 *   Elite/Phantom:   permanent (no expiry)
 *
 * File location: functions/src/certifications/checkCertEligibility.js
 */

"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// ── Tier definitions (mirror of frontend ELO_TIERS) ──────────────────────────
const TIERS = [
  { name: "recruit",  minElo: 0,    maxElo: 199  },
  { name: "analyst",  minElo: 200,  maxElo: 499  },
  { name: "agent",    minElo: 500,  maxElo: 999  },
  { name: "operator", minElo: 1000, maxElo: 1999 },
  { name: "elite",    minElo: 2000, maxElo: 3999 },
  { name: "phantom",  minElo: 4000, maxElo: Infinity },
];

// Cert expiry in days (null = permanent)
const CERT_EXPIRY_DAYS = {
  recruit:  365,
  analyst:  365,
  agent:    730,
  operator: 730,
  elite:    null,
  phantom:  null,
};

// ── Eligibility requirements per tier ────────────────────────────────────────
// Each entry describes what fraction of each difficulty must be solved.
// { easy: 1.0 } means 100% of easy challenges must be solved.
const TIER_REQUIREMENTS = {
  recruit:  { easy: 1.0,  medium: 0,    hard: 0    }, // all easy
  analyst:  { easy: 1.0,  medium: 0.30, hard: 0    }, // all easy + free medium
  agent:    { easy: 1.0,  medium: 1.0,  hard: 0    }, // all easy + all medium
  operator: { easy: 1.0,  medium: 1.0,  hard: 0.25 },
  elite:    { easy: 1.0,  medium: 1.0,  hard: 0.75 },
  phantom:  { easy: 1.0,  medium: 1.0,  hard: 1.0, minElo: 4000 },
};

// ── Main function ─────────────────────────────────────────────────────────────
exports.checkCertEligibility = onCall({ enforceAppCheck: false }, async (request) => {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const { auth } = request;
  if (!auth) throw new HttpsError("unauthenticated", "Must be signed in.");
  if (!auth.token.email_verified) throw new HttpsError("failed-precondition", "Email not verified.");

  const userId = auth.uid;
  const { tier } = request.data;

  // ── Validate requested tier ───────────────────────────────────────────────
  const tierDef = TIERS.find(t => t.name === tier);
  if (!tierDef) {
    throw new HttpsError("invalid-argument", `Invalid tier: ${tier}. Must be one of: ${TIERS.map(t => t.name).join(", ")}.`);
  }

  const requirements = TIER_REQUIREMENTS[tier];

  // ── Fetch user profile ────────────────────────────────────────────────────
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
  const user = userSnap.data();

  // Recruit cert is free-tier earnable; all others require Pro
  if (tier !== "recruit" && user.plan !== "pro" && user.role !== "admin") {
    throw new HttpsError("permission-denied", `The ${tier} certificate requires a Pro subscription.`);
  }

  if (user.isBanned) {
    throw new HttpsError("permission-denied", "Account is banned.");
  }

  // ── ELO gate (Phantom) ───────────────────────────────────────────────────
  if (requirements.minElo && (user.elo || 0) < requirements.minElo) {
    throw new HttpsError(
      "failed-precondition",
      `Your ELO (${user.elo || 0}) is below the ${requirements.minElo} minimum for ${tier}.`
    );
  }

  // ── Check for existing valid cert ─────────────────────────────────────────
  const existingCertId = user.certifications?.[tier];
  if (existingCertId) {
    const existingSnap = await db.collection("certifications").doc(existingCertId).get();
    if (existingSnap.exists) {
      const existing = existingSnap.data();
      const expiresAt = existing.expiresAt?.toDate?.() ?? null;
      if (!expiresAt || expiresAt > new Date()) {
        // Already holds a valid cert for this tier
        return {
          eligible:    true,
          alreadyHeld: true,
          certId:      existingCertId,
          tier,
          issuedAt:    existing.issuedAt?.toMillis?.() ?? null,
          expiresAt:   existing.expiresAt?.toMillis?.() ?? null,
        };
      }
    }
    // Expired cert — allow re-issue below
  }

  // ── Count total challenges per difficulty ─────────────────────────────────
  const [easyTotal, mediumTotal, hardTotal] = await Promise.all([
    countChallenges("easy"),
    countChallenges("medium"),
    countChallenges("hard"),
  ]);

  // ── Count user's solved challenges per difficulty ─────────────────────────
  const [easySolved, mediumSolved, hardSolved] = await Promise.all([
    countSolved(userId, "easy"),
    countSolved(userId, "medium"),
    countSolved(userId, "hard"),
  ]);

  // ── Check eligibility ─────────────────────────────────────────────────────
  const checks = {
    easy:   easyTotal   > 0 ? easySolved   / easyTotal   : 1,
    medium: mediumTotal > 0 ? mediumSolved / mediumTotal : 1,
    hard:   hardTotal   > 0 ? hardSolved   / hardTotal   : 1,
  };

  const notMet = [];
  if (requirements.easy   > 0 && checks.easy   < requirements.easy) {
    notMet.push(`Easy: solved ${easySolved}/${easyTotal} (need ${Math.ceil(easyTotal * requirements.easy)})`);
  }
  if (requirements.medium > 0 && checks.medium < requirements.medium) {
    notMet.push(`Medium: solved ${mediumSolved}/${mediumTotal} (need ${Math.ceil(mediumTotal * requirements.medium)})`);
  }
  if (requirements.hard   > 0 && checks.hard   < requirements.hard) {
    notMet.push(`Hard: solved ${hardSolved}/${hardTotal} (need ${Math.ceil(hardTotal * requirements.hard)})`);
  }

  if (notMet.length > 0) {
    return {
      eligible: false,
      tier,
      reason:   "Requirements not met.",
      unmet:    notMet,
      progress: {
        easy:   { solved: easySolved,   total: easyTotal,   required: Math.ceil(easyTotal * requirements.easy) },
        medium: { solved: mediumSolved, total: mediumTotal, required: Math.ceil(mediumTotal * requirements.medium) },
        hard:   { solved: hardSolved,   total: hardTotal,   required: Math.ceil(hardTotal * requirements.hard) },
      },
    };
  }

  // ── Issue certificate ─────────────────────────────────────────────────────
  const certId    = generateCertId(tier, userId);
  const now       = Timestamp.now();
  const expiryDays = CERT_EXPIRY_DAYS[tier];
  const expiresAt = expiryDays
    ? Timestamp.fromDate(addDays(now.toDate(), expiryDays))
    : null;

  const certData = {
    certId,
    userId,
    username:  user.username || "",
    tier,
    issuedAt:  now,
    expiresAt: expiresAt,
    // Snapshot of stats at time of issue
    eloAtIssue:       user.elo || 0,
    solvedAtIssue:    easySolved + mediumSolved + hardSolved,
    // Verification URL (used by CertVerify page)
    verifyUrl: `https://osintarena.com/verify/${certId}`,
  };

  const batch = db.batch();

  // Write cert doc
  batch.set(db.collection("certifications").doc(certId), certData);

  // Update user profile
  batch.update(db.collection("users").doc(userId), {
    [`certifications.${tier}`]: certId,
    totalCertificates:          FieldValue.increment(existingCertId ? 0 : 1),
  });

  // Update public profile (for leaderboard / profile page display)
  batch.update(db.collection("publicProfiles").doc(userId), {
    latestCert: { tier, certId, issuedAt: now },
  });

  // Log to adminLogs
  batch.set(db.collection("adminLogs").doc(), {
    type:      "cert_issued",
    userId,
    username:  user.username,
    tier,
    certId,
    timestamp: now,
  });

  await batch.commit();

  console.log(`checkCertEligibility: issued ${tier} cert ${certId} to uid=${userId}`);

  return {
    eligible:    true,
    alreadyHeld: false,
    issued:      true,
    certId,
    tier,
    issuedAt:    now.toMillis(),
    expiresAt:   expiresAt?.toMillis?.() ?? null,
    verifyUrl:   certData.verifyUrl,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count total published challenges of a given difficulty. */
async function countChallenges(difficulty) {
  const snap = await db
    .collection("challenges")
    .where("difficulty", "==", difficulty)
    .where("isActive", "==", true)
    .count()
    .get();
  return snap.data().count;
}

/** Count challenges of a given difficulty that this user has solved correctly. */
async function countSolved(userId, difficulty) {
  // Join via submissions — get unique challengeIds solved correctly
  // Firestore doesn't support joins, so we query submissions and deduplicate.
  // For scale, maintain a per-user solved counter in Firestore (updated by submitAnswer).
  // Here we read from the denormalised users/{uid}.solvedByDifficulty.{difficulty} counter
  // written by submitAnswer on each correct submission.
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) return 0;
  return userSnap.data()?.solvedByDifficulty?.[difficulty] ?? 0;
}

/** Generate a short human-readable cert ID. */
function generateCertId(tier, userId) {
  const now      = Date.now().toString(36).slice(-6).toUpperCase();
  const uidSlice = userId.slice(0, 6).toUpperCase();
  return `${tier.toUpperCase()}-${uidSlice}-${now}`;
  // Example: PHANTOM-AB12CD-X7F3K2
}

/** Add days to a Date. */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}