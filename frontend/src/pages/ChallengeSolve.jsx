/**
 * ChallengeSolve.jsx
 * The core challenge solving page — three-panel layout:
 *   LEFT:   Challenge description (markdown), hint, tool hint
 *   RIGHT:  Answer input, submission, result feedback
 *   TOP BAR: Challenge meta, timer, difficulty, back button
 *
 * Calls Cloud Functions: openChallenge + submitAnswer
 *
 * File location: frontend/src/pages/ChallengeSolve.jsx
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import Navbar from "../components/layout/Navbar";
import "./ChallengeSolve.css";

const functions = getFunctions();
const openChallengeFn  = httpsCallable(functions, "openChallenge");
const submitAnswerFn   = httpsCallable(functions, "submitAnswer");

// Difficulty config
const DIFFICULTY = {
  easy:   { label: "Easy",   color: "var(--color-easy)",   bg: "rgba(0,255,136,0.08)" },
  medium: { label: "Medium", color: "var(--color-medium)", bg: "rgba(255,149,0,0.08)" },
  hard:   { label: "Hard",   color: "var(--color-hard)",   bg: "rgba(255,77,77,0.08)" },
};

export default function ChallengeSolve() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile, canSolveToday } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [challenge, setChallenge]         = useState(null);
  const [challengeId, setChallengeId]     = useState(null);
  const [pageLoading, setPageLoading]     = useState(true);
  const [pageError, setPageError]         = useState("");

  const [answer, setAnswer]               = useState("");
  const [hintUsed, setHintUsed]           = useState(false);
  const [hintVisible, setHintVisible]     = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState("");

  const [result, setResult]               = useState(null); // { correct, eloChange, streak, breakdown, ... }
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const openedAtRef = useRef(null);

  // Panel resize
  const [leftWidth, setLeftWidth]   = useState(50); // percent
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  // ── Load challenge + open session ─────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    loadChallenge();
    return () => clearInterval(timerRef.current);
  }, [slug]);

  async function loadChallenge() {
    setPageLoading(true);
    setPageError("");

    try {
      // Find challenge by slug
      const { getDocs, collection, query, where } = await import("firebase/firestore");
      const q = query(
        collection(db, "challenges"),
        where("slug", "==", slug),
        where("isActive", "==", true)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setPageError("Challenge not found.");
        setPageLoading(false);
        return;
      }

      const challengeDoc = snap.docs[0];
      const data = challengeDoc.data();
      setChallengeId(challengeDoc.id);
      setChallenge(data);

      // Open session on server — records openTimestamp
      await openChallengeFn({ challengeId: challengeDoc.id });

      // Start elapsed timer
      openedAtRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - openedAtRef.current) / 1000));
      }, 1000);

    } catch (err) {
      setPageError(err.message || "Failed to load challenge.");
    } finally {
      setPageLoading(false);
    }
  }

  // ── Submit answer ─────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!answer.trim() || submitting || rateLimitSeconds > 0) return;

    // Free tier daily limit check
    if (!canSolveToday()) {
      setSubmitError("Daily limit reached (5 challenges/day). Upgrade to Pro for unlimited access.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setResult(null);

    try {
      const res = await submitAnswerFn({
        challengeId,
        answer: answer.trim(),
        hintUsed,
        contestId: null,
      });

      const data = res.data;
      setResult(data);

      if (data.correct) {
        clearInterval(timerRef.current); // Stop timer on correct
      } else {
        setWrongAttempts((w) => w + 1);
        setAnswer(""); // Clear input on wrong
      }

    } catch (err) {
      const code = err.code;
      if (code === "functions/resource-exhausted") {
        // Rate limited — parse retry seconds from message
        const match = err.message.match(/(\d+)s/);
        const secs = match ? parseInt(match[1]) : 60;
        setRateLimitSeconds(secs);
        startRateLimitCountdown(secs);
        setSubmitError(`Too many attempts. Try again in ${secs} seconds.`);
      } else {
        setSubmitError(err.message || "Submission failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startRateLimitCountdown(seconds) {
    const interval = setInterval(() => {
      setRateLimitSeconds((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  // ── Hint reveal ───────────────────────────────────────────────────────────
  function handleRevealHint() {
    setHintVisible(true);
    setHintUsed(true);
  }

  // ── Panel drag resize ─────────────────────────────────────────────────────
  function handleDividerMouseDown(e) {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.min(75, Math.max(25, pct)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  // ── Keyboard shortcut: Ctrl+Enter to submit ───────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (answer.trim() && !submitting && !result?.correct) {
          handleSubmit(e);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [answer, submitting, result]);

  // ── Render states ─────────────────────────────────────────────────────────
  if (pageLoading) return <LoadingScreen />;
  if (pageError)   return <ErrorScreen error={pageError} onBack={() => navigate("/challenges")} />;
  if (!challenge)  return null;

  const diff = DIFFICULTY[challenge.difficulty] || DIFFICULTY.easy;
  const alreadySolved = result?.correct && result?.alreadySolved;

  return (
    <div className="solve-shell">
      <Navbar />

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="solve-topbar">
        <button className="solve-back-btn" onClick={() => navigate("/challenges")}>
          ← Challenges
        </button>

        <div className="solve-topbar-center">
          <h1 className="solve-title">{challenge.title}</h1>
          <span
            className="solve-difficulty-badge"
            style={{ color: diff.color, background: diff.bg }}
          >
            {diff.label}
          </span>
        </div>

        <div className="solve-topbar-right">
          {/* Elapsed timer — hidden after correct solve */}
          {!result?.correct && (
            <div className="solve-timer" title="Time elapsed">
              <span className="solve-timer-icon">⏱</span>
              <span className="solve-timer-value">{formatTime(elapsedSeconds)}</span>
            </div>
          )}

          {/* Wrong attempts counter */}
          {wrongAttempts > 0 && (
            <div className="solve-attempts" title="Wrong attempts">
              <span style={{ color: "var(--color-error)" }}>✗ {wrongAttempts}</span>
            </div>
          )}

          {/* Expected time hint */}
          <div className="solve-expected" title="Expected solve time">
            <span className="solve-expected-label">Expected</span>
            <span className="solve-expected-value">{formatTime(challenge.expectedTime)}</span>
          </div>
        </div>
      </div>

      {/* ── Three panel layout ────────────────────────────────────────────── */}
      <div className="solve-panels" ref={containerRef}>

        {/* ── LEFT: Problem description ──────────────────────────────────── */}
        <div className="solve-panel solve-panel--left" style={{ width: `${leftWidth}%` }}>
          <div className="solve-panel-inner">

            {/* Problem statement */}
            <section className="solve-section">
              <div className="solve-section-header">
                <span className="solve-section-label">Mission Brief</span>
              </div>
              <div className="solve-markdown">
                <ReactMarkdown>{challenge.description}</ReactMarkdown>
              </div>
            </section>

            {/* Tool hint */}
            {challenge.toolHint && (
              <section className="solve-section">
                <div className="solve-section-header">
                  <span className="solve-section-label">Tool Category</span>
                </div>
                <div className="solve-tool-hint">
                  <span className="solve-tool-hint-icon">⚙</span>
                  {challenge.toolHint}
                </div>
              </section>
            )}

            {/* Hint */}
            {challenge.hint && (
              <section className="solve-section">
                <div className="solve-section-header">
                  <span className="solve-section-label">Hint</span>
                  {hintUsed && (
                    <span className="solve-hint-penalty-warning">−20% ELO</span>
                  )}
                </div>

                {hintVisible ? (
                  <div className="solve-hint-revealed">
                    <span className="solve-hint-icon">💡</span>
                    <p>{challenge.hint}</p>
                  </div>
                ) : (
                  <button className="solve-hint-btn" onClick={handleRevealHint}>
                    Reveal hint
                    <span className="solve-hint-btn-penalty">−20% ELO penalty</span>
                  </button>
                )}
              </section>
            )}

            {/* Stats */}
            <section className="solve-stats-row">
              <div className="solve-stat">
                <span className="solve-stat-value">{challenge.solveCount ?? 0}</span>
                <span className="solve-stat-label">Solvers</span>
              </div>
              <div className="solve-stat">
                <span className="solve-stat-value">
                  {challenge.avgSolveTime ? formatTime(challenge.avgSolveTime) : "—"}
                </span>
                <span className="solve-stat-label">Avg time</span>
              </div>
              <div className="solve-stat">
                <span className="solve-stat-value" style={{ color: diff.color }}>
                  +{challenge.basePoints}
                </span>
                <span className="solve-stat-label">Base ELO</span>
              </div>
            </section>

          </div>
        </div>

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <div
          className="solve-divider"
          onMouseDown={handleDividerMouseDown}
          title="Drag to resize"
        >
          <div className="solve-divider-handle" />
        </div>

        {/* ── RIGHT: Answer + result ─────────────────────────────────────── */}
        <div className="solve-panel solve-panel--right" style={{ width: `${100 - leftWidth}%` }}>
          <div className="solve-panel-inner">

            {/* Already solved — practice mode banner */}
            {result?.correct && result?.alreadySolved && (
              <div className="solve-practice-banner">
                ✓ You've already solved this — practice mode (no ELO awarded)
              </div>
            )}

            {/* ── Result display (correct) ──────────────────────────────── */}
            {result?.correct && (
              <div className="solve-result solve-result--correct">
                <div className="solve-result-header">
                  <span className="solve-result-icon">✓</span>
                  <span className="solve-result-title">
                    {alreadySolved ? "Correct (Practice)" : "Correct!"}
                  </span>
                </div>

                {!alreadySolved && (
                  <>
                    <div className="solve-elo-gain">
                      <span className="solve-elo-gain-value">+{result.eloChange}</span>
                      <span className="solve-elo-gain-label">ELO</span>
                    </div>

                    {/* Breakdown */}
                    <div className="solve-breakdown">
                      <BreakdownRow
                        label="Base ELO"
                        value={`+${result.breakdown?.baseElo}`}
                      />
                      <BreakdownRow
                        label="Time bonus"
                        value={`×${result.breakdown?.timeBonus?.toFixed(2)}`}
                        highlight={result.breakdown?.timeBonus >= 1.5}
                      />
                      {result.breakdown?.hintPenalty < 1 && (
                        <BreakdownRow
                          label="Hint penalty"
                          value={`×${result.breakdown?.hintPenalty}`}
                          negative
                        />
                      )}
                      {result.breakdown?.attemptPenalty < 1 && (
                        <BreakdownRow
                          label="Attempt penalty"
                          value={`×${result.breakdown?.attemptPenalty?.toFixed(2)}`}
                          negative
                        />
                      )}
                    </div>

                    {/* Streak */}
                    {result.streak?.changed && (
                      <div className="solve-streak-update">
                        <span className="solve-streak-icon">🔥</span>
                        <span>
                          {result.streak.action === "incremented"
                            ? `Streak extended to ${result.streak.current} days`
                            : `New streak started: ${result.streak.current} day`
                          }
                        </span>
                      </div>
                    )}

                    <div className="solve-result-time">
                      Solved in {formatTime(result.timeTaken)}
                    </div>
                  </>
                )}

                <button
                  className="solve-next-btn"
                  onClick={() => navigate("/challenges")}
                >
                  Back to challenges →
                </button>
              </div>
            )}

            {/* ── Answer form (shown until correct) ─────────────────────── */}
            {!result?.correct && (
              <form onSubmit={handleSubmit} className="solve-form" noValidate>
                <div className="solve-form-header">
                  <span className="solve-form-label">Submit Answer</span>
                  <span className="solve-form-hint">Ctrl+Enter to submit</span>
                </div>

                {/* Wrong answer feedback */}
                {result?.correct === false && (
                  <div className="solve-wrong-feedback">
                    <span className="solve-wrong-icon">✗</span>
                    <div>
                      <span className="solve-wrong-text">Incorrect answer</span>
                      <span className="solve-wrong-elo">{result.eloChange} ELO</span>
                    </div>
                    <span className="solve-attempts-left">
                      {5 - result.attemptsInWindow} attempts left
                    </span>
                  </div>
                )}

                {/* Submit error */}
                {submitError && (
                  <div className="solve-submit-error">
                    <span>⚠</span> {submitError}
                  </div>
                )}

                {/* Answer input */}
                <div className="solve-input-group">
                  <input
                    type="text"
                    className="solve-answer-input"
                    placeholder="Enter your answer..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={submitting || rateLimitSeconds > 0}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>

                {/* Rate limit bar */}
                {rateLimitSeconds > 0 && (
                  <div className="solve-ratelimit">
                    <span className="solve-ratelimit-icon">⏳</span>
                    <span>Rate limited — try again in {rateLimitSeconds}s</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="solve-submit-btn"
                  disabled={!answer.trim() || submitting || rateLimitSeconds > 0}
                >
                  {submitting ? (
                    <span className="solve-submit-loading">
                      <span className="solve-submit-spinner" />
                      Verifying...
                    </span>
                  ) : rateLimitSeconds > 0 ? (
                    `Wait ${rateLimitSeconds}s`
                  ) : (
                    "Submit Answer →"
                  )}
                </button>

                <p className="solve-submit-note">
                  Answers are case-insensitive and whitespace is trimmed automatically.
                </p>
              </form>
            )}

            {/* ── Wrong attempts history ─────────────────────────────────── */}
            {wrongAttempts > 0 && !result?.correct && (
              <div className="solve-attempt-counter">
                <span className="solve-attempt-label">Wrong attempts:</span>
                <div className="solve-attempt-pips">
                  {Array.from({ length: Math.min(wrongAttempts, 5) }).map((_, i) => (
                    <span key={i} className="solve-attempt-pip" />
                  ))}
                </div>
                <span className="solve-attempt-elo" style={{ color: "var(--color-error)" }}>
                  −{Math.min(wrongAttempts * 2, 10)} ELO so far
                </span>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BreakdownRow({ label, value, highlight, negative }) {
  return (
    <div className="solve-breakdown-row">
      <span className="solve-breakdown-label">{label}</span>
      <span
        className="solve-breakdown-value"
        style={{
          color: negative ? "var(--color-error)"
               : highlight ? "var(--color-accent)"
               : "var(--color-text-muted)"
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="solve-loading">
      <Navbar />
      <div className="solve-loading-body">
        <div className="solve-loading-spinner" />
        <span className="solve-loading-text">Loading challenge...</span>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onBack }) {
  return (
    <div className="solve-loading">
      <Navbar />
      <div className="solve-loading-body">
        <div className="solve-error-icon">⚠</div>
        <p className="solve-error-text">{error}</p>
        <button className="solve-back-btn" onClick={onBack}>← Back to challenges</button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}