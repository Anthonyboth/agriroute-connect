import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook para gerenciar a splash screen nativa do Capacitor
 * Esconde a splash com fade suave após o app estar COMPLETAMENTE pronto
 * 
 * IMPORTANTE: Este hook deve ser chamado APENAS uma vez no App.tsx
 * para evitar múltiplas chamadas de hide()
 */
export const useSplashScreen = () => {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    // Evitar múltiplas execuções
    if (isHidden) return;

    const hideSplash = async () => {
      // Só executa em plataforma nativa (iOS/Android)
      if (!Capacitor.isNativePlatform()) {
        setIsHidden(true);
        return;
      }

      try {
        // Import dinâmico para evitar erros em ambiente web
        const { SplashScreen } = await import('@capacitor/splash-screen');
        
        // Aguardar DOM estar completamente renderizado
        // Usar requestAnimationFrame para garantir que o browser pintou
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });

        // Delay adicional para garantir que React renderizou tudo
        // Crítico: Este delay elimina a tela preta entre splash e WebView
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Esconder splash com fade longo e suave
        await SplashScreen.hide({
          fadeOutDuration: 500
        });
        
        setIsHidden(true);
        console.log('[SplashScreen] ✅ Splash screen ocultada com sucesso');
      } catch (error) {
        console.error('[SplashScreen] ❌ Erro ao ocultar splash:', error);
        setIsHidden(true);
      }
    };

    // Usar timeout para garantir que o app teve tempo de inicializar
    const timer = setTimeout(hideSplash, 100);
    
    return () => clearTimeout(timer);
  }, [isHidden]);

  return { isHidden };
};
