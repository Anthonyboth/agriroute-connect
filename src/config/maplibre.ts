/**
 * Configuração centralizada do MapLibre GL JS
 * 
 * MapLibre é uma biblioteca open-source para mapas vetoriais.
 * Não requer API Key ou billing - 100% gratuito.
 */

// ✅ PRIORIDADE 3: URL do estilo rural customizado usando BASE_URL para Capacitor
export const RURAL_STYLE_URL = `${import.meta.env.BASE_URL}styles/rural-dark.json`;

// Estilo inline para fallback (caso o JSON não carregue)
// ✅ SEM glyphs — raster puro, funciona em qualquer ambiente
export const RURAL_STYLE_INLINE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'AgriRoute Rural Fallback',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: 'carto-base',
      type: 'raster',
      source: 'carto',
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
