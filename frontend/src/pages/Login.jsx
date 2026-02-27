/**
 * Login.jsx — v2 with Google Sign-In
 * File location: frontend/src/pages/Login.jsx
 */
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGLoading(true);
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(getFriendlyError(err.code));
      }
    } finally {
      setGLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">[ OSINT ARENA ]</div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">Welcome back, agent.</p>

        {error && <div className="auth-error">⚠ {error}</div>}

        {/* Google Sign-In */}
        <button className="auth-google-btn" onClick={handleGoogle} disabled={gLoading || loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {gLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="agent@example.com"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <input
                className="auth-input"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="auth-show-btn" onClick={() => setShowPass(p => !p)}>
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>

          <button className="auth-submit-btn" type="submit" disabled={loading || gLoading}>
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>

        <p className="auth-switch">
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}

function getFriendlyError(code) {
  const map = {
    "auth/user-not-found":      "No account found with this email.",
    "auth/wrong-password":      "Incorrect password.",
    "auth/invalid-credential":  "Invalid email or password.",
    "auth/too-many-requests":   "Too many attempts. Please try again later.",
    "auth/user-disabled":       "This account has been disabled.",
    "auth/invalid-email":       "Please enter a valid email address.",
  };
  return map[code] || "Something went wrong. Please try again.";
}