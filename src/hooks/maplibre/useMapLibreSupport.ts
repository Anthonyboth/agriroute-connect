/**
 * src/hooks/maplibre/useMapLibreSupport.ts
 * 
 * Hook para verificar suporte a MapLibre GL (WebGL).
 * Retorna { supported, reason } para renderizar fallback amigável.
 */

import { useState, useEffect } from 'react';
import maplibregl from 'maplibre-gl';

interface MapLibreSupportResult {
  supported: boolean;
  reason?: string;
  checking: boolean;
}

/**
 * Verifica se o navegador suporta MapLibre GL (WebGL)
 */
export function useMapLibreSupport(): MapLibreSupportResult {
  const [result, setResult] = useState<MapLibreSupportResult>({
    supported: true,
    checking: true,
  });

  useEffect(() => {
    try {
      // Verificação de WebGL diretamente (maplibre-gl v5 não expõe mais supported())
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        setResult({
          supported: false,
          reason: 'Seu navegador não suporta WebGL, necessário para exibir o mapa.',
          checking: false,
        });
        return;
      }

      // Verificação adicional: tentar criar um contexto WebGL2 (preferido pelo MapLibre)
      const gl2 = canvas.getContext('webgl2');
      if (!gl2) {
        // WebGL2 não disponível, mas WebGL1 funciona - ok para continuar
        console.log('[MapLibre] WebGL2 não disponível, usando WebGL1');
      }

      setResult({
        supported: true,
        checking: false,
      });
    } catch (error) {
      console.error('[MapLibre] Erro ao verificar suporte:', error);
      setResult({
        supported: false,
        reason: 'Erro ao verificar compatibilidade do navegador.',
        checking: false,
      });
    }
  }, []);

  return result;
}
