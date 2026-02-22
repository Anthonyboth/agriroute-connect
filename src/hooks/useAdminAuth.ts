/**
 * useAdminAuth — Hook para verificar se o usuário logado é um admin allowlisted.
 * Usa a tabela admin_users como fonte de verdade (backend-enforced via RLS).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: 'superadmin' | 'reviewer' | 'support' | 'finance' | 'ops';
  is_active: boolean;
  full_name: string | null;
}

export function useAdminAuth() {
  const { user, loading: authLoading } = useAuth();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdmin = useCallback(async () => {
    if (!user?.id) {
      setAdminUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error: queryError } = await (supabase as any)
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (queryError) {
        // If RLS blocks (user not admin), this returns no data, not an error
        console.warn('[useAdminAuth] Query error:', queryError.message);
        setAdminUser(null);
      } else {
        setAdminUser(data as AdminUser | null);
      }
    } catch (err: any) {
      console.error('[useAdminAuth] Error:', err);
      setError(err.message);
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) {
      checkAdmin();
    }
  }, [authLoading, checkAdmin]);

  return {
    adminUser,
    isAdmin: !!adminUser,
    isSuperAdmin: adminUser?.role === 'superadmin',
    adminRole: adminUser?.role || null,
    loading: authLoading || loading,
    error,
    refresh: checkAdmin,
  };
}
