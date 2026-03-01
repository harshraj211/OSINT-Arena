/**
 * EditProfile.jsx
 * Edit username, display name, bio, gender, university, country, website.
 * Avatar: choose from 12 preset emoji avatars OR upload a photo.
 * File location: frontend/src/pages/EditProfile.jsx
 */
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc, updateDoc, query, collection, where, getDocs, limit, setDoc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { uploadToCloudinary } from "../lib/cloudinary";
import { useAuth } from "../context/AuthContext";
import PageWrapper from "../components/layout/PageWrapper";
import "./EditProfile.css";

const PRESET_AVATARS = [
  { id: "spy",     emoji: "🕵️", label: "Spy",     bg: "#0d1a0d", glow: "#00ff88" },
  { id: "ghost",   emoji: "👻", label: "Ghost",   bg: "#0d0d1a", glow: "#00bfff" },
  { id: "wolf",    emoji: "🐺", label: "Wolf",    bg: "#1a0d0d", glow: "#ff4d4d" },
  { id: "robot",   emoji: "🤖", label: "Robot",   bg: "#0d1a1a", glow: "#00bfff" },
  { id: "alien",   emoji: "👽", label: "Alien",   bg: "#0a1a0a", glow: "#00ff88" },
  { id: "ninja",   emoji: "🥷", label: "Ninja",   bg: "#111111", glow: "#9b59b6" },
  { id: "dragon",  emoji: "🐉", label: "Dragon",  bg: "#1a0e00", glow: "#f59e0b" },
  { id: "falcon",  emoji: "🦅", label: "Falcon",  bg: "#150a0a", glow: "#ff4d4d" },
  { id: "owl",     emoji: "🦉", label: "Owl",     bg: "#1a1a00", glow: "#f59e0b" },
  { id: "shark",   emoji: "🦈", label: "Shark",   bg: "#001526", glow: "#00bfff" },
  { id: "fox",     emoji: "🦊", label: "Fox",     bg: "#1a0a00", glow: "#f97316" },
  { id: "panther", emoji: "🐆", label: "Panther", bg: "#150010", glow: "#9b59b6" },
];

const GENDERS   = ["", "Male", "Female", "Non-binary", "Prefer not to say"];
const COUNTRIES = ["India", "United States", "United Kingdom", "Germany", "France",
                   "Canada", "Australia", "Singapore", "Japan", "Brazil", "Other"];

