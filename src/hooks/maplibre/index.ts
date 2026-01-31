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

// Auto-resize para containers dinâmicos
export { useMapLibreAutoResize } from './useMapLibreAutoResize';

// Gerenciamento de markers
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
