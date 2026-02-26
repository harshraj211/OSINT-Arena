/**
 * PrivateRoute.jsx
 * Requires: authenticated + email verified
 * Redirects:
 *   - Not logged in        → /login
 *   - Logged in, unverified → /verify-email
 *
 * File location: frontend/src/routes/PrivateRoute.jsx
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/ui/Spinner";

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="route-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save attempted location so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isVerified) {
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }

  return children;
}