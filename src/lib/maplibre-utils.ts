/**
 * src/lib/maplibre-utils.ts
 * 
 * Utilitários para MapLibre GL JS no AgriRoute.
 * Inclui animação de marker, cálculo de bounds e formatação de tempo.
 * 
 * NOTA: Esta versão NÃO depende de Google Maps.
 */

import maplibregl from 'maplibre-gl';
import { MAP_COLORS } from '@/config/maplibre';

/**
 * Ícone SVG de caminhão para o marker do motorista
 */
export const TRUCK_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="11" fill="#16a34a" stroke="#15803d" stroke-width="2"/>
  <path d="M5 13L2 8l4-2 3 4z" fill="white" stroke="white" stroke-width="1" transform="translate(5, 4) scale(0.7)"/>
  <rect x="7" y="6" width="8" height="6" rx="1" fill="white" stroke="white" stroke-width="0.5" transform="translate(1, 2) scale(0.8)"/>
  <rect x="14" y="8" width="5" height="4" rx="0.5" fill="white" stroke="white" stroke-width="0.5" transform="translate(0, 2) scale(0.8)"/>
  <circle cx="9" cy="14" r="1.5" fill="#16a34a" stroke="white" stroke-width="0.5" transform="translate(1, 0) scale(0.9)"/>
  <circle cx="16" cy="14" r="1.5" fill="#16a34a" stroke="white" stroke-width="0.5" transform="translate(-1, 0) scale(0.9)"/>
</svg>
`;

/**
 * Ícone SVG para marker de origem
 */
export const ORIGIN_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#22c55e"/>
  <circle cx="16" cy="16" r="6" fill="white"/>
  <text x="16" y="20" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="bold">A</text>
</svg>
`;

/**
 * Ícone SVG para marker de destino
 */
export const DESTINATION_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#ef4444"/>
  <circle cx="16" cy="16" r="6" fill="white"/>
  <text x="16" y="20" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">B</text>
