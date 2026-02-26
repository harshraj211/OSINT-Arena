/**
 * lib.test.js
 * Run with: node lib.test.js
 * No test framework needed — pure assertion-based tests.
 */

const { calculateEloGain, calculateWrongAttemptDeduction } = require("./calculateElo");
const { calculateStreak, applyStreakFreeze } = require("./calculateStreak");
const { normalizeAnswer, validateAnswerInput } = require("./normalizeAnswer");
const { hashRawAnswer, verifyAnswer } = require("./hashAnswer");
const { runAntiCheatChecks, checkRateLimit, checkSpeedAnomaly } = require("./antiCheat");
const { buildHeatmapDataset, getHeatmapColor, incrementHeatmapDay } = require("./heatmap");

let passed = 0;
let failed = 0;

function assert(label, condition, extra = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} ${extra}`);
    failed++;
  }
}

// ─── ELO ─────────────────────────────────────────────────────────────────────
console.log("\n📊 calculateElo");

{
  const r = calculateEloGain({ difficulty: "easy", expectedTime: 60, timeTaken: 60, hintUsed: false, wrongAttempts: 0 });
  assert("Easy, perfect time, no hint, no wrong = 10 ELO", r.finalEloGain === 10, `got ${r.finalEloGain}`);
}
{
  const r = calculateEloGain({ difficulty: "hard", expectedTime: 300, timeTaken: 150, hintUsed: false, wrongAttempts: 0 });
  assert("Hard, 2x speed = 100 ELO (50 * 2.0)", r.finalEloGain === 100, `got ${r.finalEloGain}`);
}
{
  const r = calculateEloGain({ difficulty: "medium", expectedTime: 120, timeTaken: 120, hintUsed: true, wrongAttempts: 0 });
  assert("Medium, hint used = 20 ELO (25 * 1.0 * 0.8)", r.finalEloGain === 20, `got ${r.finalEloGain}`);
}
{
  const r = calculateEloGain({ difficulty: "medium", expectedTime: 120, timeTaken: 120, hintUsed: false, wrongAttempts: 5 });
  assert("Medium, 5 wrong attempts = attempt penalty floored at 0.5", r.attemptPenalty === 0.5, `got ${r.attemptPenalty}`);
}
{
  const r = calculateEloGain({ difficulty: "hard", expectedTime: 300, timeTaken: 3000, hintUsed: false, wrongAttempts: 0 });
  assert("Time bonus floored at 0.5x", r.timeBonus === 0.5, `got ${r.timeBonus}`);
}
{
  assert("Wrong attempt deduction = -2", calculateWrongAttemptDeduction(0) === -2);
  assert("Wrong attempt deduction capped at 0 after 5 attempts", calculateWrongAttemptDeduction(5) === 0);
}

// ─── STREAK ───────────────────────────────────────────────────────────────────
console.log("\n🔥 calculateStreak");

{
  const today = new Date().toISOString().split("T")[0];
  const r = calculateStreak({ lastActiveDate: today, currentStreak: 5, maxStreak: 10 });
  assert("Already solved today → no change", r.action === "no_change" && r.currentStreak === 5);
}
{
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const r = calculateStreak({ lastActiveDate: yesterday, currentStreak: 5, maxStreak: 10 });
  assert("Solved yesterday → streak incremented to 6", r.currentStreak === 6 && r.action === "incremented");
}
{
  const r = calculateStreak({ lastActiveDate: "2020-01-01", currentStreak: 20, maxStreak: 30 });
  assert("Old lastActiveDate → streak resets to 1", r.currentStreak === 1 && r.action === "reset");
  assert("maxStreak preserved on reset", r.maxStreak === 30);
}
{
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const r = applyStreakFreeze({ lastActiveDate: yesterday, currentStreak: 10, freezesAvailable: 1 });
  assert("Freeze applied when 1 freeze available", r.freezeApplied === true && r.freezesAvailable === 0);
}
{
  const r = applyStreakFreeze({ lastActiveDate: "2020-01-01", currentStreak: 10, freezesAvailable: 2 });
  assert("Freeze not applied for multi-day gap", r.freezeApplied === false);
}

// ─── NORMALIZE ────────────────────────────────────────────────────────────────
console.log("\n🔧 normalizeAnswer");

assert("Trim + lowercase", normalizeAnswer("  HELLO  ") === "hello");
assert("Remove spaces when rule enabled", normalizeAnswer("hello world", { removeSpaces: true }) === "helloworld");
assert("Remove dots when rule enabled", normalizeAnswer("sub.domain.com", { removeDots: true }) === "subdomaincom");
assert("Combined rules", normalizeAnswer("  SUB.DOMAIN.COM  ", { removeDots: true }) === "subdomaincom");
assert("Invalid empty answer rejected", validateAnswerInput("").valid === false);
assert("Too long answer rejected", validateAnswerInput("x".repeat(501)).valid === false);
assert("Valid answer passes", validateAnswerInput("google.com").valid === true);

// ─── HASH ─────────────────────────────────────────────────────────────────────
console.log("\n🔐 hashAnswer");

{
  const hash = hashRawAnswer("google.com");
  assert("hashRawAnswer returns 64-char hex", hash.length === 64);
  assert("verifyAnswer correct", verifyAnswer("google.com", hash) === true);
  assert("verifyAnswer wrong answer", verifyAnswer("bing.com", hash) === false);
  assert("verifyAnswer case insensitive (lowercase rule)", verifyAnswer("Google.Com", hash) === true);
  assert("verifyAnswer with spaces trimmed", verifyAnswer("  google.com  ", hash) === true);
}

// ─── ANTI-CHEAT ───────────────────────────────────────────────────────────────
console.log("\n🛡️  antiCheat");

{
  const r = checkSpeedAnomaly({ timeTaken: 5, difficulty: "hard" });
  assert("Hard challenge in 5s → flagged", r.flagged === true);
}
{
  const r = checkSpeedAnomaly({ timeTaken: 30, difficulty: "hard" });
  assert("Hard challenge in 30s → not flagged", r.flagged === false);
}
{
  const now = Date.now();
  const attempts = [now - 1000, now - 2000, now - 3000, now - 4000, now - 5000];
  const r = checkRateLimit({ recentAttemptTimestamps: attempts, nowMs: now });
  assert("5 recent attempts → rate limited", r.limited === true);
}
{
  const now = Date.now();
  const r = checkRateLimit({ recentAttemptTimestamps: [], nowMs: now });
  assert("0 attempts → not rate limited", r.limited === false);
}
{
  const r = runAntiCheatChecks({
    timeTaken: -1, difficulty: "easy",
    recentAttemptTimestamps: [], nowMs: Date.now(), ip: "1.2.3.4"
  });
  assert("Negative timeTaken → shouldBlock", r.shouldBlock === true);
}

// ─── HEATMAP ──────────────────────────────────────────────────────────────────
console.log("\n📅 heatmap");

assert("getHeatmapColor(0) → empty", getHeatmapColor(0).className === "heatmap-empty");
assert("getHeatmapColor(1) → light", getHeatmapColor(1).className === "heatmap-light");
assert("getHeatmapColor(3) → medium", getHeatmapColor(3).className === "heatmap-medium");
assert("getHeatmapColor(4) → dark", getHeatmapColor(4).className === "heatmap-dark");

{
  const dataset = buildHeatmapDataset({}, 365);
  assert("buildHeatmapDataset returns 365 items", dataset.length === 365);
  assert("All empty dates are level 0", dataset.every((d) => d.level === 0));
}
{
  const today = new Date().toISOString().split("T")[0];
  const { updatedMap, newCount } = incrementHeatmapDay({ [today]: 2 });
  assert("incrementHeatmapDay increments existing count", newCount === 3 && updatedMap[today] === 3);
}
{
  const { updatedMap, newCount } = incrementHeatmapDay({});
  assert("incrementHeatmapDay starts at 1 for new day", newCount === 1);
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);