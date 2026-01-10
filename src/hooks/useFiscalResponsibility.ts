import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const LOCAL_STORAGE_KEY = 'fiscal_responsibility_accepted';
const TERM_VERSION = '1.0';

interface FiscalResponsibilityState {
  accepted: boolean;
  loading: boolean;
  acceptedAt?: string;
}

export function useFiscalResponsibility() {
  const [state, setState] = useState<FiscalResponsibilityState>({
    accepted: false,
    loading: true,
  });
  const { toast } = useToast();

  // Check if user has accepted the term
  const checkAcceptance = useCallback(async () => {
    try {
      // First check localStorage for quick response
      const localAccepted = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localAccepted) {
        try {
          const parsed = JSON.parse(localAccepted);
          if (parsed.version === TERM_VERSION) {
            setState({ accepted: true, loading: false, acceptedAt: parsed.acceptedAt });
            return;
          }
        } catch {
          // Invalid localStorage data, continue to database check
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }

      // Then check database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState({ accepted: false, loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('fiscal_responsibility_acceptances')
        .select('accepted_at, term_version')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[FISCAL] Error checking acceptance:', error);
      }

      if (data && data.term_version === TERM_VERSION) {
        // Cache in localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
          version: TERM_VERSION,
          acceptedAt: data.accepted_at,
        }));
        setState({ accepted: true, loading: false, acceptedAt: data.accepted_at });
      } else {
        setState({ accepted: false, loading: false });
      }
    } catch (error) {
      console.error('[FISCAL] Error in checkAcceptance:', error);
      setState({ accepted: false, loading: false });
    }
  }, []);

  useEffect(() => {
    checkAcceptance();
  }, [checkAcceptance]);

  // Accept the term
  const acceptTerm = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado para aceitar o termo.',
          variant: 'destructive',
        });
        return false;
      }

      const acceptedAt = new Date().toISOString();

      // Get client info for audit
      const userAgent = navigator.userAgent;

      const { error } = await supabase
        .from('fiscal_responsibility_acceptances')
        .upsert({
          user_id: user.id,
          accepted_at: acceptedAt,
          term_version: TERM_VERSION,
          user_agent: userAgent,
        });

      if (error) {
        console.error('[FISCAL] Error accepting term:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível registrar o aceite. Tente novamente.',
          variant: 'destructive',
        });
        return false;
      }

      // Cache in localStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        version: TERM_VERSION,
        acceptedAt,
      }));

      // Log the action in audit trail
      await supabase.from('fiscal_compliance_logs').insert({
        user_id: user.id,
        action_type: 'fiscal_term_accepted',
        metadata: { 
          term_version: TERM_VERSION,
          accepted_at: acceptedAt,
        },
      });

      // Also log in compliance_audit_events if table exists
      try {
        await supabase.from('compliance_audit_events').insert({
          event_type: 'fiscal_term_accepted',
          event_category: 'fiscal',
          actor_id: user.id,
          event_data: {
            term_version: TERM_VERSION,
            accepted_at: acceptedAt,
          },
          user_agent: userAgent,
        });
      } catch {
        // Table might not exist yet, ignore
      }

      setState({ accepted: true, loading: false, acceptedAt });

      toast({
        title: 'Termo aceito',
        description: 'O termo de responsabilidade fiscal foi aceito com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('[FISCAL] Error in acceptTerm:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Clear acceptance (for testing/admin purposes)
  const clearAcceptance = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      await supabase
        .from('fiscal_responsibility_acceptances')
        .delete()
        .eq('user_id', user.id);

      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setState({ accepted: false, loading: false });
      return true;
    } catch (error) {
      console.error('[FISCAL] Error clearing acceptance:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    acceptTerm,
    checkAcceptance,
    clearAcceptance,
    termVersion: TERM_VERSION,
  };
}
