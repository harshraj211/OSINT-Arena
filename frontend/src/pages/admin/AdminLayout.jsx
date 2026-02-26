/**
 * AdminLayout.jsx
 * Layout shell for all /admin/* pages.
 * Has its own sidebar navigation instead of the main Navbar links.
 * Uses React Router's <Outlet /> for nested routes.
 *
 * File location: frontend/src/pages/admin/AdminLayout.jsx
 */

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import "./AdminLayout.css";

const ADMIN_NAV = [
  { to: "/admin/dashboard",  label: "Dashboard",  icon: "⊞" },
  { to: "/admin/challenges", label: "Challenges",  icon: "◈" },
  { to: "/admin/contests",   label: "Contests",    icon: "⬡" },
  { to: "/admin/users",      label: "Users",       icon: "⊙" },
  { to: "/admin/flags",      label: "Flags",       icon: "⚑" },
];

export default function AdminLayout() {
  const { userProfile } = useAuth();

  return (
    <div className="admin-shell">
      <Navbar />

      <div className="admin-body">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <span className="admin-sidebar-title">Admin Panel</span>
            <span className="admin-sidebar-user">
              {userProfile?.username || "Admin"}
            </span>
          </div>

          <nav className="admin-nav">
            {ADMIN_NAV.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`
                }
              >
                <span className="admin-nav-icon">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <NavLink to="/dashboard" className="admin-back-link">
              ← Back to app
            </NavLink>
          </div>
        </aside>

        {/* Main content area — renders nested route */}
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}