import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

const isLikelyNativeContext = (): boolean => {
  if (typeof window === 'undefined') return false;

  return (
    (window as any).Capacitor?.isNativePlatform?.() === true ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port)
  );
};

const isSplashPluginAvailable = (): boolean => {
  try {
    const globalCap = (window as any)?.Capacitor;
    if (typeof globalCap?.isPluginAvailable === 'function') {
      return globalCap.isPluginAvailable('SplashScreen') === true;
    }

    const capacitorAny = Capacitor as any;
    if (typeof capacitorAny?.isPluginAvailable === 'function') {
      return capacitorAny.isPluginAvailable('SplashScreen') === true;
    }
  } catch {
    // ignore
  }

  return false;
};

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

      if (!isLikelyNativeContext()) {
        setIsHidden(true);
        return;
      }

      if (!isSplashPluginAvailable()) {
        console.warn('[SplashScreen] Plugin indisponível no runtime nativo; hide manual será ignorado.');
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
        console.warn('[SplashScreen] Plugin não disponível, ignorando:', error);
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

      if (isLikelyNativeContext() && isSplashPluginAvailable()) {
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          await SplashScreen.hide({ fadeOutDuration: 300 });
        } catch {
          // ignore
        }
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
