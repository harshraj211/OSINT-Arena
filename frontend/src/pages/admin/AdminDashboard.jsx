/**
 * AdminDashboard.jsx
 * Main admin overview. Calls getAnalytics Cloud Function.
 * Shows: user stats, challenge stats, submission stats, ELO histogram, flags.
 *
 * File location: frontend/src/pages/admin/AdminDashboard.jsx
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import "./Admin.css";

const functions = getFunctions();
const getAnalyticsFn = httpsCallable(functions, "getAnalytics");

export default function AdminDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => { loadAnalytics(); }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const res = await getAnalyticsFn();
      setData(res.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <AdminLoading label="Loading analytics..." />;
  if (error)   return <AdminError error={error} onRetry={loadAnalytics} />;
  if (!data)   return null;

  const { users, challenges, submissions, elo, flags } = data;

  return (
    <div className="admin-page">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          {lastRefresh && (
            <p className="admin-page-sub">
              Last updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button className="admin-refresh-btn" onClick={loadAnalytics}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Flags alert ─────────────────────────────────────────────── */}
      {flags?.totalUnresolved > 0 && (
        <Link to="/admin/flags" className="admin-flags-alert">
          <span className="admin-flags-alert-icon">⚑</span>
          <span>{flags.totalUnresolved} unresolved flag{flags.totalUnresolved !== 1 ? "s" : ""} need attention</span>
          <span className="admin-flags-alert-arrow">→</span>
        </Link>
      )}

      {/* ── User stats ──────────────────────────────────────────────── */}
      <section className="admin-section">
        <h2 className="admin-section-title">Users</h2>
        <div className="admin-stats-grid admin-stats-grid--5">
          <AdminStat label="Total"        value={users?.total?.toLocaleString()}         />
          <AdminStat label="Active Today" value={users?.activeToday?.toLocaleString()}    accent="blue" />
          <AdminStat label="This Week"    value={users?.activeThisWeek?.toLocaleString()} />
          <AdminStat label="This Month"   value={users?.activeThisMonth?.toLocaleString()} />
          <AdminStat label="New This Week" value={`+${users?.newThisWeek?.toLocaleString()}`} accent="accent" />
        </div>
      </section>

      {/* ── Submission stats ─────────────────────────────────────────── */}
      <section className="admin-section">
        <h2 className="admin-section-title">Today's Submissions</h2>
        <div className="admin-stats-grid admin-stats-grid--3">
          <AdminStat label="Total"    value={submissions?.totalToday?.toLocaleString()} />
          <AdminStat label="Correct"  value={submissions?.correctToday?.toLocaleString()} accent="accent" />
          <AdminStat
            label="Accuracy"
            value={`${submissions?.accuracyToday ?? 0}%`}
            accent={submissions?.accuracyToday >= 50 ? "accent" : "warning"}
          />
        </div>
      </section>

      {/* ── Challenges + ELO ────────────────────────────────────────── */}
      <div className="admin-two-col">

        {/* Challenge stats */}
        <section className="admin-card">
          <h2 className="admin-card-title">Challenges</h2>
          <div className="admin-kv-list">
            <AdminKV label="Total Active"    value={challenges?.total} />
            <AdminKV label="Most Solved"     value={challenges?.mostSolved?.title || "—"} mono={false} />
            <AdminKV label="Hardest"         value={challenges?.hardest?.title || "—"} mono={false} />
          </div>

          {challenges?.avgSolveTime && (
            <>
              <div className="admin-divider" />
              <h3 className="admin-subsection-title">Avg Solve Time</h3>
              <div className="admin-kv-list">
                {Object.entries(challenges.avgSolveTime).map(([diff, secs]) => (
                  <AdminKV
                    key={diff}
                    label={diff.charAt(0).toUpperCase() + diff.slice(1)}
                    value={formatTime(secs)}
                    color={DIFF_COLORS[diff]}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* ELO histogram */}
        <section className="admin-card">
          <h2 className="admin-card-title">ELO Distribution (Top 500)</h2>
          {elo?.histogram ? (
            <EloHistogram histogram={elo.histogram} />
          ) : (
            <p className="admin-empty-note">No ELO data.</p>
          )}
        </section>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      <section className="admin-section">
        <h2 className="admin-section-title">Quick Actions</h2>
        <div className="admin-quick-actions">
          <Link to="/admin/users"      className="admin-quick-btn">Manage Users →</Link>
          <Link to="/admin/flags"      className="admin-quick-btn">Review Flags →</Link>
          <Link to="/admin/challenges" className="admin-quick-btn">Manage Challenges →</Link>
          <Link to="/admin/contests"   className="admin-quick-btn">Manage Contests →</Link>
        </div>
      </section>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EloHistogram({ histogram }) {
  const entries = Object.entries(histogram).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxVal  = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="admin-histogram">
      {entries.map(([bucket, count]) => (
        <div key={bucket} className="admin-histogram-col" title={`${bucket}–${Number(bucket)+99}: ${count} users`}>
          <div
            className="admin-histogram-bar"
            style={{ height: `${(count / maxVal) * 100}%` }}
          />
          <span className="admin-histogram-label">{bucket}</span>
        </div>
      ))}
    </div>
  );
}

function AdminStat({ label, value, accent }) {
  return (
    <div className={`admin-stat-card ${accent ? `admin-stat-card--${accent}` : ""}`}>
      <div className="admin-stat-value">{value ?? "—"}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

function AdminKV({ label, value, mono = true, color }) {
  return (
    <div className="admin-kv-row">
      <span className="admin-kv-label">{label}</span>
      <span
        className={`admin-kv-value ${mono ? "admin-kv-value--mono" : ""}`}
        style={color ? { color } : {}}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

export function AdminLoading({ label = "Loading..." }) {
  return (
    <div className="admin-loading">
      <div className="admin-loading-spinner" />
      <span>{label}</span>
    </div>
  );
}

export function AdminError({ error, onRetry }) {
  return (
    <div className="admin-error-state">
      <span className="admin-error-icon">⚠</span>
      <p>{error}</p>
      {onRetry && (
        <button className="admin-retry-btn" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(s) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

const DIFF_COLORS = {
  easy:   "var(--color-easy)",
  medium: "var(--color-medium)",
  hard:   "var(--color-hard)",
};