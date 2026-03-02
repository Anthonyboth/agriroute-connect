/**
 * src/hooks/useRequesterStatus.ts
 * 
 * Hook para verificar o status de cadastro do solicitante de um frete.
 * Determina se é um usuário registrado ou um convidado (guest).
 * 
 * Regras:
 * - REGISTERED: producer_id existe E profile existe
 * - GUEST: is_guest_freight=true OU prospect_user_id preenchido OU producer_id é null
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type RequesterType = 'REGISTERED' | 'GUEST' | 'UNKNOWN';

export interface RequesterStatus {
  type: RequesterType;
  hasRegistration: boolean;
  producerId: string | null;
  producerName: string | null;
  producerStatus: string | null;
  producerPhotoUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

interface RequesterStatusOptions {
  /**
   * Se deve buscar o status automaticamente ao montar
   * @default true
   */
  autoFetch?: boolean;
  /**
   * Dados do produtor já disponíveis (evita fetch desnecessário)
   */
  producer?: {
    id?: string;
    full_name?: string;
    status?: string;
    profile_photo_url?: string;
  } | null;
  /**
   * Flag indicando que é um frete de convidado
   */
  isGuestFreight?: boolean;
  /**
   * ID do produtor (se disponível)
   */
  producerId?: string | null;
}

/**
 * Hook para verificar o status de cadastro do solicitante
 */
export function useRequesterStatus(
  freightId: string | undefined | null,
  options: RequesterStatusOptions = {}
): RequesterStatus {
  const { 
    autoFetch = true, 
    producer, 
    isGuestFreight,
    producerId 
  } = options;

  const [status, setStatus] = useState<RequesterStatus>({
    type: 'UNKNOWN',
    hasRegistration: false,
    producerId: null,
    producerName: null,
    producerStatus: null,
    producerPhotoUrl: null,
    isLoading: false,
    error: null,
  });

  // ✅ Resolver localmente se temos dados do produtor
  const localResolution = useMemo(() => {
    // Se é explicitamente guest freight
    if (isGuestFreight === true) {
      return {
        type: 'GUEST' as RequesterType,
        hasRegistration: false,
        producerId: producerId ?? null,
        producerName: null,
        producerStatus: null,
        producerPhotoUrl: null,
      };
    }

    // Se temos dados do produtor já carregados
    if (producer && producer.id) {
      return {
        type: 'REGISTERED' as RequesterType,
        hasRegistration: true,
        producerId: producer.id,
        producerName: producer.full_name ?? null,
        producerStatus: producer.status ?? null,
        producerPhotoUrl: producer.profile_photo_url ?? null,
      };
    }

    // Se temos producerId mas sem dados do producer object
    if (producerId && !producer) {
      return null; // Precisa buscar
    }

    // Se não temos producerId, é guest
    if (!producerId && producer === null) {
      return {
        type: 'GUEST' as RequesterType,
        hasRegistration: false,
        producerId: null,
        producerName: null,
        producerStatus: null,
        producerPhotoUrl: null,
      };
    }

    return null; // Precisa buscar via API
  }, [producer, isGuestFreight, producerId]);

  // ✅ Aplicar resolução local imediatamente
  useEffect(() => {
    if (localResolution) {
      setStatus(prev => ({
        ...prev,
        ...localResolution,
        isLoading: false,
        error: null,
      }));
    }
  }, [localResolution]);

  // ✅ Fetch direto do banco como primeira tentativa, edge function como fallback
  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    if (!freightId) return;
    if (localResolution) return;

    setStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (signal?.aborted) return;

      // ✅ PASSO 1: Buscar direto do banco (rápido, sem edge function)
      const { data: freightData } = await supabase
        .from('freights')
        .select('producer_id, is_guest_freight')
        .eq('id', freightId)
        .maybeSingle();

      if (signal?.aborted) return;

      if (freightData?.is_guest_freight) {
        setStatus({
          type: 'GUEST',
          hasRegistration: false,
          producerId: freightData.producer_id ?? null,
          producerName: null,
          producerStatus: null,
          producerPhotoUrl: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      if (freightData?.producer_id) {
        // Buscar dados do produtor direto da view segura
        const { data: producerData } = await supabase
          .from('profiles_secure')
          .select('id, full_name, status, profile_photo_url')
          .eq('id', freightData.producer_id)
          .maybeSingle();

        if (signal?.aborted) return;

        if (producerData) {
          setStatus({
            type: 'REGISTERED',
            hasRegistration: true,
            producerId: producerData.id,
            producerName: producerData.full_name ?? null,
            producerStatus: producerData.status ?? null,
            producerPhotoUrl: producerData.profile_photo_url ?? null,
            isLoading: false,
            error: null,
          });
          return;
        }
      }

      // ✅ PASSO 2: Fallback para edge function com timeout de 8s
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 8000)
      );

      const fetchPromise = supabase.functions.invoke('check-freight-requester', {
        body: { freight_id: freightId },
      });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (signal?.aborted) return;

      if (error) {
        console.error('[useRequesterStatus] Edge function error:', error);
        setStatus(prev => ({
          ...prev,
          isLoading: false,
          type: freightData?.producer_id ? 'REGISTERED' : 'UNKNOWN',
          hasRegistration: !!freightData?.producer_id,
          producerId: freightData?.producer_id ?? null,
          error: null, // Don't show error to user
        }));
        return;
      }

      if (data?.success && data?.requester) {
        const requester = data.requester;
        setStatus({
          type: requester.type || 'UNKNOWN',
          hasRegistration: requester.has_registration ?? false,
          producerId: requester.producer_id ?? null,
          producerName: requester.producer_name ?? null,
          producerStatus: requester.producer_status ?? null,
          producerPhotoUrl: null,
          isLoading: false,
          error: null,
        });
      } else {
        setStatus(prev => ({
          ...prev,
          isLoading: false,
          error: null,
        }));
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) return;
      console.warn('[useRequesterStatus] Fallback:', err.message);
      // ✅ Nunca ficar preso em isLoading=true
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: null,
      }));
    }
  }, [freightId, localResolution]);

  // ✅ Auto-fetch se habilitado, com AbortController para cleanup
  useEffect(() => {
    if (autoFetch && freightId && !localResolution) {
      const controller = new AbortController();
      fetchStatus(controller.signal);
      return () => controller.abort();
    }
  }, [autoFetch, freightId, fetchStatus, localResolution]);

  return status;
}

/**
 * Versão simplificada que retorna apenas se é registrado
 */
export function useIsRequesterRegistered(
  freightId: string | undefined | null,
  options: RequesterStatusOptions = {}
): { isRegistered: boolean; isLoading: boolean } {
  const status = useRequesterStatus(freightId, options);
  
  return {
    isRegistered: status.hasRegistration,
    isLoading: status.isLoading,
  };
}
