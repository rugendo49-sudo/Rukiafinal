import { useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { API_URL } from "../config/api.js";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null); // { id, username, email, balance, isAdmin }
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAppUser(null);
        setIdToken(null);
        setLoading(false);
        return;
      }
      console.log("[useAuth] onAuthStateChanged: user present", { uid: user.uid, email: user.email });
      try {
        const token = await user.getIdToken();
        console.log("[useAuth] got idToken (length)", token?.length);
        setIdToken(token);
        const res = await fetch(`${API_URL}/api/auth/session`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("[useAuth] session response", res.status);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to sync session");
        setAppUser(data.user);
      } catch (err) {
        console.error("[useAuth] session error:", err);
        setAuthError(err.message);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Always fetch a fresh token for REST calls / (re)connecting the socket —
  // Firebase ID tokens expire hourly, and getIdToken() transparently
  // refreshes an expired cached one under the hood.
  const getFreshIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken();
    setIdToken(token);
    return token;
  }, []);

  const refreshSession = useCallback(async () => {
    const token = await getFreshIdToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAppUser(data.user);
    } catch (err) {
      // ignore
    }
  }, [getFreshIdToken]);

  const signUp = useCallback(async ({ name, phone, email, password }) => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Set display name in Firebase profile
      if (auth.currentUser && name) {
        await updateProfile(auth.currentUser, { displayName: name });
      }

      // Notify backend to persist phone (and display name) to local users table.
      const token = await auth.currentUser.getIdToken();
      await fetch(`${API_URL}/api/auth/profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, phone }),
      });
    } catch (err) {
      setAuthError(friendlyFirebaseError(err));
      throw err;
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(friendlyFirebaseError(err));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  // Re-fetch just the wallet balance portion of appUser (e.g. after a bet).
  const refreshBalance = useCallback(async () => {
    const token = await getFreshIdToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) setAppUser((u) => (u ? { ...u, balance: data.balance } : u));
  }, [getFreshIdToken]);

  return {
    firebaseUser,
    appUser,
    idToken,
    loading,
    authError,
    signUp,
    signIn,
    refreshSession,
    logout,
    getFreshIdToken,
    refreshBalance,
  };
}

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "That email is already registered — try logging in.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Incorrect email or password.";
  if (code.includes("user-not-found")) return "No account found with that email.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("invalid-email")) return "That doesn't look like a valid email address.";
  return err?.message || "Something went wrong. Please try again.";
}
