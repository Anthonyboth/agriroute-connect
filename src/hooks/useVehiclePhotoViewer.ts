/**
 * useVehiclePhotoViewer.ts
 * 
 * Hook dedicado para gerenciar visualização de fotos de veículo.
 * Responsável por:
 * - Gerenciar estado de zoom/galeria
 * - Navegação entre fotos
 * - Controle de modal de zoom
 * 
 * CRÍTICO: Este hook é essencial para produtores visualizarem
 * os veículos dos motoristas antes de aceitar fretes.
 */

import { useState, useCallback, useMemo } from 'react';

export interface VehiclePhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  created_at: string;
}

interface PhotoViewerState {
  isOpen: boolean;
  currentIndex: number;
  photos: VehiclePhoto[];
}

interface UseVehiclePhotoViewerResult {
  // Estado do visualizador
  viewerState: PhotoViewerState;
  currentPhoto: VehiclePhoto | null;
  
  // Ações
  openPhoto: (photos: VehiclePhoto[], index: number) => void;
  closeViewer: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
  
  // Utilitários
  hasNext: boolean;
  hasPrevious: boolean;
  totalPhotos: number;
  getPhotoTypeLabel: (photoType: string) => string;
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  'frontal': 'Frente',
  'front': 'Frente',
  'traseira': 'Traseira',
  'back': 'Traseira',
  'lateral': 'Lateral',
  'side': 'Lateral',
  'interior': 'Interior',
  'carroceria': 'Carroceria',
  'cargo': 'Carroceria',
  'placa': 'Placa',
  'document': 'Documento',
  'geral': 'Geral',
  'general': 'Geral',
};

export const useVehiclePhotoViewer = (): UseVehiclePhotoViewerResult => {
  const [viewerState, setViewerState] = useState<PhotoViewerState>({
    isOpen: false,
    currentIndex: 0,
    photos: [],
  });

  const currentPhoto = useMemo(() => {
    if (!viewerState.isOpen || viewerState.photos.length === 0) {
      return null;
    }
    return viewerState.photos[viewerState.currentIndex] || null;
  }, [viewerState.isOpen, viewerState.photos, viewerState.currentIndex]);

  const hasNext = viewerState.currentIndex < viewerState.photos.length - 1;
  const hasPrevious = viewerState.currentIndex > 0;
  const totalPhotos = viewerState.photos.length;

  const openPhoto = useCallback((photos: VehiclePhoto[], index: number) => {
    if (photos.length === 0) return;
    
    const safeIndex = Math.max(0, Math.min(index, photos.length - 1));
    
    setViewerState({
      isOpen: true,
      currentIndex: safeIndex,
      photos,
    });
  }, []);

  const closeViewer = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const goToNext = useCallback(() => {
    setViewerState(prev => {
      if (prev.currentIndex >= prev.photos.length - 1) return prev;
      return {
        ...prev,
        currentIndex: prev.currentIndex + 1,
      };
    });
  }, []);

  const goToPrevious = useCallback(() => {
    setViewerState(prev => {
      if (prev.currentIndex <= 0) return prev;
      return {
        ...prev,
        currentIndex: prev.currentIndex - 1,
      };
    });
  }, []);

  const goToIndex = useCallback((index: number) => {
    setViewerState(prev => {
      const safeIndex = Math.max(0, Math.min(index, prev.photos.length - 1));
      return {
        ...prev,
        currentIndex: safeIndex,
      };
    });
  }, []);

  const getPhotoTypeLabel = useCallback((photoType: string): string => {
    const normalized = photoType.toLowerCase();
    return PHOTO_TYPE_LABELS[normalized] || photoType;
  }, []);

  return {
    viewerState,
    currentPhoto,
    openPhoto,
    closeViewer,
    goToNext,
    goToPrevious,
    goToIndex,
    hasNext,
    hasPrevious,
    totalPhotos,
    getPhotoTypeLabel,
  };
};

export default useVehiclePhotoViewer;
