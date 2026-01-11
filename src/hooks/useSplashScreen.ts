import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook para gerenciar a splash screen nativa do Capacitor
 * Esconde a splash com fade suave após o app estar pronto
 */
export const useSplashScreen = () => {
  useEffect(() => {
    const hideSplash = async () => {
      // Só executa em plataforma nativa (iOS/Android)
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        // Import dinâmico para evitar erros em ambiente web
        const { SplashScreen } = await import('@capacitor/splash-screen');
        
        // Aguardar um momento para garantir que a WebView renderizou
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Esconder splash com fade suave
        await SplashScreen.hide({
          fadeOutDuration: 300
        });
        
        console.log('[SplashScreen] Splash screen ocultada com sucesso');
      } catch (error) {
        console.error('[SplashScreen] Erro ao ocultar splash:', error);
      }
    };

    hideSplash();
  }, []);
};
