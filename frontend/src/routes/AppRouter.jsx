/**
 * AppRouter.jsx
 * Complete route map for OSINT Arena.
 * Uses React Router v6 with nested layouts + lazy loading.
 *
 * Route guards:
 *   PrivateRoute  — must be authenticated + email verified
 *   ProRoute      — must be authenticated + verified + plan === "pro"
 *   AdminRoute    — must be authenticated + verified + role === "admin"
 *
 * Public routes (no auth required):
 *   /                 → redirects to /dashboard if logged in, else /login
 *   /login
 *   /register
 *   /verify-email
 *   /forgot-password
 *   /pricing
 *   /verify/:certId   → public certificate verification page
 *
 * File location: frontend/src/routes/AppRouter.jsx
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/ui/Spinner";

// ── Lazy-loaded pages — code-split per route ──────────────────────────────────

// Auth / public
const Login          = lazy(() => import("../pages/Login"));
const Register       = lazy(() => import("../pages/Register"));
const VerifyEmail    = lazy(() => import("../pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const Pricing        = lazy(() => import("../pages/Pricing"));
const CertVerify     = lazy(() => import("../pages/CertVerify"));
const NotFound       = lazy(() => import("../pages/NotFound"));

// Authenticated pages
const Dashboard      = lazy(() => import("../pages/Dashboard"));
const Challenges     = lazy(() => import("../pages/Challenges"));
const ChallengeSolve = lazy(() => import("../pages/ChallengeSolve"));
const Profile        = lazy(() => import("../pages/Profile"));
const Leaderboard    = lazy(() => import("../pages/Leaderboard"));

// Pro-only pages
const Contests       = lazy(() => import("../pages/Contests"));
const ContestSolve   = lazy(() => import("../pages/ContestSolve"));

// Admin pages
const AdminLayout    = lazy(() => import("../pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminUsers     = lazy(() => import("../pages/admin/AdminUsers"));
const AdminFlags     = lazy(() => import("../pages/admin/AdminFlags"));

// ── Route guards — imported directly (small, not worth lazy-loading) ──────────
import PrivateRoute from "./PrivateRoute";
import ProRoute     from "./ProRoute";
import AdminRoute   from "./AdminRoute";

// ── Page-level loading fallback ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="route-loading">
      <div className="route-loading-spinner" />
    </div>
  );
}

// ── Root redirect — sends logged-in users to /dashboard ──────────────────────
function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

// ── Main router ───────────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Root ──────────────────────────────────────────────────────── */}
          <Route path="/" element={<RootRedirect />} />

          {/* ── Public / auth pages ───────────────────────────────────────── */}
          <Route path="/login"            element={<Login />} />
          <Route path="/register"         element={<Register />} />
          <Route path="/verify-email"     element={<VerifyEmail />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />

          {/* Pricing is public so free users can see what they're missing */}
          <Route path="/pricing"          element={<Pricing />} />

          {/* Certificate verification is fully public — shareable URLs */}
          <Route path="/verify/:certId"   element={<CertVerify />} />

          {/* ── Authenticated + verified ──────────────────────────────────── */}
          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />

          <Route path="/challenges" element={
            <PrivateRoute><Challenges /></PrivateRoute>
          } />

          {/* :slug matches challenge slugs like "google-dork-basics" */}
          <Route path="/challenges/:slug" element={
            <PrivateRoute><ChallengeSolve /></PrivateRoute>
          } />

          {/* Own profile shortcut — Profile reads uid from AuthContext */}
          <Route path="/profile" element={
            <PrivateRoute><Profile /></PrivateRoute>
          } />

          {/* Public profile — any logged-in user can view others */}
          <Route path="/profile/:username" element={
            <PrivateRoute><Profile /></PrivateRoute>
          } />

          <Route path="/leaderboard" element={
            <PrivateRoute><Leaderboard /></PrivateRoute>
          } />

          {/* ── Pro-only ──────────────────────────────────────────────────── */}
          {/* ProRoute redirects free users to /pricing with reason="pro_required" */}
          <Route path="/contests" element={
            <ProRoute><Contests /></ProRoute>
          } />

          {/* ContestSolve is a full-screen layout (no PageWrapper) */}
          <Route path="/contests/:contestId" element={
            <ProRoute><ContestSolve /></ProRoute>
          } />

          {/* ── Admin panel — nested under AdminLayout sidebar ────────────── */}
          {/* AdminRoute silently redirects non-admins to /dashboard */}
          <Route path="/admin" element={
            <AdminRoute><AdminLayout /></AdminRoute>
          }>
            {/* /admin → redirect to /admin/dashboard */}
            <Route index element={<Navigate to="/admin/dashboard" replace />} />

            {/* Rendered inside AdminLayout's <Outlet /> */}
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users"     element={<AdminUsers />} />
            <Route path="flags"     element={<AdminFlags />} />

            {/* Placeholders — generate these pages when ready */}
            {/* <Route path="challenges" element={<AdminChallenges />} /> */}
            {/* <Route path="contests"   element={<AdminContests />} />  */}

            {/* Catch-all inside /admin → back to dashboard */}
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>

          {/* ── 404 ───────────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}