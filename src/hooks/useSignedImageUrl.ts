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

interface UseSignedImageUrlOptions {
  /**
   * Quando true, usa fallback via admin-panel-api para gerar signed URLs
   * com service_role (útil no painel admin, onde o usuário pode não ser owner do arquivo).
   */
  preferAdminApi?: boolean;
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

/** Buckets liberados no endpoint admin-panel-api/signed-url */
const ADMIN_SIGNED_URL_BUCKETS = new Set([
  ...PRIVATE_BUCKETS,
  'vehicle-documents',
]);

const addCacheBuster = (signedUrl: string) => {
  const cacheBuster = `${signedUrl.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
  return `${signedUrl}${cacheBuster}`;
};

/**
 * Extrai bucket e path de uma URL/path do Supabase Storage
 */
const extractStoragePath = (url: string): { bucket: string; path: string } | null => {
  if (!url) return null;

  const trimmedUrl = url.trim();

  // Pattern: /storage/v1/object/sign/{bucket}/{path}?token=...
  const signedMatch = trimmedUrl.match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  }

  // Pattern: /storage/v1/object/public/{bucket}/{path}
  const publicMatch = trimmedUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }

  // Pattern: raw path com bucket no início (ex.: profile-photos/{uid}/file.jpg)
  const normalizedPath = trimmedUrl.replace(/^\/+/, '');
  for (const bucket of ADMIN_SIGNED_URL_BUCKETS) {
    if (normalizedPath.startsWith(`${bucket}/`)) {
      return {
        bucket,
        path: decodeURIComponent(normalizedPath.slice(bucket.length + 1)),
      };
    }
  }

  // Pattern legado comum de selfies (ex.: selfies/{uid}/identity_selfie_x.jpg)
  if (normalizedPath.startsWith('selfies/')) {
    return {
      bucket: 'identity-selfies',
      path: decodeURIComponent(normalizedPath),
    };
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getAccessTokenWithRetry = async (): Promise<string | null> => {
  // Em alguns cenários do painel admin, a sessão ainda não foi hidratada no primeiro render.
  // Fazemos algumas tentativas curtas antes de desistir.
  for (const delay of [0, 250, 800]) {
    if (delay > 0) await wait(delay);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) return token;
  }

  return null;
};

const getAdminSignedUrl = async (bucket: string, path: string): Promise<string | null> => {
  try {
    const token = await getAccessTokenWithRetry();

    if (!token) return null;

    const supabaseUrl =
      (supabase as any).supabaseUrl ||
      import.meta.env.VITE_SUPABASE_URL;

    const apikey =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (supabase as any).supabaseKey;

    if (!supabaseUrl || !apikey) return null;

    const endpoint = `${supabaseUrl}/functions/v1/admin-panel-api/signed-url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return payload?.signedUrl ?? null;
  } catch {
    return null;
  }
};

/**
 * Hook para gerenciar URLs de imagens com suporte a regeneração de URLs assinadas.
 * Gera signed URL automaticamente para buckets privados.
 */
export const useSignedImageUrl = (
  originalUrl: string | null | undefined,
  options?: UseSignedImageUrlOptions,
): SignedUrlResult => {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preferAdminApi = options?.preferAdminApi ?? false;

  const refreshUrl = useCallback(async () => {
    if (!originalUrl) {
      setUrl(null);
      return;
    }

    const storageInfo = extractStoragePath(originalUrl);

    // Não é uma URL/path do storage — usar diretamente
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

    setIsLoading(true);
    setError(null);

    try {
      // 1) Tentativa padrão com RLS do usuário
      const { data, error: signError } = await supabase.storage
        .from(storageInfo.bucket)
        .createSignedUrl(storageInfo.path, 3600); // 1 hora

      if (!signError && data?.signedUrl) {
        setUrl(addCacheBuster(data.signedUrl));
        return;
      }

      // 2) Fallback opcional via admin API (service_role), usado no painel admin
      if (preferAdminApi && ADMIN_SIGNED_URL_BUCKETS.has(storageInfo.bucket)) {
        const adminSignedUrl = await getAdminSignedUrl(storageInfo.bucket, storageInfo.path);
        if (adminSignedUrl) {
          setUrl(addCacheBuster(adminSignedUrl));
          return;
        }
      }

      setError(signError?.message || 'Não foi possível assinar URL da imagem');
      // Fallback final: tenta usar URL original
      setUrl(originalUrl);
    } catch {
      setUrl(originalUrl);
    } finally {
      setIsLoading(false);
    }
  }, [originalUrl, preferAdminApi]);

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
