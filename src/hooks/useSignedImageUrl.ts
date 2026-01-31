/**
 * Hook para gerar URLs assinadas para imagens do Supabase Storage
 * Lida com buckets privados como identity-selfies
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedUrlResult {
  url: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

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
 * Verifica se uma URL assinada ainda é válida
 */
const isSignedUrlExpired = (url: string): boolean => {
  try {
    const tokenMatch = url.match(/token=([^&]+)/);
    if (!tokenMatch) return false;
    
    const token = tokenMatch[1];
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    if (!exp) return false;
    
    // Adicionar margem de 5 minutos
    return Date.now() / 1000 > exp - 300;
  } catch {
    return false;
  }
};

/**
 * Hook para gerenciar URLs de imagens com suporte a regeneração de URLs assinadas
 */
export const useSignedImageUrl = (originalUrl: string | null | undefined): SignedUrlResult => {
  const [url, setUrl] = useState<string | null>(originalUrl || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUrl = useCallback(async () => {
    if (!originalUrl) {
      setUrl(null);
      return;
    }

    // Se a URL não é do storage ou não expirou, usar a original
    const storageInfo = extractStoragePath(originalUrl);
    if (!storageInfo) {
      setUrl(originalUrl);
      return;
    }

    // Verificar se precisa regenerar
    if (!isSignedUrlExpired(originalUrl)) {
      setUrl(originalUrl);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signError } = await supabase.storage
        .from(storageInfo.bucket)
        .createSignedUrl(storageInfo.path, 3600); // 1 hora

      if (signError) {
        console.warn('[useSignedImageUrl] Erro ao gerar signed URL:', signError);
        setError(signError.message);
        // Tentar usar a URL original mesmo assim
        setUrl(originalUrl);
      } else if (data?.signedUrl) {
        setUrl(data.signedUrl);
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
 * Componente Avatar robusto para motoristas com suporte a URLs assinadas
 */
export const getDriverPhotoUrl = (driver: { 
  profile_photo_url?: string | null; 
  selfie_url?: string | null; 
} | null | undefined): string | null => {
  if (!driver) return null;
  return driver.profile_photo_url || driver.selfie_url || null;
};
