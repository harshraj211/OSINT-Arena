/**
 * Navbar.jsx
 * Top navigation bar — shown on all authenticated pages.
 * Responsive: collapses to hamburger on mobile.
 *
 * File location: frontend/src/components/layout/Navbar.jsx
 */

import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { currentUser, userProfile, isAdmin, isPro, logout } = useAuth();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen]         = useState(false);
  const [profileOpen, setProfileOpen]   = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    setProfileOpen(false);
    await logout();
    navigate("/login");
  }

  const elo = userProfile?.elo ?? 0;
  const username = userProfile?.username ?? currentUser?.email?.split("@")[0] ?? "Analyst";
  const avatarUrl = getGravatarUrl(currentUser?.email);

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-inner">

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <Link to="/dashboard" className="navbar-logo" aria-label="OSINT Arena home">
          <span className="navbar-logo-bracket">[</span>
          <span className="navbar-logo-text">OSINT ARENA</span>
          <span className="navbar-logo-bracket">]</span>
        </Link>

        {/* ── Desktop nav links ──────────────────────────────────────────── */}
        <div className="navbar-links" role="menubar">
          <NavLink
            to="/challenges"
            className={({ isActive }) => `navbar-link ${isActive ? "navbar-link--active" : ""}`}
          >
            Challenges
          </NavLink>

          <NavLink
            to="/leaderboard"
            className={({ isActive }) => `navbar-link ${isActive ? "navbar-link--active" : ""}`}
          >
            Leaderboard
          </NavLink>

          <NavLink
            to="/contests"
            className={({ isActive }) =>
              `navbar-link ${isActive ? "navbar-link--active" : ""} ${!isPro ? "navbar-link--locked" : ""}`
            }
          >
            Contests
            {!isPro && <span className="navbar-pro-badge">PRO</span>}
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `navbar-link navbar-link--admin ${isActive ? "navbar-link--active" : ""}`}
            >
              Admin
            </NavLink>
          )}
        </div>

        {/* ── Right side ────────────────────────────────────────────────── */}
        <div className="navbar-right">

          {/* ELO chip */}
          <div className="navbar-elo" title="Your global ELO">
            <span className="navbar-elo-icon">◆</span>
            <span className="navbar-elo-value">{elo.toLocaleString()}</span>
          </div>

          {/* Upgrade button for free users */}
          {!isPro && (
            <Link to="/pricing" className="navbar-upgrade-btn">
              Upgrade
            </Link>
          )}

          {/* Profile dropdown */}
          <div className="navbar-profile" ref={profileRef}>
            <button
              className="navbar-avatar-btn"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              aria-label="Open profile menu"
            >
              <img
                src={avatarUrl}
                alt={username}
                className="navbar-avatar"
                onError={(e) => { e.target.src = getFallbackAvatar(username); }}
              />
              <span className="navbar-username">{username}</span>
              <span className={`navbar-chevron ${profileOpen ? "navbar-chevron--open" : ""}`}>
                ▾
              </span>
            </button>

            {profileOpen && (
              <div className="navbar-dropdown" role="menu">
                <div className="navbar-dropdown-header">
                  <span className="navbar-dropdown-username">{username}</span>
                  <span className="navbar-dropdown-plan">
                    {isPro ? (
                      <span className="navbar-plan-pro">PRO</span>
                    ) : (
                      <span className="navbar-plan-free">FREE</span>
                    )}
                  </span>
                </div>

                <div className="navbar-dropdown-divider" />

                <Link
                  to="/profile"
                  className="navbar-dropdown-item"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  <span className="navbar-dropdown-icon">⊙</span>
                  My Profile
                </Link>

                <Link
                  to="/dashboard"
                  className="navbar-dropdown-item"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  <span className="navbar-dropdown-icon">⊞</span>
                  Dashboard
                </Link>

                {!isPro && (
                  <Link
                    to="/pricing"
                    className="navbar-dropdown-item navbar-dropdown-item--accent"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className="navbar-dropdown-icon">⬡</span>
                    Upgrade to Pro
                  </Link>
                )}

                <div className="navbar-dropdown-divider" />

                <button
                  className="navbar-dropdown-item navbar-dropdown-item--danger"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <span className="navbar-dropdown-icon">⊗</span>
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={`navbar-hamburger ${menuOpen ? "navbar-hamburger--open" : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle mobile menu"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* ── Mobile menu ─────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="navbar-mobile" role="menu">
          <NavLink to="/challenges"  className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>Challenges</NavLink>
          <NavLink to="/leaderboard" className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>Leaderboard</NavLink>
          <NavLink to="/contests"    className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>
            Contests {!isPro && <span className="navbar-pro-badge">PRO</span>}
          </NavLink>
          <NavLink to="/profile"     className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>Profile</NavLink>
          {isAdmin && (
            <NavLink to="/admin"     className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>Admin</NavLink>
          )}
          <div className="navbar-mobile-divider" />
          <button className="navbar-mobile-link navbar-mobile-link--danger" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGravatarUrl(email) {
  if (!email) return getFallbackAvatar("?");
  // Simple hash for Gravatar — MD5 would be ideal but keeping it dependency-free
  const encoded = encodeURIComponent(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${btoa(email.trim().toLowerCase())}?d=identicon&s=40`;
}

function getFallbackAvatar(username) {
  const initials = (username || "?").charAt(0).toUpperCase();
  const colors = ["00FF88", "00BFFF", "FF9500", "FF4D4D"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return `https://ui-avatars.com/api/?name=${initials}&background=${color}&color=0D0F12&size=40&bold=true`;
}