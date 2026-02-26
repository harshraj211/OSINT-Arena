/**
 * calculateElo.js
 * Pure function — zero Firebase dependencies.
 * Portable to NestJS/PostgreSQL migration as-is.
 */

const DIFFICULTY_BASE_POINTS = {
  easy: 10,
  medium: 25,
  hard: 50,
};

const WRONG_ATTEMPT_ELO_DEDUCTION = 2;
const MAX_WRONG_ATTEMPT_DEDUCTION = 10;

/**
 * Calculates ELO gain for a correct submission.
 *
 * @param {Object} params
 * @param {'easy'|'medium'|'hard'} params.difficulty
 * @param {number} params.expectedTime   - in seconds (from challenge doc)
 * @param {number} params.timeTaken      - in seconds (server-calculated)
 * @param {boolean} params.hintUsed      - whether user revealed hint
 * @param {number} params.wrongAttempts  - wrong attempts before this correct one
 *
 * @returns {{
 *   baseElo: number,
 *   timeBonus: number,
 *   hintPenalty: number,
 *   attemptPenalty: number,
 *   finalEloGain: number
 * }}
 */
function calculateEloGain({ difficulty, expectedTime, timeTaken, hintUsed, wrongAttempts }) {
  if (!DIFFICULTY_BASE_POINTS[difficulty]) {
    throw new Error(`Invalid difficulty: "${difficulty}". Must be easy, medium, or hard.`);
  }
  if (typeof expectedTime !== "number" || expectedTime <= 0) {
    throw new Error("expectedTime must be a positive number.");
  }
  if (typeof timeTaken !== "number" || timeTaken <= 0) {
    throw new Error("timeTaken must be a positive number.");
  }

  const baseElo = DIFFICULTY_BASE_POINTS[difficulty];

  // Time bonus: faster than expected = up to 2x, slower = down to 0.5x
  const rawTimeBonus = expectedTime / timeTaken;
  const timeBonus = Math.max(0.5, Math.min(2.0, rawTimeBonus));

  // Hint penalty: 20% reduction if hint was used
  const hintPenalty = hintUsed ? 0.8 : 1.0;

  // Attempt penalty: -10% per wrong attempt, floored at 0.5x
  const rawAttemptPenalty = 1 - wrongAttempts * 0.1;
  const attemptPenalty = Math.max(0.5, rawAttemptPenalty);

  const finalEloGain = Math.round(baseElo * timeBonus * hintPenalty * attemptPenalty);

  return {
    baseElo,
    timeBonus: parseFloat(timeBonus.toFixed(4)),
    hintPenalty,
    attemptPenalty: parseFloat(attemptPenalty.toFixed(4)),
    finalEloGain,
  };
}

/**
 * Calculates ELO deduction for a wrong attempt.
 * Capped at MAX_WRONG_ATTEMPT_DEDUCTION total per challenge session.
 *
 * @param {number} wrongAttemptsSoFar - attempts made BEFORE this one
 * @returns {number} - negative value (e.g. -2), or 0 if cap already reached
 */
function calculateWrongAttemptDeduction(wrongAttemptsSoFar) {
  const totalDeductionSoFar = wrongAttemptsSoFar * WRONG_ATTEMPT_ELO_DEDUCTION;
  if (totalDeductionSoFar >= MAX_WRONG_ATTEMPT_DEDUCTION) {
    return 0; // Cap already hit — no further deduction
  }
  return -WRONG_ATTEMPT_ELO_DEDUCTION;
}

module.exports = {
  calculateEloGain,
  calculateWrongAttemptDeduction,
  DIFFICULTY_BASE_POINTS,
  WRONG_ATTEMPT_ELO_DEDUCTION,
  MAX_WRONG_ATTEMPT_DEDUCTION,
};