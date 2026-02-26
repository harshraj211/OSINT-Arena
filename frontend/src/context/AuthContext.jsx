/**
 * AuthContext.jsx
 * Central authentication state for the entire app.
 * Wraps Firebase Auth — all components use this, never Firebase directly.
 *
 * Provides:
 *  - currentUser      : Firebase user object (or null)
 *  - userProfile      : Firestore users/{uid} doc (role, elo, plan, etc.)
 *  - loading          : true while auth state is resolving
 *  - isVerified       : email verified check
 *  - isAdmin          : role claim check
 *  - isPro            : subscription plan check
 *  - login / logout / register / resetPassword
 *
 * File location: frontend/src/context/AuthContext.jsx
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/config";

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]   = useState(null);
  const [userProfile, setUserProfile]   = useState(null);
  const [loading, setLoading]           = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Listen to Firebase Auth state ──────────────────────────────────────────
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Start listening to Firestore profile doc
      setProfileLoading(true);
    });

    return () => unsubscribeAuth();
  }, []);

  // ── Listen to Firestore user profile (real-time) ───────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, "users", currentUser.uid);
    const unsubscribeProfile = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setUserProfile({ id: snap.id, ...snap.data() });
        } else {
          // Profile doc not yet created (onUserCreated Cloud Function may be delayed)
          setUserProfile(null);
        }
        setProfileLoading(false);
        setLoading(false);
      },
      (err) => {
        console.error("AuthContext: profile listener error", err);
        setProfileLoading(false);
        setLoading(false);
      }
    );

    return () => unsubscribeProfile();
  }, [currentUser]);

  // ── Auth actions ───────────────────────────────────────────────────────────

  const login = useCallback(async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  }, []);

  const register = useCallback(async (email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Send verification email immediately after registration
    await sendEmailVerification(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUserProfile(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const resendVerification = useCallback(async () => {
    if (currentUser) {
      await sendEmailVerification(currentUser);
    }
  }, [currentUser]);

  const refreshUser = useCallback(async () => {
    if (currentUser) {
      await reload(currentUser);
      // Force token refresh to get latest custom claims
      await currentUser.getIdToken(true);
    }
  }, [currentUser]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isVerified = Boolean(currentUser?.emailVerified);
  const isAdmin    = userProfile?.role === "admin";
  const isMod      = userProfile?.role === "moderator" || isAdmin;
  const isPro      = userProfile?.plan === "pro" || isAdmin; // Admins get Pro perks

  // ── Daily solve limit check (free tier: 5/day) ─────────────────────────────
  const canSolveToday = useCallback(() => {
    if (isPro) return true;
    const today = new Date().toISOString().split("T")[0];
    const dailySolves = userProfile?.dailySolves?.[today] || 0;
    return dailySolves < 5;
  }, [isPro, userProfile]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // State
    currentUser,
    userProfile,
    loading,
    profileLoading,

    // Derived
    isVerified,
    isAdmin,
    isMod,
    isPro,
    isAuthenticated: Boolean(currentUser),

    // Limit check
    canSolveToday,

    // Actions
    login,
    register,
    logout,
    resetPassword,
    resendVerification,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}