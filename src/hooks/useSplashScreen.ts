import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook para gerenciar a splash screen nativa do Capacitor
 * Esconde a splash com fade suave após o app estar pronto
 * 
 * IMPORTANTE: Inclui timeout de segurança (fallback) para garantir
 * que a splash SEMPRE será escondida, mesmo se o boot travar.
 */
export const useSplashScreen = () => {
  const [isHidden, setIsHidden] = useState(false);
  const hiddenRef = useRef(false);

  useEffect(() => {
    if (hiddenRef.current) return;

    const doHide = async () => {
      if (hiddenRef.current) return;
      hiddenRef.current = true;

      if (!Capacitor.isNativePlatform()) {
        setIsHidden(true);
        return;
      }

      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        
        // Aguardar DOM estar renderizado
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });

        // Delay para React renderizar
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await SplashScreen.hide({ fadeOutDuration: 500 });
        setIsHidden(true);
        console.log('[SplashScreen] ✅ Splash screen ocultada com sucesso');
      } catch (error) {
        console.error('[SplashScreen] ❌ Erro ao ocultar splash:', error);
        setIsHidden(true);
      }
    };

    // Timer normal: esconde após 100ms
    const timer = setTimeout(doHide, 100);

    // ✅ FALLBACK DE SEGURANÇA: Se o boot travar, esconde a splash após 8s
    // Isso garante que o app NUNCA fica preso na splash screen
    const fallbackTimer = setTimeout(async () => {
      if (hiddenRef.current) return;
      console.warn('[SplashScreen] ⚠️ Fallback ativado - escondendo splash após timeout');
      hiddenRef.current = true;

      if (Capacitor.isNativePlatform()) {
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          await SplashScreen.hide({ fadeOutDuration: 300 });
        } catch {}
      }
      setIsHidden(true);
    }, 8000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return { isHidden };
};
