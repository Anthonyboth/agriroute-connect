/**
 * src/hooks/maplibre/useMapLibreMarkers.ts
 * 
 * Hook para gerenciamento eficiente de markers no MapLibre.
 * 
 * Features:
 * - Atualiza markers sem recriar o mapa
 * - Remove markers antigos corretamente
 * - Suporta popup opcional
 * - Evita re-render pesado (comparação por ID)
 * - Suporta factory de elementos customizados
 */

import { useRef, useEffect, MutableRefObject, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';

export interface MapLibreMarkerData {
  /** ID único do marker */
  id: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** HTML do popup (opcional) */
  popup?: string;
  /** Elemento customizado (opcional) */
  element?: HTMLElement;
  /** Opções do popup */
  popupOptions?: maplibregl.PopupOptions;
}

export interface UseMapLibreMarkersOptions {
  /** Offset padrão do popup */
  popupOffset?: number;
  /** Factory para criar elementos de marker */
  markerFactory?: (marker: MapLibreMarkerData) => HTMLElement | undefined;
  /** Callback quando marker é clicado */
  onMarkerClick?: (marker: MapLibreMarkerData) => void;
}

export interface UseMapLibreMarkersResult {
  /** Mapa de markers ativos (id -> Marker) */
  markersMap: Map<string, maplibregl.Marker>;
  /** Atualiza a posição de um marker específico */
  updatePosition: (id: string, lat: number, lng: number) => void;
  /** Remove todos os markers */
  clearAll: () => void;
  /** Força atualização do popup de um marker */
  updatePopup: (id: string, html: string) => void;
}

/**
 * Hook para gerenciar markers de forma eficiente
 */
export function useMapLibreMarkers(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  markers: MapLibreMarkerData[],
  options: UseMapLibreMarkersOptions = {}
): UseMapLibreMarkersResult {
  const { popupOffset = 25, markerFactory, onMarkerClick } = options;
  const markersMapRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupsMapRef = useRef<Map<string, maplibregl.Popup>>(new Map());

  /**
   * ✅ REGRA SEM EXCEÇÕES: normalizar toda coordenada antes de usar no mapa.
   * Isso evita lat/lng invertidos e coordenadas em micrograus (1e5/1e6/1e7).
   */
  const normalizeMarker = useCallback((m: MapLibreMarkerData): MapLibreMarkerData | null => {
    const lat = Number(m.lat);
    const lng = Number(m.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const normalized = normalizeLatLngPoint({ lat, lng }, 'BR', { silent: true });
    const point = normalized ?? { lat, lng };
    return { ...m, lat: point.lat, lng: point.lng };
  }, []);

  // Atualizar markers quando a lista mudar
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Normalização obrigatória (antes de qualquer cálculo/uso)
    const normalizedMarkers = markers
      .map((m) => normalizeMarker(m))
      .filter((m): m is MapLibreMarkerData => Boolean(m));

    const currentIds = new Set(normalizedMarkers.map((m) => m.id));
    const existingIds = new Set(markersMapRef.current.keys());

    // Remover markers que não existem mais
    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const marker = markersMapRef.current.get(id);
        if (marker) {
          marker.remove();
          markersMapRef.current.delete(id);
        }
        const popup = popupsMapRef.current.get(id);
        if (popup) {
          popup.remove();
          popupsMapRef.current.delete(id);
        }
      }
    });

    // Adicionar/atualizar markers
    normalizedMarkers.forEach((markerData) => {
      const existing = markersMapRef.current.get(markerData.id);

      if (existing) {
        // Atualizar posição se mudou
        const currentPos = existing.getLngLat();
        if (currentPos.lng !== markerData.lng || currentPos.lat !== markerData.lat) {
          existing.setLngLat([markerData.lng, markerData.lat]);
        }

        // Atualizar popup se mudou
        if (markerData.popup) {
          const popup = popupsMapRef.current.get(markerData.id);
          if (popup) {
            popup.setHTML(markerData.popup);
          }
        }
      } else {
        // Criar novo marker
        const element = markerData.element || markerFactory?.(markerData);

        // ✅ CRÍTICO: Usar anchor 'bottom' para pins e 'center' para ícones circulares
        // Isso garante que a ponta do pin fique EXATAMENTE na coordenada lat/lng
        const markerOptions: maplibregl.MarkerOptions = {
          element,
          // Default anchor é 'center', mas pins precisam de 'bottom'
          // O markerFactory deve retornar elementos com a classe apropriada
          anchor: element?.classList.contains('truck-marker') ? 'center' : 'bottom',
        };

        const markerInstance = new maplibregl.Marker(markerOptions)
          .setLngLat([markerData.lng, markerData.lat])
          .addTo(map);

        // Popup
        if (markerData.popup) {
          const popup = new maplibregl.Popup({
            offset: popupOffset,
            ...markerData.popupOptions,
          }).setHTML(markerData.popup);

          markerInstance.setPopup(popup);
          popupsMapRef.current.set(markerData.id, popup);
        }

        // Click handler
        if (onMarkerClick && element) {
          element.addEventListener('click', () => {
            onMarkerClick(markerData);
          });
        }

        markersMapRef.current.set(markerData.id, markerInstance);
      }
    });
  }, [markers, normalizeMarker, mapRef.current, popupOffset, markerFactory, onMarkerClick]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      markersMapRef.current.forEach((marker) => marker.remove());
      markersMapRef.current.clear();
      popupsMapRef.current.forEach((popup) => popup.remove());
      popupsMapRef.current.clear();
    };
  }, []);

  const updatePosition = useCallback((id: string, lat: number, lng: number) => {
    const marker = markersMapRef.current.get(id);
    if (marker) {
      const normalized = normalizeLatLngPoint({ lat, lng }, 'BR', { silent: true });
      const point = normalized ?? { lat, lng };
      marker.setLngLat([point.lng, point.lat]);
    }
  }, []);

  const clearAll = useCallback(() => {
    markersMapRef.current.forEach((marker) => marker.remove());
    markersMapRef.current.clear();
    popupsMapRef.current.forEach((popup) => popup.remove());
    popupsMapRef.current.clear();
  }, []);

  const updatePopup = useCallback((id: string, html: string) => {
    const popup = popupsMapRef.current.get(id);
    if (popup) {
      popup.setHTML(html);
    }
  }, []);

  return {
    markersMap: markersMapRef.current,
    updatePosition,
    clearAll,
    updatePopup,
  };
}
