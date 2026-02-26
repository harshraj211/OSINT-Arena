/**
 * Register.jsx
 * Full registration page.
 * Creates account, sends verification email, redirects to /verify-email.
 *
 * File location: frontend/src/pages/Register.jsx
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

// Username rules: 3-20 chars, alphanumeric + underscores only
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Live password strength
  const strength = getPasswordStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!username.trim()) {
      setError("Username is required."); return;
    }
    if (!USERNAME_REGEX.test(username.trim())) {
      setError("Username must be 3–20 characters: letters, numbers, underscores only."); return;
    }
    if (!email.trim()) {
      setError("Email is required."); return;
    }
    if (!password) {
      setError("Password is required."); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (password !== confirm) {
      setError("Passwords do not match."); return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      // Note: username is stored after account creation via onUserCreated Cloud Function
      // For now store in localStorage to pass to the profile setup flow
      localStorage.setItem("pendingUsername", username.trim());
      navigate("/verify-email", { replace: true });
    } catch (err) {
      setError(getFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow--blue" aria-hidden="true" />

      <div className="auth-card auth-card--wide">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-bracket">[</span>
          <span className="auth-logo-text">OSINT ARENA</span>
          <span className="auth-logo-bracket">]</span>
        </div>

        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">
          Join the intelligence community.
        </p>

        {error && (
          <div className="auth-error" role="alert">
            <span className="auth-error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>

          {/* Username */}
          <div className="auth-field">
            <label htmlFor="username" className="auth-label">Username</label>
            <input
              id="username"
              type="text"
              className="auth-input"
              placeholder="analyst_zero"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={loading}
              maxLength={20}
            />
            <span className="auth-field-hint">
              3–20 chars · letters, numbers, underscores
            </span>
          </div>

          {/* Email */}
          <div className="auth-field">
            <label htmlFor="email" className="auth-label">Email</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <label htmlFor="password" className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                className="auth-input"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                className="auth-input-toggle"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>

            {/* Password strength bar */}
            {password.length > 0 && (
              <div className="auth-strength">
                <div className="auth-strength-bar">
                  <div
                    className={`auth-strength-fill auth-strength-fill--${strength.level}`}
                    style={{ width: `${(strength.score / 4) * 100}%` }}
                  />
                </div>
                <span className={`auth-strength-label auth-strength-label--${strength.level}`}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="auth-field">
            <label htmlFor="confirm" className="auth-label">Confirm password</label>
            <input
              id="confirm"
              type={showPass ? "text" : "password"}
              className={`auth-input ${confirm && confirm !== password ? "auth-input--error" : ""} ${confirm && confirm === password && confirm.length > 0 ? "auth-input--success" : ""}`}
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-btn-loading">
                <span className="auth-btn-spinner" />
                Creating account...
              </span>
            ) : (
              "Create account →"
            )}
          </button>

          <p className="auth-terms">
            By registering you agree to our{" "}
            <a href="/terms" className="auth-footer-link">Terms</a>
            {" "}and{" "}
            <a href="/privacy" className="auth-footer-link">Privacy Policy</a>.
          </p>

        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-footer-link">Sign in</Link>
        </p>

      </div>
    </div>
  );
}

// ── Password strength scorer ──────────────────────────────────────────────────
function getPasswordStrength(password) {
  if (!password) return { score: 0, level: "empty", label: "" };

  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Cap at 4
  score = Math.min(score, 4);

  const levels = [
    { level: "weak",   label: "Weak" },
    { level: "weak",   label: "Weak" },
    { level: "fair",   label: "Fair" },
    { level: "good",   label: "Good" },
    { level: "strong", label: "Strong" },
  ];

  return { score, ...levels[score] };
}

// ── Firebase error map ────────────────────────────────────────────────────────
function getFirebaseError(code) {
  const map = {
    "auth/email-already-in-use":   "An account with this email already exists.",
    "auth/invalid-email":          "Invalid email address.",
    "auth/weak-password":          "Password is too weak. Use at least 8 characters.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/too-many-requests":      "Too many attempts. Please wait and try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}