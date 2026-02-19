import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook que verifica se o usuário autenticado possui mais de um perfil (conta).
 * Usado para decidir se exibir a opção "Alternar Conta" no menu.
 */
export function useHasMultipleProfiles() {
  const { session } = useAuth();
  const [hasMultiple, setHasMultiple] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setHasMultiple(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .in('role', ['MOTORISTA', 'MOTORISTA_AFILIADO', 'PRODUTOR', 'TRANSPORTADORA', 'PRESTADOR_SERVICOS']);

        if (!cancelled) {
          if (error) {
            console.warn('[useHasMultipleProfiles] Error:', error.message);
            setHasMultiple(false);
          } else {
            setHasMultiple((count ?? 0) > 1);
          }
        }
      } catch {
        if (!cancelled) setHasMultiple(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    check();

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return { hasMultiple, loading };
}
