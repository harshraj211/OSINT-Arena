/**
 * hashAnswer.js — frontend version
 * Matches the backend hash in functions/src/lib/hashAnswer.js
 * Used by AdminChallenges to hash flags before storing.
 *
 * File location: frontend/src/lib/hashAnswer.js
 */

// Web Crypto API — available in all modern browsers
export async function hashAnswer(raw) {
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, " ");
  const salted     = normalized + "osint-arena-salt-2024";
  const encoded    = new TextEncoder().encode(salted);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}