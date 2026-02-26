/**
 * Login.jsx
 * Full login page with email/password auth.
 * Redirects to previous route after login (from PrivateRoute state).
 *
 * File location: frontend/src/pages/Login.jsx
 */

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Background grid */}
      <div className="auth-bg-grid" aria-hidden="true" />

      {/* Glow orb */}
      <div className="auth-glow" aria-hidden="true" />

      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-bracket">[</span>
          <span className="auth-logo-text">OSINT ARENA</span>
          <span className="auth-logo-bracket">]</span>
        </div>

        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">
          Welcome back, analyst.
        </p>

        {/* Error */}
        {error && (
          <div className="auth-error" role="alert">
            <span className="auth-error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>

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
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">
              Password
              <Link to="/forgot-password" className="auth-label-link">
                Forgot password?
              </Link>
            </label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          </div>

          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-btn-loading">
                <span className="auth-btn-spinner" />
                Signing in...
              </span>
            ) : (
              "Sign in →"
            )}
          </button>

        </form>

        <p className="auth-footer">
          No account?{" "}
          <Link to="/register" className="auth-footer-link">
            Create one
          </Link>
        </p>

      </div>
    </div>
  );
}

// ── Firebase error code → human readable ─────────────────────────────────────
function getFirebaseError(code) {
  const map = {
    "auth/user-not-found":      "No account found with this email.",
    "auth/wrong-password":      "Incorrect password.",
    "auth/invalid-email":       "Invalid email address.",
    "auth/user-disabled":       "This account has been disabled.",
    "auth/too-many-requests":   "Too many attempts. Please wait and try again.",
    "auth/invalid-credential":  "Invalid email or password.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}