/**
 * Challenges.jsx
 * Challenge list page with filtering, search, and solved status.
 *
 * File location: frontend/src/pages/Challenges.jsx
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection, query, where, orderBy,
  limit, startAfter, getDocs, getDoc, doc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import PageWrapper from "../components/layout/PageWrapper";
import "./Challenges.css";

const PAGE_SIZE = 20;

const DIFFICULTIES = ["all", "easy", "medium", "hard"];
const SORT_OPTIONS = [
  { value: "newest",    label: "Newest" },
  { value: "popular",   label: "Most Solved" },
  { value: "hardest",   label: "Hardest First" },
  { value: "easiest",   label: "Easiest First" },
];

const DIFF_CONFIG = {
  easy:   { label: "Easy",   color: "var(--color-easy)",   bg: "rgba(0,255,136,0.08)" },
  medium: { label: "Medium", color: "var(--color-medium)", bg: "rgba(255,149,0,0.08)" },
  hard:   { label: "Hard",   color: "var(--color-hard)",   bg: "rgba(255,77,77,0.08)" },
};

/**
 * Determines whether a challenge is locked for a free user.
 *
 * Rules:
 *  - Easy:           always free
 *  - Medium:         free if challenge.freeForAll === true OR challengeIndex < 30% of total
 *                    (backend marks the free 30% via challenge.freeForAll flag)
 *  - Hard:           locked UNLESS challenge.weeklyFreeId matches the current
 *                    week's free hard challenge (set by a weekly Cloud Function)
 *  - Pro users:      nothing is locked
 */
function isChallengeLocked(challenge, isPro, weeklyFreeHardId) {
  if (isPro) return false;
  if (challenge.difficulty === "easy") return false;
  if (challenge.difficulty === "medium") return !challenge.freeForAll;
  if (challenge.difficulty === "hard") return challenge.id !== weeklyFreeHardId;
  return false;
}

export default function Challenges() {
  const { currentUser, canSolveToday, isPro, dailySolvesRemaining } = useAuth();
  const navigate = useNavigate();

  const [challenges, setChallenges]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const [lastDoc, setLastDoc]           = useState(null);

  const [search, setSearch]             = useState("");
  const [difficulty, setDifficulty]     = useState("all");
  const [sortBy, setSortBy]             = useState("newest");

  const [solvedIds, setSolvedIds]       = useState(new Set());
  const [solvedLoading, setSolvedLoading] = useState(true);

  // Weekly free hard challenge ID (set by a scheduled Cloud Function each Monday)
  const [weeklyFreeHardId, setWeeklyFreeHardId] = useState(null);

  // Load weekly free hard challenge
  useEffect(() => {
    async function loadWeeklyFree() {
      try {
        const snap = await getDoc(doc(db, "config", "weeklyFreeChallenge"));
        if (snap.exists()) setWeeklyFreeHardId(snap.data().challengeId || null);
      } catch {}
    }
    loadWeeklyFree();
  }, []);

  // Load user's solved challenges
  useEffect(() => {
    if (!currentUser) return;
    loadSolvedIds();
  }, [currentUser]);

  async function loadSolvedIds() {
    setSolvedLoading(true);
    try {
      const q = query(
        collection(db, "submissions"),
        where("userId", "==", currentUser.uid),
        where("isCorrect", "==", true)
      );
      const snap = await getDocs(q);
      const ids = new Set(snap.docs.map(d => d.data().challengeId));
      setSolvedIds(ids);
    } catch {}
    setSolvedLoading(false);
  }

  // Load challenges when filters change
  useEffect(() => {
    setChallenges([]);
    setLastDoc(null);
    setHasMore(true);
    loadChallenges(true);
  }, [difficulty, sortBy]);

  async function loadChallenges(fresh = false) {
    if (fresh) setLoading(true);
    else setLoadingMore(true);

    try {
      let q = query(
        collection(db, "challenges"),
        where("isActive", "==", true)
      );

      // Difficulty filter
      if (difficulty !== "all") {
        q = query(q, where("difficulty", "==", difficulty));
      }

      // Sort
      switch (sortBy) {
        case "popular":
          q = query(q, orderBy("solveCount", "desc"));
          break;
        case "hardest":
          q = query(q, where("difficulty", "==", "hard"), orderBy("solveCount", "asc"));
          break;
        case "easiest":
          q = query(q, where("difficulty", "==", "easy"), orderBy("solveCount", "desc"));
          break;
        default:
          q = query(q, orderBy("createdAt", "desc"));
      }

      q = query(q, limit(PAGE_SIZE));
      if (!fresh && lastDoc) q = query(q, startAfter(lastDoc));

      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setChallenges(prev => fresh ? items : [...prev, ...items]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("loadChallenges:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Client-side search filter
  const filteredChallenges = challenges.filter(c =>
    search.trim() === "" ||
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalSolved = solvedIds.size;

  return (
    <PageWrapper>
      <div className="challenges-page">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="challenges-header">
          <div>
            <h1 className="challenges-title">Challenges</h1>
            <p className="challenges-subtitle">
              {solvedLoading ? "..." : `${totalSolved} solved`}
              {!isPro && (
                <span className="challenges-limit-note">
                  {" · Easy + 30% medium free · "}
                  <Link to="/pricing" className="challenges-upgrade-link">
                    Unlock all →
                  </Link>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="challenges-filters">
          {/* Search */}
          <div className="challenges-search-wrap">
            <span className="challenges-search-icon">⌕</span>
            <input
              type="text"
              className="challenges-search"
              placeholder="Search challenges..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="challenges-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >×</button>
            )}
          </div>

          {/* Difficulty tabs */}
          <div className="challenges-diff-tabs">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                className={`challenges-diff-tab ${difficulty === d ? "challenges-diff-tab--active" : ""}`}
                onClick={() => setDifficulty(d)}
                style={difficulty === d && d !== "all" ? {
                  color: DIFF_CONFIG[d]?.color,
                  borderColor: DIFF_CONFIG[d]?.color,
                  background: DIFF_CONFIG[d]?.bg,
                } : {}}
              >
                {d === "all" ? "All" : DIFF_CONFIG[d].label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            className="challenges-sort"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ── Stats bar ───────────────────────────────────────────────── */}
        <div className="challenges-stats-bar">
          {["easy", "medium", "hard"].map(d => (
            <div key={d} className="challenges-stats-item">
              <span
                className="challenges-stats-dot"
                style={{ background: DIFF_CONFIG[d].color }}
              />
              <span className="challenges-stats-label">{DIFF_CONFIG[d].label}</span>
              <span className="challenges-stats-count" style={{ color: DIFF_CONFIG[d].color }}>
                {solvedIds
                  ? challenges.filter(c => c.difficulty === d && solvedIds.has(c.id)).length
                  : 0
                }
                <span className="challenges-stats-total">
                  /{challenges.filter(c => c.difficulty === d).length}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* ── Challenge table ──────────────────────────────────────────── */}
        {loading ? (
          <div className="challenges-skeleton">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="challenges-skeleton-row" style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="challenges-empty">
            <span className="challenges-empty-icon">◈</span>
            <p>No challenges found.</p>
            {search && (
              <button className="challenges-empty-clear" onClick={() => setSearch("")}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="challenges-table">
              {/* Header */}
              <div className="challenges-table-header">
                <span className="challenges-col-status" />
                <span className="challenges-col-title">Title</span>
                <span className="challenges-col-diff">Difficulty</span>
                <span className="challenges-col-elo">ELO</span>
                <span className="challenges-col-solvers">Solvers</span>
                <span className="challenges-col-time">Exp. Time</span>
              </div>

              {/* Rows */}
              {filteredChallenges.map((challenge, idx) => {
                const solved  = solvedIds.has(challenge.id);
                const locked  = isChallengeLocked(challenge, isPro, weeklyFreeHardId);
                const diff    = DIFF_CONFIG[challenge.difficulty] || DIFF_CONFIG.easy;
                const isWeeklyFree = challenge.id === weeklyFreeHardId && challenge.difficulty === "hard";

                return (
                  <div
                    key={challenge.id}
                    className={[
                      "challenges-row",
                      solved  ? "challenges-row--solved"  : "",
                      locked  ? "challenges-row--locked"  : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => locked
                      ? navigate("/pricing", { state: { reason: "pro_required" } })
                      : navigate(`/challenges/${challenge.slug}`)
                    }
                    style={{ animationDelay: `${idx * 0.03}s` }}
                  >
                    {/* Solved / locked status */}
                    <span className="challenges-col-status">
                      {locked ? (
                        <span className="challenges-lock-icon">⚿</span>
                      ) : solved ? (
                        <span className="challenges-solved-check">✓</span>
                      ) : (
                        <span className="challenges-unsolved-dot" />
                      )}
                    </span>

                    {/* Title */}
                    <span className="challenges-col-title">
                      <span className={`challenges-row-title ${locked ? "challenges-row-title--blur" : ""}`}>
                        {challenge.title}
                      </span>
                      {solved && !locked && (
                        <span className="challenges-solved-label">Solved</span>
                      )}
                      {isWeeklyFree && (
                        <span className="challenges-weekly-free-chip">Free this week</span>
                      )}
                      {locked && (
                        <span className="challenges-pro-chip">PRO</span>
                      )}
                    </span>

                    {/* Difficulty */}
                    <span className="challenges-col-diff">
                      <span
                        className="challenges-diff-chip"
                        style={{ color: diff.color, background: diff.bg }}
                      >
                        {diff.label}
                      </span>
                    </span>

                    {/* ELO */}
                    <span className="challenges-col-elo">
                      <span className="challenges-elo-value">+{challenge.basePoints}</span>
                    </span>

                    {/* Solvers */}
                    <span className="challenges-col-solvers challenges-muted">
                      {(challenge.solveCount || 0).toLocaleString()}
                    </span>

                    {/* Expected time */}
                    <span className="challenges-col-time challenges-muted">
                      {formatTime(challenge.expectedTime)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="challenges-load-more">
                <button
                  className="challenges-load-more-btn"
                  onClick={() => loadChallenges(false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s > 0 ? s + "s" : ""}`.trim() : `${s}s`;
}