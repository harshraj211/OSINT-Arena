/**
 * AuthContext.jsx
 * Central authentication state for the entire app.
 * Wraps Firebase Auth — all components consume this, never Firebase directly.
 *
 * Key behaviours:
 *  - onIdTokenChanged: re-reads custom claims on every token refresh, including
 *    after setCustomClaims Cloud Function runs (token refresh = new claims)
 *  - Firestore onSnapshot: streams users/{uid} profile in real-time
 *  - syncClaims(): calls setCustomClaims CF then force-refreshes the JWT,
 *    used by Pricing.jsx after a successful Razorpay payment
 *  - Pro expiry: checks proExpiresAt claim on token load; downgrades locally
 *    if expired (CF handles the authoritative downgrade)
 *  - canSolveToday(): free users limited to 5 solves/day via Firestore counter
 *
 * Provided values:
 *  currentUser      FirebaseUser | null
 *  userProfile      Firestore users/{uid} doc | null
 *  loading          true while first auth state is resolving
 *  profileLoading   true while Firestore profile is first loading
 *  isAuthenticated  Boolean
 *  isVerified       email verified
 *  isAdmin          role === "admin" (from Firestore)
 *  isMod            role === "mod" | "admin"
 *  isPro            plan === "pro" (from JWT claim — not Firestore, for speed)
 *  claimsReady      true once JWT custom claims have been read at least once
 *  login / register / logout / resetPassword / resendVerification
 *  refreshUser      reload + force token refresh
 *  syncClaims       call setCustomClaims CF + force token refresh (post-payment)
 *  canSolveToday    () => boolean — free tier daily limit
 *
 * File location: frontend/src/context/AuthContext.jsx
 */

