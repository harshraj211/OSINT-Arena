/**
 * normalizeAnswer.js
 * Pure function — zero Firebase dependencies.
 * Shared between frontend (display only) and backend (actual validation).
 *
 * IMPORTANT: Backend normalization is the source of truth.
 * Client-side normalization is only for UX feedback.
 */

/**
 * Default normalization rules applied to all challenges.
 * Per-challenge rules stored in challenge.answerNormalizationRules
 * can override or extend these.
 */
const DEFAULT_RULES = {
  trim: true,
  lowercase: true,
  removeSpaces: false,    // Off by default — some answers have intentional spaces
  removeSpecialChars: false,
  removeDots: false,
  removeHyphens: false,
};

/**
 * Applies normalization rules to a raw answer string.
 *
 * @param {string} rawAnswer - The answer as submitted by the user
 * @param {Object} [rules]   - Override rules from challenge doc
 * @param {boolean} [rules.trim]
 * @param {boolean} [rules.lowercase]
 * @param {boolean} [rules.removeSpaces]
 * @param {boolean} [rules.removeSpecialChars]
 * @param {boolean} [rules.removeDots]
 * @param {boolean} [rules.removeHyphens]
 *
 * @returns {string} - Normalized answer
 */
function normalizeAnswer(rawAnswer, rules = {}) {
  if (typeof rawAnswer !== "string") {
    throw new Error("Answer must be a string.");
  }

  const config = { ...DEFAULT_RULES, ...rules };

  let answer = rawAnswer;

  if (config.trim) {
    answer = answer.trim();
  }

  if (config.lowercase) {
    answer = answer.toLowerCase();
  }

  if (config.removeSpaces) {
    answer = answer.replace(/\s+/g, "");
  }

  if (config.removeDots) {
    answer = answer.replace(/\./g, "");
  }

  if (config.removeHyphens) {
    answer = answer.replace(/-/g, "");
  }

  if (config.removeSpecialChars) {
    // Keeps alphanumeric and dots/hyphens (useful for domains/IPs)
    answer = answer.replace(/[^a-z0-9.-]/g, "");
  }

  return answer;
}

/**
 * Validates that a raw answer, after normalization, is non-empty
 * and within safe length bounds.
 *
 * @param {string} rawAnswer
 * @param {Object} [rules]
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateAnswerInput(rawAnswer, rules = {}) {
  if (!rawAnswer || typeof rawAnswer !== "string") {
    return { valid: false, reason: "Answer is required." };
  }

  if (rawAnswer.length > 500) {
    return { valid: false, reason: "Answer exceeds maximum length." };
  }

  const normalized = normalizeAnswer(rawAnswer, rules);

  if (normalized.length === 0) {
    return { valid: false, reason: "Answer cannot be empty after normalization." };
  }

  return { valid: true };
}

module.exports = {
  normalizeAnswer,
  validateAnswerInput,
  DEFAULT_RULES,
};