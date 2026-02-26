/**
 * ProRoute.jsx
 * Requires: authenticated + verified + plan === "pro" (or admin)
 * Redirects:
 *   - Not logged in  → /login
 *   - Free tier user → /pricing  (with upgrade prompt)
 *
 * File location: frontend/src/routes/ProRoute.jsx
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/ui/Spinner";

export default function ProRoute({ children }) {
  const { isAuthenticated, isVerified, isPro, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || profileLoading) {
    return (
      <div className="route-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!isPro) {
    // Pass the attempted route so pricing page can show context
    // e.g. "Upgrade to join contests"
    return (
      <Navigate
        to="/pricing"
        state={{ from: location, reason: "pro_required" }}
        replace
      />
    );
  }

  return children;
}