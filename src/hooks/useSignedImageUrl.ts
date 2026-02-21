/**
 * Hook para gerar URLs assinadas para imagens do Supabase Storage
 * Lida com buckets privados como identity-selfies, profile-photos, driver-documents
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedUrlResult {
  url: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Buckets que são privados e precisam de signed URL */
const PRIVATE_BUCKETS = new Set([
  'profile-photos',
  'identity-selfies',
  'driver-documents',
  'chat-images',
  'proposal-chat-images',
  'service-chat-images',
  'mdfe-dactes',
  'freight-checkins',
  'freight-attachments',
]);

/**
 * Extrai bucket e path de uma URL do Supabase Storage
 */
const extractStoragePath = (url: string): { bucket: string; path: string } | null => {
  if (!url) return null;
  
  // Pattern: /storage/v1/object/sign/{bucket}/{path}?token=...
  const signedMatch = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  }
  
  // Pattern: /storage/v1/object/public/{bucket}/{path}
  const publicMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }
  
  return null;
};

/**
 * Verifica se uma URL assinada ainda é válida (com margem de 5 min)
 */
const isSignedUrlValid = (url: string): boolean => {
  try {
    const tokenMatch = url.match(/token=([^&]+)/);
    if (!tokenMatch) return false;
    
    const token = tokenMatch[1];
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    if (!exp) return false;
    
    // Válido se faltam mais de 5 minutos
    return Date.now() / 1000 < exp - 300;
  } catch {
    return false;
  }
};

/**
 * Hook para gerenciar URLs de imagens com suporte a regeneração de URLs assinadas.
 * Gera signed URL automaticamente para buckets privados.
 */
export const useSignedImageUrl = (originalUrl: string | null | undefined): SignedUrlResult => {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUrl = useCallback(async () => {
    if (!originalUrl) {
      setUrl(null);
      return;
    }

    const storageInfo = extractStoragePath(originalUrl);
    
    // Não é uma URL do storage — usar diretamente
    if (!storageInfo) {
      setUrl(originalUrl);
      return;
    }

    // Se é um bucket privado OU a URL já é signed, precisamos de signed URL
    const needsSignedUrl = PRIVATE_BUCKETS.has(storageInfo.bucket) || originalUrl.includes('/object/sign/');

    if (!needsSignedUrl) {
      setUrl(originalUrl);
      return;
    }

    // Se já é uma signed URL válida, reutilizar
    if (isSignedUrlValid(originalUrl)) {
      setUrl(originalUrl);
      return;
    }

    // Gerar nova signed URL
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useSignedImageUrl] Gerando signed URL para:', storageInfo.bucket, storageInfo.path);
      
      const { data, error: signError } = await supabase.storage
        .from(storageInfo.bucket)
        .createSignedUrl(storageInfo.path, 3600); // 1 hora

      if (signError) {
        console.warn('[useSignedImageUrl] Erro ao gerar signed URL:', signError);
        setError(signError.message);
        // Fallback: tentar URL original
        setUrl(originalUrl);
      } else if (data?.signedUrl) {
        console.log('[useSignedImageUrl] Signed URL gerada com sucesso para:', storageInfo.bucket);
        // Adicionar cache-buster para evitar cache de respostas 403 anteriores
        const cacheBuster = `${data.signedUrl.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
        setUrl(data.signedUrl + cacheBuster);
      } else {
        setUrl(originalUrl);
      }
    } catch (e) {
      console.warn('[useSignedImageUrl] Exceção ao gerar signed URL:', e);
      setUrl(originalUrl);
    } finally {
      setIsLoading(false);
    }
  }, [originalUrl]);

  useEffect(() => {
    refreshUrl();
  }, [refreshUrl]);

  return { url, isLoading, error, refresh: refreshUrl };
};

/**
 * Helper para obter URL da foto do motorista
 */
export const getDriverPhotoUrl = (driver: { 
  profile_photo_url?: string | null; 
  selfie_url?: string | null; 
} | null | undefined): string | null => {
  if (!driver) return null;
  return driver.profile_photo_url || driver.selfie_url || null;
};