export default function EditProfile() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username:    userProfile?.username    || "",
    displayName: userProfile?.displayName || "",
    bio:         userProfile?.bio         || "",
    gender:      userProfile?.gender      || "",
    university:  userProfile?.university  || "",
    country:     userProfile?.country     || "",
    website:     userProfile?.website     || "",
  });

  const [avatarTab,      setAvatarTab]      = useState("preset");
  const [selectedPreset, setSelectedPreset] = useState(userProfile?.presetAvatar || "spy");
  const [uploadPreview,  setUploadPreview]  = useState(null);
  const [uploadFile,     setUploadFile]     = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const [success,        setSuccess]        = useState(false);
  const [usernameErr,    setUsernameErr]    = useState("");

  const fileRef = useRef();

  function set(field, val) {
    setForm(p => ({ ...p, [field]: val }));
    if (field === "username") setUsernameErr("");
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("Image must be under 3MB."); return; }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = ev => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
    setAvatarTab("upload");
  }

  async function checkUsernameAvailable(username) {
    if (username === userProfile?.username) return true;
    const q    = query(collection(db, "users"), where("username", "==", username), limit(1));
    const snap = await getDocs(q);
    return snap.empty;
  }

  async function handleSave() {
    setError(""); setSaving(true);
    const uname = form.username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      setUsernameErr("3–20 chars. Lowercase letters, numbers, underscores only.");
      setSaving(false); return;
    }
    const available = await checkUsernameAvailable(uname);
    if (!available) { setUsernameErr("Username already taken."); setSaving(false); return; }

    try {
      let photoURL = userProfile?.photoURL || "";

      if (avatarTab === "upload" && uploadFile) {
        const { url } = await uploadToCloudinary(uploadFile, {
          folder: "osint-arena/avatars",
        });
        photoURL = url;
      } else if (avatarTab === "preset") {
        photoURL = `preset:${selectedPreset}`;
      }

      const updates = {
        username:     uname,
        displayName:  form.displayName.trim() || uname,
        bio:          form.bio.trim(),
        gender:       form.gender,
        university:   form.university.trim(),
        country:      form.country,
        website:      form.website.trim(),
        photoURL,
        presetAvatar: selectedPreset,
        updatedAt:    new Date(),
      };

      // Update main user document
      await updateDoc(doc(db, "users", currentUser.uid), updates);

      // Sync public profile (best-effort — don't block save if rules prevent it)
      try {
        await setDoc(doc(db, "publicProfiles", currentUser.uid), {
          uid:         currentUser.uid,
          username:    uname,
          displayName: updates.displayName,
          photoURL,
          elo:         userProfile?.elo         ?? 0,
          totalSolved: userProfile?.totalSolved ?? 0,
        }, { merge: true });
      } catch (syncErr) {
        console.warn("publicProfiles sync failed (non-fatal):", syncErr.message);
      }

      setSuccess(true);
      setTimeout(() => navigate("/profile"), 1400);
    } catch (err) {
      console.error("EditProfile save error:", err);
      setError(err.message || "Failed to save changes. Check console for details.");
    } finally {
      setSaving(false);
    }
  }

  const previewAvatar = PRESET_AVATARS.find(a => a.id === selectedPreset);

  return (
    <PageWrapper>
      <div className="ep-page">

        {/* Back + title */}
        <div className="ep-header">
          <button className="ep-back" onClick={() => navigate("/profile")}>
            ← Back to Profile
          </button>
          <h1 className="ep-title">Edit Profile</h1>
        </div>

        <div className="ep-body">

          {/* ── Avatar ───────────────────────────────────────────────── */}
          <div className="ep-card">
            <span className="ep-section-label">Avatar</span>

            {/* Preview */}
            <div className="ep-avatar-preview">
              {avatarTab === "upload" && uploadPreview ? (
                <img src={uploadPreview} alt="avatar" className="ep-avatar-img" />
              ) : previewAvatar ? (
                <div className="ep-avatar-emoji"
                  style={{ background: previewAvatar.bg, boxShadow: `0 0 24px ${previewAvatar.glow}44` }}>
                  {previewAvatar.emoji}
                </div>
              ) : (
                <div className="ep-avatar-initial">
                  {(form.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Mode tabs */}
            <div className="ep-avatar-tabs">
              <button
                className={`ep-avatar-tab ${avatarTab === "preset" ? "ep-avatar-tab--active" : ""}`}
                onClick={() => setAvatarTab("preset")}>
                Choose Avatar
              </button>
              <button
                className={`ep-avatar-tab ${avatarTab === "upload" ? "ep-avatar-tab--active" : ""}`}
                onClick={() => { fileRef.current?.click(); }}>
                Upload Photo
              </button>
            </div>

            <input ref={fileRef} type="file" accept="image/*"
              style={{ display: "none" }} onChange={handleFileChange} />

            {/* Preset grid */}
            {avatarTab === "preset" && (
              <div className="ep-avatar-grid">
                {PRESET_AVATARS.map(av => (
                  <button key={av.id}
                    className={`ep-avatar-btn ${selectedPreset === av.id ? "ep-avatar-btn--active" : ""}`}
                    style={{
                      background: av.bg,
                      borderColor: selectedPreset === av.id ? av.glow : "rgba(255,255,255,0.08)",
                      boxShadow: selectedPreset === av.id ? `0 0 14px ${av.glow}44` : "none",
                    }}
                    onClick={() => { setSelectedPreset(av.id); setAvatarTab("preset"); }}
                    title={av.label}>
                    <span className="ep-avatar-btn-emoji">{av.emoji}</span>
                    <span className="ep-avatar-btn-label">{av.label}</span>
                    {selectedPreset === av.id && <span className="ep-avatar-btn-check">✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Upload state */}
            {avatarTab === "upload" && (
              <div className="ep-upload-area" onClick={() => fileRef.current?.click()}>
                {uploadPreview ? (
                  <span className="ep-upload-change">Click to change photo</span>
                ) : (
                  <>
                    <span className="ep-upload-icon">📁</span>
                    <span>Click to choose a photo (max 3MB)</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Identity ─────────────────────────────────────────────── */}
          <div className="ep-card">
            <span className="ep-section-label">Identity</span>

            <div className="ep-field">
              <label className="ep-label">Username <span className="ep-required">*</span></label>
              <input className={`ep-input ${usernameErr ? "ep-input--err" : ""}`}
                value={form.username}
                onChange={e => set("username", e.target.value.toLowerCase())}
                placeholder="your_handle" maxLength={20} />
              {usernameErr
                ? <span className="ep-field-err">{usernameErr}</span>
                : <span className="ep-hint">3–20 chars · lowercase · letters, numbers, underscores</span>
              }
            </div>

            <div className="ep-field">
              <label className="ep-label">Display Name</label>
              <input className="ep-input" value={form.displayName}
                onChange={e => set("displayName", e.target.value)}
                placeholder="Name shown on your profile" maxLength={40} />
            </div>

            <div className="ep-field">
              <label className="ep-label">Bio</label>
              <textarea className="ep-textarea" value={form.bio}
                onChange={e => set("bio", e.target.value)}
                placeholder="Tell the community about yourself..." maxLength={200} rows={3} />
              <span className="ep-hint ep-hint--right">{form.bio.length}/200</span>
            </div>
          </div>

          {/* ── About ────────────────────────────────────────────────── */}
          <div className="ep-card">
            <span className="ep-section-label">About You</span>

            <div className="ep-row">
              <div className="ep-field">
                <label className="ep-label">Gender</label>
                <select className="ep-select" value={form.gender}
                  onChange={e => set("gender", e.target.value)}>
                  {GENDERS.map(g => <option key={g} value={g}>{g || "Prefer not to say"}</option>)}
                </select>
              </div>
              <div className="ep-field">
                <label className="ep-label">Country</label>
                <select className="ep-select" value={form.country}
                  onChange={e => set("country", e.target.value)}>
                  <option value="">Select country</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="ep-field">
              <label className="ep-label">University / Organization</label>
              <input className="ep-input" value={form.university}
                onChange={e => set("university", e.target.value)}
                placeholder="e.g. IIT Bombay, Google" maxLength={80} />
            </div>

            <div className="ep-field">
              <label className="ep-label">Website / LinkedIn</label>
              <input className="ep-input" value={form.website}
                onChange={e => set("website", e.target.value)}
                placeholder="https://..." type="url" maxLength={120} />
            </div>
          </div>
        </div>

        {/* ── Sticky save bar ─────────────────────────────────────────── */}
        <div className="ep-save-bar">
          {error   && <span className="ep-save-error">⚠ {error}</span>}
          {success && <span className="ep-save-success">✓ Saved! Redirecting...</span>}
          <button className="ep-cancel-btn" onClick={() => navigate("/profile")}>Cancel</button>
          <button className="ep-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}