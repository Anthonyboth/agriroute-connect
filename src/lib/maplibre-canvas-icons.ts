/**
 * src/lib/maplibre-canvas-icons.ts
 * 
 * Converte SVGs de markers para ImageData que pode ser registrado
 * via map.addImage() no MapLibre GL JS.
 * 
 * Isso faz os markers serem renderizados NO CANVAS WebGL,
 * tornando-os imunes a CSS transforms de Drawer/Dialog.
 */

import { MAP_COLORS } from '@/config/maplibre';

// ==================== SVG Templates ====================

const ORIGIN_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 32 40">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#22c55e"/>
  <circle cx="16" cy="16" r="6" fill="white"/>
  <text x="16" y="20" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="bold" font-family="Arial,sans-serif">A</text>
</svg>`;

const DESTINATION_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 32 40">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#ef4444"/>
  <circle cx="16" cy="16" r="6" fill="white"/>
  <text x="16" y="20" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold" font-family="Arial,sans-serif">B</text>
</svg>`;

function createTruckSVG(color: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="11" fill="${color}" stroke="${color}" stroke-width="2"/>
  <path d="M5 13L2 8l4-2 3 4z" fill="white" stroke="white" stroke-width="1" transform="translate(5, 4) scale(0.7)"/>
  <rect x="7" y="6" width="8" height="6" rx="1" fill="white" stroke="white" stroke-width="0.5" transform="translate(1, 2) scale(0.8)"/>
  <rect x="14" y="8" width="5" height="4" rx="0.5" fill="white" stroke="white" stroke-width="0.5" transform="translate(0, 2) scale(0.8)"/>
  <circle cx="9" cy="14" r="1.5" fill="${color}" stroke="white" stroke-width="0.5" transform="translate(1, 0) scale(0.9)"/>
  <circle cx="16" cy="14" r="1.5" fill="${color}" stroke="white" stroke-width="0.5" transform="translate(-1, 0) scale(0.9)"/>
</svg>`;
}

// ==================== SVG to ImageData ====================

function svgToImageData(
  svgString: string,
  width: number,
  height: number,
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(imageData);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}

// ==================== Public API ====================

export interface MapIconRegistration {
  id: string;
  imageData: ImageData;
  width: number;
  height: number;
}

/**
 * Gera todas as imagens de markers para registrar no mapa.
 * Chamar uma vez no map.on('load').
 */
export async function generateMarkerIcons(): Promise<MapIconRegistration[]> {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  
  const pinW = Math.round(32 * pixelRatio);
  const pinH = Math.round(40 * pixelRatio);
  const truckSize = Math.round(40 * pixelRatio);

  const [originData, destinationData, truckOnlineData, truckOfflineData] = await Promise.all([
    svgToImageData(ORIGIN_PIN_SVG, pinW, pinH),
    svgToImageData(DESTINATION_PIN_SVG, pinW, pinH),
    svgToImageData(createTruckSVG(MAP_COLORS.online), truckSize, truckSize),
    svgToImageData(createTruckSVG(MAP_COLORS.offline), truckSize, truckSize),
  ]);

  return [
    { id: 'origin-pin', imageData: originData, width: pinW, height: pinH },
    { id: 'destination-pin', imageData: destinationData, width: pinW, height: pinH },
    { id: 'truck-online', imageData: truckOnlineData, width: truckSize, height: truckSize },
    { id: 'truck-offline', imageData: truckOfflineData, width: truckSize, height: truckSize },
  ];
}

// ==================== GeoJSON Helpers ====================

export interface MarkerFeature {
  type: 'Feature';
  properties: {
    id: string;
    icon: string;
    markerType: 'origin' | 'destination' | 'truck-online' | 'truck-ghost';
    label?: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export function buildMarkersFeatureCollection(
  origin: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number } | null,
  driver: { lat: number; lng: number } | null,
  isDriverOnline: boolean,
): GeoJSON.FeatureCollection {
  const features: MarkerFeature[] = [];

  if (origin) {
    features.push({
      type: 'Feature',
      properties: {
        id: 'origin',
        icon: 'origin-pin',
        markerType: 'origin',
        label: 'Origem (A)',
      },
      geometry: {
        type: 'Point',
        coordinates: [origin.lng, origin.lat],
      },
    });
  }

  if (destination) {
    features.push({
      type: 'Feature',
      properties: {
        id: 'destination',
        icon: 'destination-pin',
        markerType: 'destination',
        label: 'Destino (B)',
      },
      geometry: {
        type: 'Point',
        coordinates: [destination.lng, destination.lat],
      },
    });
  }

  if (driver) {
    features.push({
      type: 'Feature',
      properties: {
        id: 'driver',
        icon: isDriverOnline ? 'truck-online' : 'truck-offline',
        markerType: isDriverOnline ? 'truck-online' : 'truck-ghost',
        label: isDriverOnline ? '🚛 Motorista (Online)' : '🔴 Última posição conhecida',
      },
      geometry: {
        type: 'Point',
        coordinates: [driver.lng, driver.lat],
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
