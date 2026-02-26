/**
 * Footer.jsx
 * Minimal footer shown on all pages except challenge solve.
 *
 * File location: frontend/src/components/layout/Footer.jsx
 */

import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">

        <div className="footer-left">
          <span className="footer-logo">
            <span className="footer-logo-bracket">[</span>
            <span className="footer-logo-text">OSINT ARENA</span>
            <span className="footer-logo-bracket">]</span>
          </span>
          <span className="footer-copy">© {year} · All rights reserved</span>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/pricing"  className="footer-link">Pricing</Link>
          <a href="/terms"     className="footer-link">Terms</a>
          <a href="/privacy"   className="footer-link">Privacy</a>
          <a
            href="https://github.com/osint-arena"
            className="footer-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>

      </div>
    </footer>
  );
}