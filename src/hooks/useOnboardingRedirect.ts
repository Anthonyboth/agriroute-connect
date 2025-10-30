/**
 * useOnboardingRedirect Hook
 * 
 * Handles onboarding redirect logic safely:
 * - Only redirects after profile is loaded
 * - Never redirects APPROVED users
 * - Prevents redirect loops
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export function useOnboardingRedirect() {
  const { initialized, profile, isApproved, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Don't redirect if already redirected in this session
    if (hasRedirectedRef.current) {
      return;
    }

    // Don't redirect while still loading or not initialized
    if (loading || !initialized) {
      return;
    }

    // Don't redirect if already on auth/complete-profile/onboarding pages
    const onAuthPages = ['/auth', '/complete-profile', '/confirm-email', '/reset-password'].includes(location.pathname);
    if (onAuthPages) {
      return;
    }

    // Don't redirect if no profile loaded yet (might still be loading)
    if (!profile) {
      return;
    }

    // NEVER redirect approved users to complete-profile
    if (isApproved || profile.status === 'APPROVED' || profile.approved_at) {
      return;
    }

    // Only redirect if profile is truly incomplete (pending and missing required fields)
    const isPending = profile.status === 'PENDING';
    const isMissingFields = !profile.full_name || !profile.phone || !profile.document;

    if (isPending && isMissingFields) {
      hasRedirectedRef.current = true;
      if (import.meta.env.DEV) {
        console.log('[useOnboardingRedirect] Redirecting to complete-profile');
      }
      navigate('/complete-profile', { replace: true });
    }
  }, [initialized, profile, isApproved, loading, location.pathname, navigate]);

  // Reset redirect flag when user changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [profile?.id]);
}
