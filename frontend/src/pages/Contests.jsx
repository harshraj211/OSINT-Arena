/**
 * Contests.jsx
 * Contest listing page — shows upcoming, live, and past contests.
 * Pro users can register; free users see an upgrade prompt.
 *
 * File location: frontend/src/pages/Contests.jsx
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection, query, where, orderBy, limit,
  getDocs, doc, getDoc
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import PageWrapper from "../components/layout/PageWrapper";
import "./Contests.css";

const functions          = getFunctions();
const registerFn         = httpsCallable(functions, "registerForContest");

const DIFF_CONFIG = {
  easy:   { label: "Easy",   color: "var(--color-easy)",   bg: "rgba(0,255,136,0.08)"  },
  medium: { label: "Medium", color: "var(--color-medium)", bg: "rgba(255,149,0,0.08)"  },
  hard:   { label: "Hard",   color: "var(--color-hard)",   bg: "rgba(255,77,77,0.08)"  },
  mixed:  { label: "Mixed",  color: "var(--color-blue)",   bg: "rgba(0,191,255,0.08)"  },
};

export default function Contests() {
  const { currentUser, isPro } = useAuth();
  const navigate = useNavigate();

  const [contests, setContests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("upcoming"); // upcoming | live | past
  const [registering, setRegistering]   = useState(null); // contestId being registered
  const [registered, setRegistered]     = useState(new Set()); // contestIds user is in
  const [regError, setRegError]         = useState("");
  const [regSuccess, setRegSuccess]     = useState("");

  useEffect(() => {
    loadContests();
  }, [tab]);

  useEffect(() => {
    if (currentUser) loadMyRegistrations();
  }, [currentUser]);

  async function loadContests() {
    setLoading(true);
    try {
      const now = new Date();
      let q;

      if (tab === "live") {
        q = query(
          collection(db, "contests"),
          where("isActive",  "==", true),
          where("startTime", "<=", now),
          where("endTime",   ">",  now),
          orderBy("startTime", "desc"),
          limit(10)
        );
      } else if (tab === "upcoming") {
        q = query(
          collection(db, "contests"),
          where("isActive",  "==", true),
          where("startTime", ">",  now),
          orderBy("startTime", "asc"),
          limit(10)
        );
      } else {
        q = query(
          collection(db, "contests"),
          where("finalized", "==", true),
          orderBy("endTime", "desc"),
          limit(20)
        );
      }

      const snap = await getDocs(q);
      setContests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("loadContests:", err);
      setContests([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyRegistrations() {
    try {
      // Check which contests the user is registered for
      // We'll check the last 20 active/upcoming contests
      const snap = await getDocs(
        query(collection(db, "contests"), where("isActive", "==", true), limit(20))
      );
      const ids = new Set();
      await Promise.all(snap.docs.map(async (contestDoc) => {
        const partSnap = await getDoc(
          doc(db, "contests", contestDoc.id, "participants", currentUser.uid)
        );
        if (partSnap.exists()) ids.add(contestDoc.id);
      }));
      setRegistered(ids);
    } catch {}
  }

  async function handleRegister(contestId) {
    if (!currentUser) { navigate("/login"); return; }
    if (!isPro) { navigate("/pricing", { state: { reason: "pro_required" } }); return; }

    setRegistering(contestId);
    setRegError("");
    setRegSuccess("");
    try {
      const res = await registerFn({ contestId });
      setRegistered(prev => new Set([...prev, contestId]));
      setRegSuccess(`Registered for "${res.data.title}"! Contest starts ${formatRelativeTime(new Date(res.data.startTime))}.`);
    } catch (err) {
      setRegError(err.message || "Registration failed.");
    } finally {
      setRegistering(null);
    }
  }

  const liveCount = contests.filter(c => {
    const now = Date.now();
    return c.startTime?.toMillis?.() <= now && c.endTime?.toMillis?.() > now;
  }).length;

  return (
    <PageWrapper>
      <div className="contests-page">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="contests-header">
          <div className="contests-header-text">
            <h1 className="contests-title">Contests</h1>
            <p className="contests-subtitle">
              Timed OSINT competitions with ELO rewards.
              {!isPro && (
                <span className="contests-pro-note">
                  {" "}
                  <Link to="/pricing" className="contests-upgrade-link">
                    Pro required →
                  </Link>
                </span>
              )}
            </p>
          </div>

          {liveCount > 0 && (
            <div className="contests-live-badge">
              <span className="contests-live-dot" />
              {liveCount} Live Now
            </div>
          )}
        </div>

        {/* ── Feedback banners ────────────────────────────────────────── */}
        {regSuccess && (
          <div className="contests-feedback contests-feedback--ok">
            ✓ {regSuccess}
          </div>
        )}
        {regError && (
          <div className="contests-feedback contests-feedback--err">
            ⚠ {regError}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="contests-tabs">
          {[
            { key: "upcoming", label: "Upcoming" },
            { key: "live",     label: "Live" },
            { key: "past",     label: "Past" },
          ].map(t => (
            <button
              key={t.key}
              className={`contests-tab ${tab === t.key ? "contests-tab--active" : ""}`}
              onClick={() => { setTab(t.key); setRegError(""); setRegSuccess(""); }}
            >
              {t.key === "live" && liveCount > 0 && (
                <span className="contests-tab-live-dot" />
              )}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Contest list ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="contests-skeleton">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="contests-skeleton-card" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : contests.length === 0 ? (
          <div className="contests-empty">
            <span className="contests-empty-icon">⬡</span>
            <p>No {tab} contests right now.</p>
            {tab === "upcoming" && (
              <p className="contests-empty-sub">Check back soon — contests are added regularly.</p>
            )}
          </div>
        ) : (
          <div className="contests-list">
            {contests.map((contest, idx) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                idx={idx}
                tab={tab}
                isPro={isPro}
                isRegistered={registered.has(contest.id)}
                isRegistering={registering === contest.id}
                onRegister={() => handleRegister(contest.id)}
                onEnter={() => navigate(`/contests/${contest.id}`)}
              />
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  );
}

// ── ContestCard ───────────────────────────────────────────────────────────────

function ContestCard({ contest, idx, tab, isPro, isRegistered, isRegistering, onRegister, onEnter }) {
  const diff    = DIFF_CONFIG[contest.difficulty] || DIFF_CONFIG.mixed;
  const now     = Date.now();
  const startMs = contest.startTime?.toMillis?.() ?? 0;
  const endMs   = contest.endTime?.toMillis?.() ?? 0;
  const isLive  = now >= startMs && now < endMs;
  const regDeadlineMs = contest.registrationDeadline?.toMillis?.() ?? startMs;
  const regOpen = now < regDeadlineMs && now < startMs;

  return (
    <div
      className={`contest-card ${isLive ? "contest-card--live" : ""}`}
      style={{ animationDelay: `${idx * 0.06}s` }}
    >
      {isLive && (
        <div className="contest-card-live-bar">
          <span className="contest-card-live-dot" />
          LIVE
        </div>
      )}

      <div className="contest-card-body">
        {/* Left: info */}
        <div className="contest-card-info">
          <div className="contest-card-meta-row">
            <span
              className="contest-diff-chip"
              style={{ color: diff.color, background: diff.bg }}
            >
              {diff.label}
            </span>
            <span className="contest-card-challenges">
              {contest.challengeIds?.length ?? "?"} challenges
            </span>
            {contest.maxParticipants && (
              <span className="contest-card-capacity">
                {contest.participantCount ?? 0}/{contest.maxParticipants} joined
              </span>
            )}
          </div>

          <h2 className="contest-card-title">{contest.title}</h2>

          {contest.description && (
            <p className="contest-card-desc">{contest.description}</p>
          )}

          <div className="contest-card-times">
            {isLive ? (
              <ContestCountdown endMs={endMs} label="Ends in" />
            ) : tab === "upcoming" ? (
              <ContestCountdown endMs={startMs} label="Starts in" />
            ) : (
              <span className="contest-card-time-ended">
                Ended {formatRelativeTime(new Date(endMs))}
              </span>
            )}
          </div>
        </div>

        {/* Right: ELO awards + action */}
        <div className="contest-card-right">
          <div className="contest-elo-awards">
            <div className="contest-elo-award">
              <span className="contest-elo-medal">🥇</span>
              <span className="contest-elo-value">+{Math.round(150 * (DIFF_MULT[contest.difficulty] || 1.25))}</span>
            </div>
            <div className="contest-elo-award">
              <span className="contest-elo-medal">🥈</span>
              <span className="contest-elo-value">+{Math.round(100 * (DIFF_MULT[contest.difficulty] || 1.25))}</span>
            </div>
            <div className="contest-elo-award">
              <span className="contest-elo-medal">🥉</span>
              <span className="contest-elo-value">+{Math.round(75 * (DIFF_MULT[contest.difficulty] || 1.25))}</span>
            </div>
          </div>

          {/* Action button */}
          {tab === "past" ? (
            <button className="contest-action-btn contest-action-btn--ghost" onClick={onEnter}>
              View Results →
            </button>
          ) : isLive && isRegistered ? (
            <button className="contest-action-btn contest-action-btn--enter" onClick={onEnter}>
              Enter Contest →
            </button>
          ) : isLive && !isRegistered ? (
            <div className="contest-action-locked">
              Registration closed
            </div>
          ) : isRegistered ? (
            <div className="contest-action-registered">
              <span>✓</span> Registered
            </div>
          ) : !isPro ? (
            <Link to="/pricing" className="contest-action-btn contest-action-btn--upgrade">
              Pro Required ↗
            </Link>
          ) : regOpen ? (
            <button
              className="contest-action-btn contest-action-btn--register"
              onClick={onRegister}
              disabled={isRegistering}
            >
              {isRegistering ? "Registering..." : "Register →"}
            </button>
          ) : (
            <div className="contest-action-locked">
              Registration closed
            </div>
          )}
        </div>
      </div>

      {/* Past contest — top 3 */}
      {tab === "past" && contest.finalRankings?.length > 0 && (
        <div className="contest-card-podium">
          {contest.finalRankings.slice(0, 3).map((r, i) => (
            <div key={i} className="contest-podium-entry">
              <span className="contest-podium-medal">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </span>
              <Link to={`/profile/${r.username}`} className="contest-podium-name">
                {r.username}
              </Link>
              <span className="contest-podium-score">{r.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function ContestCountdown({ endMs, label }) {
  const [remaining, setRemaining] = useState(Math.max(0, endMs - Date.now()));

  useEffect(() => {
    const t = setInterval(() => {
      const r = Math.max(0, endMs - Date.now());
      setRemaining(r);
      if (r === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [endMs]);

  const totalSecs = Math.floor(remaining / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  return (
    <div className="contest-countdown">
      <span className="contest-countdown-label">{label}</span>
      <span className="contest-countdown-value">
        {d > 0 && `${d}d `}
        {(d > 0 || h > 0) && `${h}h `}
        {(d > 0 || h > 0 || m > 0) && `${pad(m)}m `}
        {pad(s)}s
      </span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const DIFF_MULT = { easy: 1.0, medium: 1.5, hard: 2.0, mixed: 1.25 };

function pad(n) { return String(n).padStart(2, "0"); }

function formatRelativeTime(date) {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(Math.abs(diff) / 60000);
  const h = Math.floor(Math.abs(diff) / 3600000);
  const d = Math.floor(Math.abs(diff) / 86400000);
  if (d > 0)  return `${d}d ago`;
  if (h > 0)  return `${h}h ago`;
  return `${m}m ago`;
}