</svg>
`;

/**
 * Cria um elemento HTML para o marker do caminhão
 * 
 * ✅ PADRÃO OURO V2: Elemento raiz com DIMENSÕES FIXAS EM PX.
 * MapLibre usa essas dimensões para calcular o offset do anchor.
 * 
 * CRÍTICO: O root DEVE ter width/height em px, NÃO pode ser 0.
 */
export function createTruckMarkerElement(isOnline: boolean = true): HTMLDivElement {
  // ✅ ELEMENTO RAIZ com dimensões FIXAS - classe CSS define 40x40px
  const root = document.createElement('div');
  root.className = 'truck-marker';
  
  // ✅ FORÇAR dimensões inline como garantia (CSS também define, mas inline tem precedência)
  root.style.width = '40px';
  root.style.height = '40px';
  root.style.display = 'block';
  root.style.boxSizing = 'border-box';
  root.style.lineHeight = '0';
  
  const color = isOnline ? MAP_COLORS.online : MAP_COLORS.offline;
  const svg = TRUCK_ICON_SVG.replace(/#16a34a/g, color).replace(/#15803d/g, color);
  
  // ✅ Wrapper interno
  root.innerHTML = `
    <div class="truck-marker-inner" data-offline="${!isOnline}">
      ${isOnline ? '<div class="truck-marker-pulse"></div>' : ''}
      <div class="truck-marker-icon">
        ${svg}
      </div>
    </div>
  `;
  
  // ✅ Garantir SVG com display block
  const svgEl = root.querySelector('svg');
  if (svgEl) {
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.display = 'block';
    svgEl.style.maxWidth = 'none';
    svgEl.style.maxHeight = 'none';
  }
  
  return root;
}

/**
 * Cria um elemento HTML para marker de origem/destino
 * 
 * ✅ PADRÃO OURO V2: Elemento raiz com DIMENSÕES FIXAS EM PX.
 * O anchor 'bottom' faz a ponta do pin apontar EXATAMENTE para a coordenada.
 * Dimensões: 32x40px (baseado no viewBox do SVG)
 */
export function createLocationMarkerElement(type: 'origin' | 'destination'): HTMLDivElement {
  // ✅ ELEMENTO RAIZ com dimensões FIXAS - classe CSS define 32x40px
  const root = document.createElement('div');
  root.className = 'location-pin-marker';
  
  // ✅ FORÇAR dimensões inline como garantia (CSS também define, mas inline tem precedência)
  root.style.width = '32px';
  root.style.height = '40px';
  root.style.display = 'block';
  root.style.boxSizing = 'border-box';
  root.style.lineHeight = '0';
  
  const svg = type === 'origin' ? ORIGIN_MARKER_SVG : DESTINATION_MARKER_SVG;
  
  // ✅ Wrapper interno
  root.innerHTML = `
    <div class="location-pin-inner">
      ${svg}
    </div>
  `;
  
  // ✅ Garantir SVG com display block
  const svgEl = root.querySelector('svg');
  if (svgEl) {
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.display = 'block';
    svgEl.style.maxWidth = 'none';
    svgEl.style.maxHeight = 'none';
  }
  
  return root;
}

/**
 * Função de easing para animação suave
 */
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * Interpola posição do marker com animação suave
 * Evita "teleporte" do marker entre atualizações
 */
export function interpolatePosition(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  duration: number = 1000,
  onUpdate: (pos: { lat: number; lng: number }) => void,
  onComplete?: () => void
): () => void {
  const startTime = Date.now();
  let animationId: number | null = null;
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuad(progress);
    
    const currentPos = {
      lat: from.lat + (to.lat - from.lat) * eased,
      lng: from.lng + (to.lng - from.lng) * eased
    };
    
    onUpdate(currentPos);
    
    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };
  
  animationId = requestAnimationFrame(animate);
  
  // Retorna função de cancelamento
  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
  };
}

/**
 * Calcula bounds para incluir todos os pontos (MapLibre)
 */
export function calculateBounds(
  points: Array<{ lat: number; lng: number } | null | undefined>
): maplibregl.LngLatBounds | null {
  const validPoints = points.filter((p): p is { lat: number; lng: number } => 
    p !== null && p !== undefined && 
    typeof p.lat === 'number' && typeof p.lng === 'number' &&
    !isNaN(p.lat) && !isNaN(p.lng)
  );
  
  if (validPoints.length === 0) return null;
  
  const bounds = new maplibregl.LngLatBounds();
  validPoints.forEach(point => {
    bounds.extend([point.lng, point.lat]);
  });
  
  return bounds;
}

/**
 * Formata segundos em texto legível
 * Ex: "há 15 segundos", "há 2 minutos"
 */
export function formatSecondsAgo(seconds: number): string {
  if (seconds < 0) return 'agora';
  
  if (seconds < 60) {
    return `há ${Math.floor(seconds)} segundo${Math.floor(seconds) !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `há ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  return `há ${hours} hora${hours !== 1 ? 's' : ''}`;
}

/**
 * Verifica se o motorista está online
 * Threshold padrão: 90 segundos
 */
export function isDriverOnline(lastUpdate: Date | string | null, thresholdMs: number = 90000): boolean {
  if (!lastUpdate) return false;
  
  const lastUpdateDate = typeof lastUpdate === 'string' ? new Date(lastUpdate) : lastUpdate;
  const timeSinceUpdate = Date.now() - lastUpdateDate.getTime();
  
  return timeSinceUpdate < thresholdMs;
}

/**
 * Calcula segundos desde a última atualização
 */
export function getSecondsSinceUpdate(lastUpdate: Date | string | null): number {
  if (!lastUpdate) return Infinity;
  
  const lastUpdateDate = typeof lastUpdate === 'string' ? new Date(lastUpdate) : lastUpdate;
  return Math.floor((Date.now() - lastUpdateDate.getTime()) / 1000);
}

/**
 * Calcula distância Haversine entre dois pontos (em km)
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calcula ETA baseado em distância e velocidade média
 */
export function calculateETA(
  remainingDistanceKm: number,
  averageSpeedKmh: number,
  riskFactor: number = 1.2
): number | null {
  if (averageSpeedKmh <= 0 || remainingDistanceKm < 0) return null;
  
  // ETA em minutos com fator de risco
  const etaMinutes = (remainingDistanceKm / averageSpeedKmh) * 60 * riskFactor;
  
  return Math.ceil(etaMinutes);
}

/**
 * Cria GeoJSON para polyline
 */
export function createLineGeoJSON(
  coordinates: Array<[number, number]> // [lng, lat]
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

/**
 * Cria GeoJSON para heatmap de paradas
 */
export function createStopsHeatmapGeoJSON(
  stops: Array<{ lat: number; lng: number; durationMinutes: number }>
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: stops.map((stop) => ({
      type: 'Feature',
      properties: {
        weight: Math.min(stop.durationMinutes / 60, 1), // Normalizado para 0-1
        duration: stop.durationMinutes,
      },
      geometry: {
        type: 'Point',
        coordinates: [stop.lng, stop.lat],
      },
    })),
  };
}

/**
 * Configuração de layer de heatmap para MapLibre
 */
export const HEATMAP_LAYER_CONFIG: maplibregl.HeatmapLayerSpecification = {
  id: 'stops-heatmap',
  type: 'heatmap',
  source: 'stops',
  maxzoom: 15,
  paint: {
    'heatmap-weight': ['get', 'weight'],
    'heatmap-intensity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      5, 1,
      15, 3,
    ],
    'heatmap-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      5, 10,
      15, 30,
    ],
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0, 'rgba(0,0,0,0)',
      0.3, 'rgba(255,255,0,0.6)',
      0.6, 'rgba(255,165,0,0.8)',
      1, 'rgba(255,0,0,1)',
    ],
  },
};

/**
 * Configuração de layer de linha para rota
 */
export const ROUTE_LINE_LAYER_CONFIG = (
  id: string,
  source: string,
  color: string = MAP_COLORS.route.progress,
  opacity: number = 1
): maplibregl.LineLayerSpecification => ({
  id,
  type: 'line',
  source,
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': color,
    'line-width': 4,
    'line-opacity': opacity,
  },
});
