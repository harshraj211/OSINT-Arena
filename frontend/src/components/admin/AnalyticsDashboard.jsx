import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { AdminError, AdminLoading } from "../../pages/admin/AdminDashboard";

function startOfTodayTimestamp() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function buildHistogram(values, bucketSize = 100) {
  if (!values.length) return { labels: [], counts: [] };
  const max = Math.max(...values);
  const totalBuckets = Math.max(1, Math.floor(max / bucketSize) + 1);
  const counts = Array(totalBuckets).fill(0);
  const labels = Array.from({ length: totalBuckets }, (_, index) => {
    const start = index * bucketSize;
    const end = start + bucketSize - 1;
    return `${start}-${end}`;
  });

  for (const value of values) {
    const idx = Math.floor((value || 0) / bucketSize);
    counts[Math.min(idx, totalBuckets - 1)] += 1;
  }

  return { labels, counts };
}

export const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const usersRef = collection(db, "users");
      const submissionsRef = collection(db, "submissions");
      const challengesRef = collection(db, "challenges");
      const flagsRef = collection(db, "flags");
      const today = startOfTodayTimestamp();

      const [
        totalUsersSnap,
        totalChallengesSnap,
        totalFlagsSnap,
        subsTodaySnap,
        submissionsTodayDocs,
        topEloSnap,
      ] = await Promise.all([
        getCountFromServer(usersRef),
        getCountFromServer(challengesRef),
        getCountFromServer(flagsRef),
        getCountFromServer(query(submissionsRef, where("timestamp", ">=", today))),
        getDocs(query(submissionsRef, where("timestamp", ">=", today))),
        getDocs(query(usersRef, orderBy("elo", "desc"), limit(200))),
      ]);

      const eloValues = topEloSnap.docs.map((docSnap) => docSnap.data().elo || 0);
      const histogram = buildHistogram(eloValues, 100);
      const totalToday = subsTodaySnap.data().count;
      const correctToday = submissionsTodayDocs.docs.reduce((count, docSnap) => {
        return count + (docSnap.data().isCorrect === true ? 1 : 0);
      }, 0);
      const accuracy = totalToday > 0 ? Math.round((correctToday / totalToday) * 100) : 0;

      setData({
        users: totalUsersSnap.data().count,
        challenges: totalChallengesSnap.data().count,
        flags: totalFlagsSnap.data().count,
        totalToday,
        correctToday,
        accuracy,
        histogram,
      });
    } catch (err) {
      setError(err?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  const maxBar = useMemo(() => {
    const counts = data?.histogram?.counts || [];
    return counts.length ? Math.max(...counts) : 0;
  }, [data]);

  if (loading) return <AdminLoading label="Loading analytics..." />;
  if (error) return <AdminError error={error} onRetry={loadAnalytics} />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Analytics</h1>
        <button className="admin-refresh-btn" onClick={loadAnalytics}>↻ Refresh</button>
      </div>

      <section className="admin-section">
        <h2 className="admin-section-title">Key Metrics</h2>
        <div className="admin-stats-grid admin-stats-grid--5">
          <div className="admin-stat-card"><div className="admin-stat-value">{data.users}</div><div className="admin-stat-label">Users</div></div>
          <div className="admin-stat-card"><div className="admin-stat-value">{data.challenges}</div><div className="admin-stat-label">Challenges</div></div>
          <div className="admin-stat-card"><div className="admin-stat-value">{data.totalToday}</div><div className="admin-stat-label">Submissions Today</div></div>
          <div className="admin-stat-card"><div className="admin-stat-value">{data.accuracy}%</div><div className="admin-stat-label">Accuracy Today</div></div>
          <div className="admin-stat-card"><div className="admin-stat-value">{data.flags}</div><div className="admin-stat-label">Total Flags</div></div>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">ELO Distribution (Top 200)</h2>
        <div className="admin-card" style={{ padding: 16 }}>
          {data.histogram.labels.length === 0 ? (
            <p className="admin-page-sub">No ELO data available.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {data.histogram.labels.map((label, idx) => {
                const count = data.histogram.counts[idx];
                const width = maxBar > 0 ? Math.max(3, Math.round((count / maxBar) * 100)) : 0;
                return (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "90px 1fr 40px", gap: 10, alignItems: "center" }}>
                    <span className="admin-page-sub">{label}</span>
                    <div style={{ height: 10, borderRadius: 999, background: "var(--color-surface-2)", overflow: "hidden" }}>
                      <div style={{ width: `${width}%`, height: "100%", background: "var(--color-accent)" }} />
                    </div>
                    <span className="admin-page-sub">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};