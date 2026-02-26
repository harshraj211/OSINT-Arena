/**
 * PageWrapper.jsx
 * Main layout shell for all authenticated pages.
 * Renders: Navbar + main content area + optional Footer.
 *
 * Usage:
 *   <PageWrapper>
 *     <YourPageContent />
 *   </PageWrapper>
 *
 *   <PageWrapper fullWidth noPadding>
 *     <ChallengeSolve />   ← three-panel layout needs full width
 *   </PageWrapper>
 *
 * File location: frontend/src/components/layout/PageWrapper.jsx
 */

import Navbar from "./Navbar";
import Footer from "./Footer";
import "./PageWrapper.css";

export default function PageWrapper({
  children,
  fullWidth  = false,   // removes max-width constraint
  noPadding  = false,   // removes default padding (for custom layouts)
  noFooter   = false,   // hides footer (for challenge solve page)
  className  = "",
}) {
  return (
    <div className="page-shell">
      <Navbar />

      <main
        className={[
          "page-main",
          fullWidth  ? "page-main--full"       : "",
          noPadding  ? "page-main--no-padding"  : "",
          className,
        ].filter(Boolean).join(" ")}
      >
        {children}
      </main>

      {!noFooter && <Footer />}
    </div>
  );
}