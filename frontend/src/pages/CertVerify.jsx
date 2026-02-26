/**
 * CertVerify.jsx
 * Public certificate verification page — no login required.
 * Route: /verify/:certId
 *
 * Fetches cert from Firestore certifications/{certId}
 * and displays verified or invalid state.
 *
 * File location: frontend/src/pages/CertVerify.jsx
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import "./CertVerify.css";

export default function CertVerify() {
  const { certId } = useParams();

  const [cert, setCert]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!certId) { setNotFound(true); setLoading(false); return; }
    loadCert();
  }, [certId]);

  async function loadCert() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "certifications", certId));
      if (!snap.exists()) {
        setNotFound(true);
      } else {
        setCert({ id: snap.id, ...snap.data() });
      }
    } catch (err) {
      console.error("loadCert:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const issuedDate = cert?.issuedAt?.toDate
    ? cert.issuedAt.toDate().toLocaleDateString("en-US", {
        day: "numeric", month: "long", year: "numeric"
      })
    : "—";

  const expiresDate = cert?.expiresAt?.toDate
    ? cert.expiresAt.toDate().toLocaleDateString("en-US", {
        day: "numeric", month: "long", year: "numeric"
      })
    : null;

  const isExpired = cert?.expiresAt?.toDate
    ? cert.expiresAt.toDate() < new Date()
    : false;

  return (
    <div className="cv-page">
      {/* Background */}
      <div className="cv-bg-grid" aria-hidden="true" />
      <div className="cv-bg-glow" aria-hidden="true" />

      {/* Header */}
      <header className="cv-header">
        <Link to="/" className="cv-logo">
          <span className="cv-logo-bracket">[</span>
          <span className="cv-logo-text">OSINT ARENA</span>
          <span className="cv-logo-bracket">]</span>
        </Link>
        <span className="cv-header-label">Certificate Verification</span>
      </header>

      <main className="cv-main">
        {loading && (
          <div className="cv-loading">
            <div className="cv-loading-spinner" />
            <span>Verifying certificate...</span>
          </div>
        )}

        {!loading && notFound && (
          <div className="cv-card cv-card--invalid">
            <div className="cv-status-icon cv-status-icon--invalid">✗</div>
            <h1 className="cv-status-title cv-status-title--invalid">
              Invalid Certificate
            </h1>
            <p className="cv-status-sub">
              No certificate found with ID:
            </p>
            <code className="cv-cert-id">{certId}</code>
            <p className="cv-status-note">
              This certificate may have been revoked or the ID is incorrect.
              If you believe this is an error, contact{" "}
              <a href="mailto:support@osintarena.com" className="cv-link">
                support@osintarena.com
              </a>.
            </p>
          </div>
        )}

        {!loading && cert && (
          <div className={`cv-card ${isExpired ? "cv-card--expired" : "cv-card--valid"}`}>

            {/* Status banner */}
            <div className={`cv-status-banner ${isExpired ? "cv-status-banner--expired" : "cv-status-banner--valid"}`}>
              <span className="cv-status-banner-icon">
                {isExpired ? "⚠" : "✓"}
              </span>
              <span>
                {isExpired
                  ? "Certificate Expired"
                  : "Certificate Verified"
                }
              </span>
            </div>

            {/* Cert content */}
            <div className="cv-cert-body">
              {/* Seal */}
              <div className="cv-seal" aria-hidden="true">
                <div className="cv-seal-inner">
                  <span className="cv-seal-text">OSINT<br/>ARENA</span>
                </div>
              </div>

              <div className="cv-cert-text">
                <p className="cv-cert-presents">This certifies that</p>

                <h1 className="cv-cert-name">{cert.username}</h1>

                <p className="cv-cert-body-text">
                  has successfully demonstrated proficiency in
                </p>

                <h2 className="cv-cert-tier">
                  {cert.tier?.charAt(0).toUpperCase() + cert.tier?.slice(1)} OSINT
                </h2>

                <p className="cv-cert-body-text">
                  by completing all {cert.tier} challenges on the OSINT Arena platform.
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="cv-cert-meta">
              <div className="cv-meta-row">
                <span className="cv-meta-label">Certificate ID</span>
                <code className="cv-meta-value cv-meta-value--mono">{certId}</code>
              </div>
              <div className="cv-meta-row">
                <span className="cv-meta-label">Issued to</span>
                <span className="cv-meta-value">{cert.username}</span>
              </div>
              <div className="cv-meta-row">
                <span className="cv-meta-label">Issue date</span>
                <span className="cv-meta-value">{issuedDate}</span>
              </div>
              {expiresDate && (
                <div className="cv-meta-row">
                  <span className="cv-meta-label">Expiry date</span>
                  <span className={`cv-meta-value ${isExpired ? "cv-meta-value--expired" : ""}`}>
                    {expiresDate}
                    {isExpired && " (Expired)"}
                  </span>
                </div>
              )}
              <div className="cv-meta-row">
                <span className="cv-meta-label">Tier</span>
                <span className="cv-meta-value">{cert.tier}</span>
              </div>
            </div>

            {/* Share / verify note */}
            <div className="cv-actions">
              <button
                className="cv-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Certificate URL copied to clipboard!");
                }}
              >
                Copy verification URL
              </button>
              <Link to="/register" className="cv-cta-link">
                Earn your own certificate →
              </Link>
            </div>

          </div>
        )}
      </main>

      <footer className="cv-footer">
        <p>
          © {new Date().getFullYear()} OSINT Arena ·{" "}
          <a href="https://osintarena.com" className="cv-link">osintarena.com</a>
        </p>
      </footer>
    </div>
  );
}