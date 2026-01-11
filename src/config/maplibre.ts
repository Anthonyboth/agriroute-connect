/**
 * Configuração centralizada do MapLibre GL JS
 * 
 * MapLibre é uma biblioteca open-source para mapas vetoriais.
 * Não requer API Key ou billing - 100% gratuito.
 */

// URL do estilo rural customizado
export const RURAL_STYLE_URL = '/styles/rural-dark.json';

// Estilo inline para fallback (caso o JSON não carregue)
export const RURAL_STYLE_INLINE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'AgriRoute Rural',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-brightness-min': 0.2,
        'raster-brightness-max': 0.8,
        'raster-saturation': -0.4,
        'raster-contrast': 0.3,
      },
    },
  ],
};

// Centro padrão do Brasil
export const DEFAULT_CENTER: [number, number] = [-51.925, -14.235]; // [lng, lat]
export const DEFAULT_ZOOM = 5;

// Configurações de tiles alternativos (gratuitos)
export const TILE_PROVIDERS = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  osmHot: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  // Carto (gratuito com atribuição)
  cartoLight: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  cartoDark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
} as const;

// Cores do tema para markers e polylines
export const MAP_COLORS = {
  primary: '#16a34a', // Verde agrícola
  secondary: '#94a3b8', // Cinza slate
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  online: '#22c55e',
  offline: '#6b7280',
  route: {
    full: '#94a3b8',
    progress: '#16a34a',
    remaining: '#cbd5e1',
  },
  heatmap: {
    low: 'rgba(255, 255, 0, 0.6)',
    medium: 'rgba(255, 165, 0, 0.8)',
    high: 'rgba(255, 0, 0, 1)',
  },
} as const;

// Validação da configuração
export const isMapLibreConfigured = (): boolean => {
  // MapLibre não precisa de API Key, sempre configurado
  return true;
};
