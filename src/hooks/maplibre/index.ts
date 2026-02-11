/**
 * src/hooks/maplibre/index.ts
 * 
 * Índice de hooks MapLibre para o AgriRoute.
 * Arquitetura padronizada para mapas estáveis e performáticos.
 */

// Verificação de suporte WebGL
export { useMapLibreSupport } from './useMapLibreSupport';

// Inicialização estável do mapa
export { useMapLibreMap, type UseMapLibreMapOptions, type UseMapLibreMapResult } from './useMapLibreMap';

// Auto-resize para containers dinâmicos (inclui resize burst para Drawers)
export { useMapLibreAutoResize } from './useMapLibreAutoResize';

// ✅ Tile Watchdog: fallback automático quando tiles falham
export { useTileWatchdog } from './useTileWatchdog';

// ✅ NOVO: Gerenciamento de markers via GeoJSON layers (sem DOM Markers)
// Usar ESTE hook ao invés de useMapLibreMarkers para evitar flutuação em Drawers
export { 
  useMapLibreGeoJSONLayers, 
  type GeoJSONMarkerData, 
  type UseMapLibreGeoJSONLayersOptions, 
  type UseMapLibreGeoJSONLayersResult 
} from './useMapLibreGeoJSONLayers';

// ⚠️ DEPRECATED: Gerenciamento de markers via DOM (causa flutuação em Drawers com transform)
// Mantido apenas para compatibilidade - preferir useMapLibreGeoJSONLayers
export { useMapLibreMarkers, type MapLibreMarkerData, type UseMapLibreMarkersOptions, type UseMapLibreMarkersResult } from './useMapLibreMarkers';

// Controles de navegação (pan, zoom, bounds)
export { useMapLibreControls, type UseMapLibreControlsOptions, type UseMapLibreControlsResult } from './useMapLibreControls';

// Utilitário para requestAnimationFrame/setTimeout seguros
export { useMapLibreSafeRaf } from './useMapLibreSafeRaf';

// 🚗 Roteamento OSRM (rotas reais por estradas)
export { 
  useOSRMRoute, 
  fetchOSRMRoute,
  type RoutePoint, 
  type OSRMRouteResult, 
  type UseOSRMRouteOptions, 
  type UseOSRMRouteResult 
} from './useOSRMRoute';

// 🗺️ Desenho de rotas no MapLibre
export { 
  useMapLibreRoute,
  type UseMapLibreRouteOptions,
  type UseMapLibreRouteResult
} from './useMapLibreRoute';
