/**
 * useAdminApi — Hook for calling admin-panel-api edge function endpoints.
 * All requests go through the allowlist-validated edge function.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

export function useAdminApi() {
  const callApi = useCallback(async <T = any>(
    action: string,
    options?: {
      method?: HttpMethod;
      body?: any;
      params?: Record<string, string>;
      entityId?: string;
    }
  ): Promise<{ data: T | null; error: string | null }> => {
    try {
      const { method = 'GET', body, params, entityId } = options || {};

      // Build the path for the edge function
      // The edge function parses path segments after the function name
      let path = action;
      if (entityId) path += `/${entityId}`;

      // Build query string
      const queryString = params
        ? '?' + new URLSearchParams(params).toString()
        : '';

      // For GET requests, use query params via the function invoke
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        return { data: null, error: 'Não autenticado' };
      }

      const supabaseUrl = (supabase as any).supabaseUrl || 
        import.meta.env.VITE_SUPABASE_URL || 
        'https://shnvtxejjecbnztdbbbl.supabase.co';

      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-panel-api/${path}${queryString}`,
        {
          method: method === 'GET' ? 'GET' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg',
          },
          body: method !== 'GET' ? JSON.stringify(body || {}) : undefined,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: result.error || `Erro ${response.status}` };
      }

      return { data: result as T, error: null };
    } catch (err: any) {
      console.error('[useAdminApi] Error:', err);
      return { data: null, error: err.message || 'Erro de rede' };
    }
  }, []);

  return { callApi };
}