import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef,
} from "react";
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "../firebase/config";

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Cloud Function reference (lazy — only called when needed) ─────────────────
let _setCustomClaimsFn = null;
function getSetCustomClaimsFn() {
  if (!_setCustomClaimsFn) {
    _setCustomClaimsFn = httpsCallable(getFunctions(), "setCustomClaims");
  }
  return _setCustomClaimsFn;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]       = useState(null);
  const [userProfile, setUserProfile]       = useState(null);
  const [claims, setClaims]                 = useState(null);   // JWT custom claims
  const [loading, setLoading]               = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [claimsReady, setClaimsReady]       = useState(false);

  // Track the Firestore unsubscribe so we can clean up when user changes
  const profileUnsubRef = useRef(null);

  // ── onIdTokenChanged ────────────────────────────────────────────────────────
  // Fires on:
  //   - sign-in / sign-out
  //   - token refresh (every ~1h automatically)
  //   - force refresh via getIdToken(true) — which we call after setCustomClaims
  useEffect(() => {
    const unsubAuth = onIdTokenChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        // Signed out — clean up everything
        setUserProfile(null);
        setClaims(null);
        setClaimsReady(false);
        setProfileLoading(false);
        setLoading(false);

        if (profileUnsubRef.current) {
          profileUnsubRef.current();
          profileUnsubRef.current = null;
        }
        return;
      }

      // ── Read JWT custom claims ─────────────────────────────────────────
      try {
        const idTokenResult = await user.getIdTokenResult();
        const tokenClaims   = idTokenResult.claims || {};

        // Check Pro expiry from claim
        const proExpiresAt = tokenClaims.proExpiresAt
          ? new Date(tokenClaims.proExpiresAt)
          : null;
        const proExpired = proExpiresAt ? proExpiresAt < new Date() : false;

        setClaims({
          plan:          proExpired ? "free" : (tokenClaims.plan || "free"),
          role:          tokenClaims.role  || "user",
          proExpiresAt:  tokenClaims.proExpiresAt || null,
          proExpired,
        });
      } catch (err) {
        console.error("AuthContext: failed to read claims", err);
        setClaims({ plan: "free", role: "user", proExpiresAt: null, proExpired: false });
      }

      setClaimsReady(true);

      // ── Subscribe to Firestore profile (only once per user session) ────
      if (!profileUnsubRef.current) {
        setProfileLoading(true);

        const userRef = doc(db, "users", user.uid);
        profileUnsubRef.current = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile({ id: snap.id, ...snap.data() });
            } else {
              // onUserCreated Cloud Function may have a short delay
              setUserProfile(null);
            }
            setProfileLoading(false);
            setLoading(false);
          },
          (err) => {
            console.error("AuthContext: profile snapshot error", err);
            setProfileLoading(false);
            setLoading(false);
          }
        );
      } else {
        // Already subscribed — loading is done
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
    };
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────────

  const login = useCallback(async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const register = useCallback(async (email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    // onIdTokenChanged fires with null and cleans up state
  }, []);

  const resetPassword = useCallback(async (email) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const resendVerification = useCallback(async () => {
    if (currentUser && !currentUser.emailVerified) {
      await sendEmailVerification(currentUser);
    }
  }, [currentUser]);

  /**
   * refreshUser — reloads the Firebase user object and force-refreshes the
   * JWT to pick up any claim changes made directly (e.g. via admin panel).
   */
  const refreshUser = useCallback(async () => {
    if (!currentUser) return;
    await reload(currentUser);
    await currentUser.getIdToken(/* forceRefresh= */ true);
    // onIdTokenChanged fires automatically with the new token
  }, [currentUser]);

  /**
   * syncClaims — called from Pricing.jsx after a successful Razorpay payment.
   *
   * Flow:
   *  1. Call setCustomClaims Cloud Function → it reads Firestore + sets JWT claims
   *  2. Force-refresh the ID token → onIdTokenChanged fires → claims state updates
   *  3. Return the result so the caller can update UI immediately
   */
  const syncClaims = useCallback(async () => {
    if (!currentUser) return null;
    try {
      const fn     = getSetCustomClaimsFn();
      const result = await fn();                          // calls Cloud Function
      await currentUser.getIdToken(/* forceRefresh= */ true); // triggers onIdTokenChanged
      return result.data;
    } catch (err) {
      console.error("AuthContext: syncClaims failed", err);
      throw err;
    }
  }, [currentUser]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isVerified      = Boolean(currentUser?.emailVerified);
  const isAuthenticated = Boolean(currentUser);

  // Role comes from Firestore (more reliable for admin checks than JWT)
  const isAdmin = userProfile?.role === "admin";
  const isMod   = userProfile?.role === "mod" || isAdmin;

  // Plan comes from JWT custom claim (fastest — no Firestore read needed).
  // Admins always get Pro perks regardless of their plan field.
  const isPro = isAdmin || claims?.plan === "pro";

  /**
   * canSolveToday — free-tier daily limit (5 solves/day).
   * Pro users and admins are always unrestricted.
   * The Firestore dailySolves counter is written by submitAnswer Cloud Function.
   */
  const canSolveToday = useCallback(() => {
    if (isPro) return true;
    const today       = new Date().toISOString().split("T")[0];
    const dailySolves = userProfile?.dailySolves?.[today] ?? 0;
    return dailySolves < 5;
  }, [isPro, userProfile]);

  /**
   * dailySolvesRemaining — how many solves left today (for dashboard display).
   */
  const dailySolvesRemaining = useCallback(() => {
    if (isPro) return Infinity;
    const today       = new Date().toISOString().split("T")[0];
    const dailySolves = userProfile?.dailySolves?.[today] ?? 0;
    return Math.max(0, 5 - dailySolves);
  }, [isPro, userProfile]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // Core auth state
    currentUser,
    userProfile,
    loading,
    profileLoading,
    claimsReady,

    // Derived booleans
    isAuthenticated,
    isVerified,
    isAdmin,
    isMod,
    isPro,

    // Claims (JWT)
    claims,

    // Daily limit helpers
    canSolveToday,
    dailySolvesRemaining,

    // Actions
    login,
    register,
    logout,
    resetPassword,
    resendVerification,
    refreshUser,
    syncClaims,
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