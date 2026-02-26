/**
 * VerifyEmail.jsx
 * Shown after registration and when unverified users try to access protected routes.
 * Polls for verification and auto-redirects when confirmed.
 *
 * File location: frontend/src/pages/VerifyEmail.jsx
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

const RESEND_COOLDOWN = 60; // seconds
const POLL_INTERVAL  = 3000; // ms — check verification status every 3s

export default function VerifyEmail() {
  const { currentUser, resendVerification, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus]     = useState(""); // "sent" | "error"
  const [checking, setChecking]             = useState(false);
  const pollRef = useRef(null);

  // ── Poll for email verification ───────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    // Already verified — skip straight to dashboard
    if (currentUser.emailVerified) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // Start polling
    pollRef.current = setInterval(async () => {
      try {
        await refreshUser();
        if (currentUser.emailVerified) {
          clearInterval(pollRef.current);
          navigate("/dashboard", { replace: true });
        }
      } catch {
        // Silently ignore poll errors
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollRef.current);
  }, [currentUser, navigate, refreshUser]);

  // ── Resend cooldown timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResendStatus("");
    try {
      await resendVerification();
      setResendStatus("sent");
      setResendCooldown(RESEND_COOLDOWN);
    } catch {
      setResendStatus("error");
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    try {
      await refreshUser();
      if (currentUser?.emailVerified) {
        navigate("/dashboard", { replace: true });
      }
    } catch {
      // Ignore
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const email = currentUser?.email || "your email";

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow--green" aria-hidden="true" />

      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-bracket">[</span>
          <span className="auth-logo-text">OSINT ARENA</span>
          <span className="auth-logo-bracket">]</span>
        </div>

        {/* Icon */}
        <div className="auth-verify-icon" aria-hidden="true">✉</div>

        <h1 className="auth-title">Verify your email</h1>
        <p className="auth-subtitle">
          We sent a verification link to
        </p>
        <p className="auth-verify-email">{email}</p>

        <p className="auth-verify-instruction">
          Click the link in that email to activate your account.
          This page will automatically redirect once verified.
        </p>

        {/* Status messages */}
        {resendStatus === "sent" && (
          <div className="auth-success" role="status">
            ✓ Verification email resent. Check your inbox.
          </div>
        )}
        {resendStatus === "error" && (
          <div className="auth-error" role="alert">
            <span className="auth-error-icon">⚠</span>
            Failed to resend. Please try again.
          </div>
        )}

        {/* Actions */}
        <div className="auth-verify-actions">
          <button
            className="auth-btn"
            onClick={handleCheckNow}
            disabled={checking}
          >
            {checking ? (
              <span className="auth-btn-loading">
                <span className="auth-btn-spinner" />
                Checking...
              </span>
            ) : (
              "I've verified →"
            )}
          </button>

          <button
            className="auth-btn-ghost"
            onClick={handleResend}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend email"
            }
          </button>
        </div>

        {/* Polling indicator */}
        <p className="auth-verify-polling">
          <span className="auth-polling-dot" aria-hidden="true" />
          Checking automatically every few seconds...
        </p>

        <button
          className="auth-link-btn"
          onClick={handleLogout}
        >
          Sign out and use a different account
        </button>

      </div>
    </div>
  );
}