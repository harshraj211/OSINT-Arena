/**
 * SocialPanel.jsx
 * Follow / Followers / Suggested panel for Dashboard sidebar.
 * File location: frontend/src/components/social/SocialPanel.jsx
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection, query, where, getDocs, doc,
  setDoc, deleteDoc, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import "./SocialPanel.css";

export default function SocialPanel() {
  const { currentUser } = useAuth();
  const [tab,          setTab]         = useState("suggested");
  const [suggested,    setSuggested]   = useState([]);
  const [following,    setFollowing]   = useState([]);
  const [followers,    setFollowers]   = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [loading,      setLoading]     = useState(true);
  const [actionUid,    setActionUid]   = useState(null);

  useEffect(() => { if (currentUser) loadAll(); }, [currentUser]);

  async function loadAll() {
    setLoading(true);
    try { await Promise.all([loadFollowing(), loadFollowers(), loadSuggested()]); }
    finally { setLoading(false); }
  }

  async function loadFollowing() {
    const q    = query(collection(db, "follows"), where("followerId", "==", currentUser.uid), limit(50));
    const snap = await getDocs(q);
    const ids  = snap.docs.map(d => d.data().followingId);
    setFollowingIds(new Set(ids));
    setFollowing(await fetchProfiles(ids));
  }

  async function loadFollowers() {
    const q    = query(collection(db, "follows"), where("followingId", "==", currentUser.uid), limit(50));
    const snap = await getDocs(q);
    setFollowers(await fetchProfiles(snap.docs.map(d => d.data().followerId)));
  }

  async function loadSuggested() {
    const q    = query(collection(db, "publicProfiles"), orderBy("elo", "desc"), limit(15));
    const snap = await getDocs(q);
    setSuggested(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== currentUser.uid).slice(0, 8));
  }

  async function fetchProfiles(uids) {
    if (!uids.length) return [];
    // Fetch each profile doc directly by its ID (doc ID = uid)
    const { getDoc, doc: firestoreDoc } = await import("firebase/firestore");
    const results = await Promise.all(
      uids.map(async uid => {
        try {
          // Try publicProfiles first
          const snap = await getDoc(firestoreDoc(db, "publicProfiles", uid));
          if (snap.exists()) return { uid, ...snap.data() };
          // Fallback to users collection
          const snap2 = await getDoc(firestoreDoc(db, "users", uid));
          if (snap2.exists()) return { uid, ...snap2.data() };
          return null;
        } catch { return null; }
      })
    );
    return results.filter(Boolean);
  }

  async function handleFollow(uid) {
    setActionUid(uid);
    try {
      await setDoc(doc(db, "follows", `${currentUser.uid}_${uid}`), {
        followerId: currentUser.uid, followingId: uid, createdAt: serverTimestamp(),
      });
      setFollowingIds(prev => new Set([...prev, uid]));
    } finally { setActionUid(null); }
  }

  async function handleUnfollow(uid) {
    setActionUid(uid);
    try {
      await deleteDoc(doc(db, "follows", `${currentUser.uid}_${uid}`));
      setFollowingIds(prev => { const s = new Set(prev); s.delete(uid); return s; });
      setFollowing(prev => prev.filter(u => u.uid !== uid));
    } finally { setActionUid(null); }
  }

  const list = tab === "suggested" ? suggested : tab === "following" ? following : followers;

  return (
    <div className="social-panel">
      <div className="social-panel-header">
        <span className="social-panel-title">Community</span>
        <Link to="/leaderboard" className="social-panel-link">View all →</Link>
      </div>

      <div className="social-tabs">
        <button className={`social-tab ${tab==="suggested"?"social-tab--active":""}`} onClick={()=>setTab("suggested")}>Suggested</button>
        <button className={`social-tab ${tab==="following"?"social-tab--active":""}`} onClick={()=>setTab("following")}>
          Following{following.length > 0 && <span className="social-tab-count">{following.length}</span>}
        </button>
        <button className={`social-tab ${tab==="followers"?"social-tab--active":""}`} onClick={()=>setTab("followers")}>
          Followers{followers.length > 0 && <span className="social-tab-count">{followers.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="social-loading">{[...Array(4)].map((_,i)=><div key={i} className="social-skeleton"/>)}</div>
      ) : list.length === 0 ? (
        <div className="social-empty">
          {tab==="suggested"?"No suggestions yet.":tab==="following"?"Not following anyone yet.":"No followers yet."}
        </div>
      ) : (
        <div className="social-list">
          {list.map(user => {
            const isFollowing  = followingIds.has(user.uid);
            const isFollowBack = tab === "followers" && !isFollowing;
            return (
              <div key={user.uid} className="social-row">
                <Link to={`/profile/${user.username}`} className="social-avatar-link">
                  <div className="social-avatar">
                    {user.photoURL && !user.photoURL.startsWith("preset:")
                      ? <img src={user.photoURL} alt={user.username} />
                      : <span>{(user.username||"?").charAt(0).toUpperCase()}</span>
                    }
                  </div>
                </Link>
                <div className="social-info">
                  <Link to={`/profile/${user.username}`} className="social-username">{user.username || "unknown"}</Link>
                  <span className="social-meta">{user.elo??0} ELO · {user.totalSolved??0} solved</span>
                </div>
                <button
                  className={`social-follow-btn${isFollowing?" social-follow-btn--following":isFollowBack?" social-follow-btn--followback":""}`}
                  onClick={()=>isFollowing?handleUnfollow(user.uid):handleFollow(user.uid)}
                  disabled={actionUid===user.uid}>
                  {actionUid===user.uid?"...":isFollowing?"Following":isFollowBack?"Follow back":"Follow"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}