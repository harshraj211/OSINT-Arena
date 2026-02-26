/**
 * Spinner.jsx
 * Loading spinner used by PrivateRoute, AdminRoute, ProRoute.
 *
 * File location: frontend/src/components/ui/Spinner.jsx
 */

import "./Spinner.css";

export default function Spinner({ size = "md" }) {
  return (
    <div className={`spinner spinner--${size}`} aria-label="Loading..." role="status">
      <div className="spinner__ring" />
    </div>
  );
}