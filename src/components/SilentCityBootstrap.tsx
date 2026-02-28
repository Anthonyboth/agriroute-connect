import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Bootstrap silencioso que garante que o banco de cidades está completo
 * Executado automaticamente em background, sem UI visível
 */
export const SilentCityBootstrap = () => {
  useEffect(() => {
    const ensureCitiesLoaded = async () => {
      try {
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

        console.log('[SilentCityBootstrap] Cities count:', count);

        // Se tiver menos de 5500 cidades, disparar importação silenciosa
        if (count !== null && count < 5500) {
          console.log('[SilentCityBootstrap] Importando cidades em background...');
          
          // Disparar importação em background (não aguarda resultado)
          supabase.functions.invoke('import-cities', {
            body: { state: 'ALL' }
          }).then(({ data, error }) => {
            if (error) {
              console.warn('[SilentCityBootstrap] Erro na importação:', error);
            } else {
              console.log('[SilentCityBootstrap] Importação concluída:', data);
            }
          });
        }

        // Marcar verificação
        localStorage.setItem('cities_bootstrap_check', now.toString());
      } catch (error) {
        console.warn('[SilentCityBootstrap] Erro fatal:', error);
      }
    };

    // Executar após 2 segundos para não interferir no boot do app
    const timer = setTimeout(ensureCitiesLoaded, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Componente invisível
  return null;
};
