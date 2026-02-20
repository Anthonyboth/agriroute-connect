/**
 * src/components/map/MapLibreSmokeTest.tsx
 * 
 * Componente de smoke test para MapLibre.
 * Renderiza um mapa PURO sem hooks personalizados, sem watchdog,
 * sem contain CSS, sem markers — apenas MapLibre básico.
 * 
 * Se este componente renderizar tiles, o problema está nos hooks/CSS do app.
 * Se ficar branco, o problema é no MapLibre/CSS/rede/CSP.
 * 
 * ⚠️ USO: Apenas para diagnóstico. Remover após confirmar causa raiz.
 */

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RURAL_STYLE_INLINE, DEFAULT_CENTER } from '@/config/maplibre';

export function MapLibreSmokeTest() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    console.log('[SmokeTest] Criando mapa...', {
      container: containerRef.current,
      rect: containerRef.current.getBoundingClientRect(),
    });

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: RURAL_STYLE_INLINE,
      center: DEFAULT_CENTER,
      zoom: 4,
    });

    map.on('load', () => {
      console.log('[SmokeTest] ✅ LOAD disparado', {
        styleLoaded: map.isStyleLoaded(),
        tilesLoaded: map.areTilesLoaded(),
        canvasW: map.getCanvas().width,
        canvasH: map.getCanvas().height,
        styleName: map.getStyle()?.name,
      });
    });

    map.on('idle', () => {
      console.log('[SmokeTest] ✅ IDLE - mapa renderizando');
    });

    map.on('error', (e) => {
      console.error('[SmokeTest] ❌ ERRO:', e.error?.message);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ padding: '16px', background: '#f0f0f0', borderRadius: '8px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
        🧪 MapLibre Smoke Test — Verificar console para diagnóstico
      </p>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '2px dashed #999',
        }}
      />
    </div>
  );
}

export default MapLibreSmokeTest;
