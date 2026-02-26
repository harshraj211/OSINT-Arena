/**
 * AppRouter.jsx
 * Complete route map for OSINT Arena.
 * Uses React Router v6 with nested layouts.
 *
 * File location: frontend/src/routes/AppRouter.jsx
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

import PrivateRoute from "./PrivateRoute";
import AdminRoute   from "./AdminRoute";
import ProRoute     from "./ProRoute";
import Spinner      from "../components/ui/Spinner";

// ── Lazy-loaded pages (code splitting) ────────────────────────────────────────
const Home           = lazy(() => import("../pages/Home"));
const Login          = lazy(() => import("../pages/Login"));
const Register       = lazy(() => import("../pages/Register"));
const VerifyEmail    = lazy(() => import("../pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));

const Dashboard      = lazy(() => import("../pages/Dashboard"));
const Challenges     = lazy(() => import("../pages/Challenges"));
const ChallengeSolve = lazy(() => import("../pages/ChallengeSolve"));
const Profile        = lazy(() => import("../pages/Profile"));
const Leaderboard    = lazy(() => import("../pages/Leaderboard"));
const Pricing        = lazy(() => import("../pages/Pricing"));
const CertVerify     = lazy(() => import("../pages/CertVerify"));
const NotFound       = lazy(() => import("../pages/NotFound"));

// Pro-gated pages
const Contests       = lazy(() => import("../pages/Contests"));
const ContestDetail  = lazy(() => import("../pages/ContestDetail"));

// Admin pages
const AdminLayout    = lazy(() => import("../pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminChallenges = lazy(() => import("../pages/admin/AdminChallenges"));
const AdminContests  = lazy(() => import("../pages/admin/AdminContests"));
const AdminUsers     = lazy(() => import("../pages/admin/AdminUsers"));
const AdminFlags     = lazy(() => import("../pages/admin/AdminFlags"));

// ── Fallback while lazy chunks load ───────────────────────────────────────────
function PageLoader() {
  return (
    <div className="route-loading">
      <Spinner size="lg" />
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Public routes ──────────────────────────────────────────────── */}
          <Route path="/"              element={<Home />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/register"      element={<Register />} />
          <Route path="/verify-email"  element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/pricing"       element={<Pricing />} />

          {/* Public certificate verification — no login needed */}
          <Route path="/verify/:certId" element={<CertVerify />} />

          {/* ── Protected routes (auth + verified) ─────────────────────────── */}
          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />

          <Route path="/challenges" element={
            <PrivateRoute><Challenges /></PrivateRoute>
          } />

          <Route path="/challenges/:slug" element={
            <PrivateRoute><ChallengeSolve /></PrivateRoute>
          } />

          {/* Public profile — anyone logged in can view others */}
          <Route path="/profile/:username" element={
            <PrivateRoute><Profile /></PrivateRoute>
          } />

          {/* Own profile shortcut */}
          <Route path="/profile" element={
            <PrivateRoute><Profile /></PrivateRoute>
          } />

          <Route path="/leaderboard" element={
            <PrivateRoute><Leaderboard /></PrivateRoute>
          } />

          {/* ── Pro-only routes ─────────────────────────────────────────────── */}
          <Route path="/contests" element={
            <ProRoute><Contests /></ProRoute>
          } />

          <Route path="/contests/:contestId" element={
            <ProRoute><ContestDetail /></ProRoute>
          } />

          {/* ── Admin routes ────────────────────────────────────────────────── */}
          <Route path="/admin" element={
            <AdminRoute><AdminLayout /></AdminRoute>
          }>
            {/* Nested under AdminLayout */}
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard"  element={<AdminDashboard />} />
            <Route path="challenges" element={<AdminChallenges />} />
            <Route path="contests"   element={<AdminContests />} />
            <Route path="users"      element={<AdminUsers />} />
            <Route path="flags"      element={<AdminFlags />} />
          </Route>

          {/* ── Fallback ────────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}