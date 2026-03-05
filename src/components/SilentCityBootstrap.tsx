import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Bootstrap silencioso que garante que o banco de cidades está completo
 * Executado automaticamente em background, sem UI visível
 */
export const SilentCityBootstrap = () => {
  useEffect(() => {
    const controller = new AbortController();

    const ensureCitiesLoaded = async () => {
      try {
        // Só executar para usuários autenticados (evita erro no Lighthouse/visitantes)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Verificar se já executou nesta sessão
        const lastCheck = localStorage.getItem('cities_bootstrap_check');
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;
        
        if (lastCheck && (now - parseInt(lastCheck)) < ONE_HOUR) {
          return; // Já verificado recentemente
        }

        // Contar cidades no banco
        const { count, error } = await supabase
          .from('cities')
          .select('id', { count: 'exact', head: true });

        if (error) {
          console.warn('[SilentCityBootstrap] Erro ao verificar cities:', error);
          return;
        }

        // Se tiver menos de 5500 cidades, disparar importação silenciosa
        if (count !== null && count < 5500) {
          console.log('[SilentCityBootstrap] Importando cidades em background...');
          
          // Timeout de 30s para evitar ERR_TIMED_OUT no console
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          supabase.functions.invoke('import-cities', {
            body: { state: 'ALL' },
          }).then(({ error: fnError }) => {
            clearTimeout(timeoutId);
            if (fnError && !controller.signal.aborted) {
              console.warn('[SilentCityBootstrap] Importação em andamento (background)');
            }
          }).catch(() => {
            clearTimeout(timeoutId);
            // Silenciar erros de rede/timeout — operação best-effort
          });
        }

        // Marcar verificação
        localStorage.setItem('cities_bootstrap_check', now.toString());
      } catch (error) {
        // Silenciar completamente — bootstrap é best-effort
      }
    };

    // Executar após 5 segundos para não interferir no boot do app
    const timer = setTimeout(ensureCitiesLoaded, 5000);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Componente invisível
  return null;
};
