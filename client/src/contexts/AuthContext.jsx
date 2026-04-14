import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { apiFetch } from '../api/client.js';
import { AuthContext } from './auth-context.js';

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);         // Supabase user object
  const [adminProfile, setAdminProfile] = useState(null); // { email, role, displayName }
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Verify the user's email against the authorized_admins whitelist
  const verifyAccess = useCallback(async (accessToken, supaUser) => {
    const forceSignOut = async () => {
      try {
        await supabase.auth.signOut();
      } catch (_err) {
        // ignore sign-out failures; local state is still reset below
      }
      setSession(null);
      setUser(null);
      setAdminProfile(null);
      setIsAuthorized(false);
    };

    const requestCheck = async (token) => {
      return apiFetch('/api/auth/check-access', {
        method: 'POST',
        body: JSON.stringify({ email: supaUser?.email || '' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    };

    try {
      let tokenToUse = accessToken;
      if (!tokenToUse) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        tokenToUse = currentSession?.access_token || null;
      }

      if (!tokenToUse) {
        await forceSignOut();
        setAuthError('No active authentication token found. Please sign in again.');
        return;
      }

      let result;
      try {
        result = await requestCheck(tokenToUse);
      } catch (err) {
        // A stale token can happen around OAuth redirects; refresh once and retry.
        if (err?.status === 401) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshedSession?.access_token) {
            throw err;
          }
          setSession(refreshedSession);
          setUser(refreshedSession.user ?? supaUser ?? null);
          result = await requestCheck(refreshedSession.access_token);
        } else {
          throw err;
        }
      }

      if (result.authorized) {
        setAdminProfile({
          email: result.email,
          role: result.role,
          displayName: result.displayName,
        });
        setIsAuthorized(true);
        setAuthError(null);
      } else {
        // Email not whitelisted — sign them out
        await forceSignOut();
        setAuthError(
          result.message || 'Your email is not authorized to access this system.'
        );
      }
    } catch (err) {
      console.error('Access verification failed:', err);
      if (err?.status === 401) {
        await forceSignOut();
        setAuthError('Session expired or invalid. Please sign in again.');
      } else {
        await forceSignOut();
        setAuthError('Unable to verify access. Please try again.');
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initTimeout = setTimeout(() => {
      if (!mounted) return;
      setIsLoading(false);
      setAuthError((prev) => prev || 'Authentication is taking too long. Please try signing in again.');
    }, 15000);

    // 1. Get the existing session on mount
    async function initSession() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await verifyAccess(currentSession.access_token, currentSession.user);
        }
      } catch (err) {
        console.error('Failed to get session:', err);
      } finally {
        clearTimeout(initTimeout);
        if (mounted) setIsLoading(false);
      }
    }

    initSession();

    // 2. Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN' && newSession?.user) {
          setIsLoading(true);
          try {
            await verifyAccess(newSession.access_token, newSession.user);
          } finally {
            if (mounted) setIsLoading(false);
          }
        }

        if (event === 'SIGNED_OUT') {
          setAdminProfile(null);
          setIsAuthorized(false);
          setIsLoading(false);
        }

        if (event === 'TOKEN_REFRESHED' && newSession?.user) {
          // Token refreshed — keep existing state, just update session
          setSession(newSession);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, [verifyAccess]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: 'umak.edu.ph',  // Hint Google to show only @umak.edu.ph accounts
        },
      },
    });
    if (error) {
      setAuthError(error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAdminProfile(null);
    setIsAuthorized(false);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      adminProfile,
      isAuthorized,
      isLoading,
      authError,
      signInWithGoogle,
      signOut,
      clearError: () => setAuthError(null),
    }),
    [session, user, adminProfile, isAuthorized, isLoading, authError, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider };
