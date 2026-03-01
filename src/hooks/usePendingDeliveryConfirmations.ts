import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * ✅ P0 FIX: Busca ATRIBUIÇÕES INDIVIDUAIS com entrega pendente de confirmação
 * 
 * Em fretes multi-carreta, o status global do frete pode continuar ACCEPTED/OPEN
 * enquanto motoristas individuais já reportaram entrega.
 * 
 * Este hook busca:
 * 1. freight_assignments com status DELIVERED_PENDING_CONFIRMATION
 * 2. driver_trip_progress com current_status DELIVERED ou DELIVERED_PENDING_CONFIRMATION
 * 
 * Isso garante que o produtor veja CADA motorista que reportou entrega,
 * podendo confirmar individualmente.
 */

export interface PendingDeliveryItem {
  id: string; // assignment_id (para operações)
  freight_id: string;
  driver_id: string;
  assignment_status: string;
  trip_status?: string;
  delivered_at?: string;
  agreed_price?: number;
  company_id?: string;
  // Dados do frete
  freight: {
    id: string;
    cargo_type: string;
    origin_address?: string;
    destination_address?: string;
    origin_city?: string;
    destination_city?: string;
    price: number;
    required_trucks: number;
    status: string;
    pickup_date: string;
    updated_at: string;
    metadata?: any;
    pricing_type?: string;
    price_per_km?: number;
    weight?: number;
    distance_km?: number;
  };
  // Dados do motorista
  driver: {
    id: string;
    full_name: string;
    contact_phone?: string;
    profile_photo_url?: string;
    rating?: number;
  };
  // Dados da transportadora (se afiliado)
  company?: {
    id: string;
    company_name: string;
  };
  // Deadline calculado
  deliveryDeadline: {
    hoursRemaining: number;
    isUrgent: boolean;
    isCritical: boolean;
    displayText: string;
    reportedAt: string;
  };
}

export function usePendingDeliveryConfirmations(producerId: string | undefined) {
  const [items, setItems] = useState<PendingDeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingDeliveries = useCallback(async () => {
    if (!producerId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Buscar fretes do produtor (IDs apenas)
      if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] Buscando fretes para producerId:', producerId);
      
      const { data: producerFreights, error: freightsErr } = await supabase
        .from('freights')
        .select('id')
        .eq('producer_id', producerId);

      if (freightsErr) {
        console.error('[usePendingDeliveryConfirmations] Erro ao buscar fretes:', freightsErr);
        throw freightsErr;
      }

      if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] Fretes encontrados:', producerFreights?.length || 0);

      if (!producerFreights?.length) {
        console.warn('[usePendingDeliveryConfirmations] Nenhum frete encontrado para o produtor');
        setItems([]);
        setLoading(false);
        return;
      }

      const freightIds = producerFreights.map(f => f.id);
      if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] Buscando assignments para', freightIds.length, 'freights');

      // 2. Buscar atribuições com status DELIVERED_PENDING_CONFIRMATION
      const { data: assignments, error: assignErr } = await supabase
        .from('freight_assignments')
        .select(`
          id,
          freight_id,
          driver_id,
          status,
          agreed_price,
          company_id,
          delivered_at,
          updated_at
        `)
        .in('freight_id', freightIds)
        .eq('status', 'DELIVERED_PENDING_CONFIRMATION');

      if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] Assignments encontradas:', assignments?.length || 0);

      if (assignErr) {
        console.error('[usePendingDeliveryConfirmations] Erro ao buscar atribuições:', assignErr);
        throw assignErr;
      }

      // 3. Buscar também do driver_trip_progress (fonte de verdade para status individual)
      // ✅ IMPORTANTE: aqui buscamos SOMENTE entregas ainda pendentes de confirmação.
      // Após o produtor confirmar, o driver_trip_progress tende a ficar em DELIVERED e isso NÃO deve manter o item nesta aba.
      const { data: tripProgress, error: tripErr } = await supabase
        .from('driver_trip_progress')
        .select(`
          id,
          freight_id,
          driver_id,
          assignment_id,
          current_status,
          delivered_at,
          updated_at
        `)
        .in('freight_id', freightIds)
        .eq('current_status', 'DELIVERED_PENDING_CONFIRMATION');

      if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] TripProgress encontrados:', tripProgress?.length || 0);

      if (tripErr) {
        console.warn('[usePendingDeliveryConfirmations] Erro ao buscar trip_progress:', tripErr);
        // Continua mesmo sem trip_progress
      }

      // 4. Combinar resultados (union por assignment_id ou driver_id+freight_id)
      const pendingMap = new Map<string, {
        assignment_id?: string;
        freight_id: string;
        driver_id: string;
        assignment_status?: string;
        trip_status?: string;
        delivered_at?: string;
        agreed_price?: number;
        company_id?: string;
        updated_at: string;
      }>();

      // Adicionar assignments
      (assignments || []).forEach((a: any) => {
        const key = `${a.freight_id}_${a.driver_id}`;
        pendingMap.set(key, {
          assignment_id: a.id,
          freight_id: a.freight_id,
          driver_id: a.driver_id,
          assignment_status: a.status,
          agreed_price: a.agreed_price,
          company_id: a.company_id,
          delivered_at: a.delivered_at,
          updated_at: a.updated_at,
        });
      });

      // Adicionar/atualizar com trip_progress (fonte de verdade)
      (tripProgress || []).forEach((tp: any) => {
        const key = `${tp.freight_id}_${tp.driver_id}`;
        const existing = pendingMap.get(key);
        if (existing) {
          existing.trip_status = tp.current_status;
          if (tp.delivered_at) existing.delivered_at = tp.delivered_at;
        } else {
          // Trip progress existe mas assignment não tem status correto - incluir também
          pendingMap.set(key, {
            assignment_id: tp.assignment_id,
            freight_id: tp.freight_id,
            driver_id: tp.driver_id,
            trip_status: tp.current_status,
            delivered_at: tp.delivered_at,
            updated_at: tp.updated_at,
          });
        }
      });

      if (pendingMap.size === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // ✅ CORREÇÃO: Verificar quais motoristas JÁ possuem pagamento externo (entrega já confirmada)
      // Se o pagamento já existe, a entrega JÁ FOI confirmada e não deve mais aparecer aqui
      const pendingDriverFreightPairs = [...pendingMap.values()].map(p => ({
        freight_id: p.freight_id,
        driver_id: p.driver_id,
      }));
      
      const uniquePendingFreightIds = [...new Set(pendingDriverFreightPairs.map(p => p.freight_id))];
      
      // ✅ CORREÇÃO CRÍTICA: Só filtrar entregas onde o pagamento JÁ FOI PAGO pelo produtor
      // O status 'proposed' é criado AUTOMATICAMENTE quando o motorista reporta entrega,
      // então NÃO deve ser usado para filtrar. Só filtramos quando o produtor já agiu
      // (paid_by_producer, confirmed, accepted) — significando que a entrega já foi confirmada.
      const { data: existingPayments } = await supabase
        .from('external_payments')
        .select('freight_id, driver_id, status')
        .in('freight_id', uniquePendingFreightIds)
        .in('status', ['paid_by_producer', 'confirmed', 'accepted']);

      // Criar set de "já confirmados pelo produtor" para lookup rápido
      const confirmedSet = new Set(
        (existingPayments || []).map((ep: any) => `${ep.freight_id}_${ep.driver_id}`)
      );

      // Remover do pendingMap os que já têm pagamento (entrega já confirmada)
      for (const [key] of pendingMap) {
        if (confirmedSet.has(key)) {
          if (import.meta.env.DEV) console.log(`[usePendingDeliveryConfirmations] Removendo ${key} - pagamento já existe`);
          pendingMap.delete(key);
        }
      }

      if (pendingMap.size === 0) {
        if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] Todas as entregas já foram confirmadas');
        setItems([]);
        setLoading(false);
        return;
      }

      // 5. Buscar dados completos dos fretes
      const uniqueFreightIds = [...new Set([...pendingMap.values()].map(p => p.freight_id))];
      const { data: freightsData, error: freightsDataErr } = await supabase
        .from('freights')
        .select('id, cargo_type, origin_address, destination_address, origin_city, destination_city, price, required_trucks, status, pickup_date, updated_at, metadata, pricing_type, price_per_km, weight, distance_km')
        .in('id', uniqueFreightIds);

      if (freightsDataErr) {
        console.error('[usePendingDeliveryConfirmations] Erro ao buscar dados dos fretes:', freightsDataErr);
      }

      const freightMap = new Map((freightsData || []).map((f: any) => [f.id, f]));

      // 6. Buscar dados dos motoristas
      // Observação: em alguns cenários (multi-carreta / janelas de status), RLS pode ocultar perfis via profiles_secure.
      // Para garantir que o produtor consiga confirmar, aplicamos fallback via Edge Function segura.
      const uniqueDriverIds = [...new Set([...pendingMap.values()].map(p => p.driver_id))];

      const driverMap = new Map<string, any>();

      const { data: driversData, error: driversErr } = await supabase
        .from('profiles_secure')
        .select('id, full_name, profile_photo_url, rating')
        .in('id', uniqueDriverIds);

      if (driversErr) {
        console.warn('[usePendingDeliveryConfirmations] Erro ao buscar motoristas (profiles_secure):', driversErr);
      }

      (driversData || []).forEach((d: any) => driverMap.set(d.id, d));

      // Fallback para perfis não visíveis por RLS (busca segura, com checagem de participação no frete)
      const missingDriverIds = uniqueDriverIds.filter(id => !driverMap.has(id));
      for (const missingId of missingDriverIds) {
        const relatedPending = [...pendingMap.values()].find(p => p.driver_id === missingId);
        const relatedFreightId = relatedPending?.freight_id;

        if (!relatedFreightId) continue;

        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke(
            'get-participant-public-profile',
            {
              body: {
                freight_id: relatedFreightId,
                participant_profile_id: missingId,
                participant_type: 'driver',
              },
            }
          );

          if (fnErr) {
            console.warn('[usePendingDeliveryConfirmations] Fallback get-participant-public-profile falhou:', fnErr);
            continue;
          }

          if (fnData?.success && fnData?.profile?.id) {
            driverMap.set(fnData.profile.id, fnData.profile);
          }
        } catch (e) {
          console.warn('[usePendingDeliveryConfirmations] Erro no fallback de perfil:', e);
        }
      }

      // 7. Buscar dados das transportadoras (se houver)
      const companyIds = [...new Set([...pendingMap.values()].map(p => p.company_id).filter(Boolean))] as string[];
      let companyMap = new Map<string, any>();
      
      if (companyIds.length > 0) {
        const { data: companiesData } = await supabase
          .from('transport_companies')
          .select('id, company_name')
          .in('id', companyIds);
        
        companyMap = new Map((companiesData || []).map((c: any) => [c.id, c]));
      }

      // 8. Montar itens finais
      const finalItems: PendingDeliveryItem[] = [];

      pendingMap.forEach((pending) => {
        const freight = freightMap.get(pending.freight_id);
        const driver = driverMap.get(pending.driver_id);
        
        if (!freight || !driver) return;

        // Calcular deadline (72h após reportar entrega)
        const reportedAt = pending.delivered_at || pending.updated_at;
        const deadline = new Date(new Date(reportedAt).getTime() + 72 * 60 * 60 * 1000);
        const now = new Date();
        const hoursRemaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));
        
        const isUrgent = hoursRemaining < 24;
        const isCritical = hoursRemaining < 6;

        let displayText = '';
        if (hoursRemaining === 0) displayText = 'PRAZO EXPIRADO';
        else if (hoursRemaining < 24) displayText = `${hoursRemaining}h restantes`;
        else {
          const days = Math.floor(hoursRemaining / 24);
          const hours = hoursRemaining % 24;
          displayText = `${days}d ${hours}h restantes`;
        }

        finalItems.push({
          id: pending.assignment_id || `${pending.freight_id}_${pending.driver_id}`,
          freight_id: pending.freight_id,
          driver_id: pending.driver_id,
          assignment_status: pending.assignment_status || 'DELIVERED_PENDING_CONFIRMATION',
          trip_status: pending.trip_status,
          delivered_at: pending.delivered_at,
          agreed_price: pending.agreed_price,
          company_id: pending.company_id,
          freight: {
            id: freight.id,
            cargo_type: freight.cargo_type,
            origin_address: freight.origin_address,
            destination_address: freight.destination_address,
            origin_city: freight.origin_city,
            destination_city: freight.destination_city,
            price: freight.price,
            required_trucks: freight.required_trucks || 1,
            status: freight.status,
            pickup_date: freight.pickup_date,
            updated_at: freight.updated_at,
            metadata: (freight as any).metadata,
          },
          driver: {
            id: driver.id,
            full_name: driver.full_name,
            profile_photo_url: driver.profile_photo_url,
            rating: driver.rating,
          },
          company: pending.company_id ? companyMap.get(pending.company_id) : undefined,
          deliveryDeadline: {
            hoursRemaining,
            isUrgent,
            isCritical,
            displayText,
            reportedAt,
          },
        });
      });

      // Ordenar por urgência (mais urgentes primeiro)
      finalItems.sort((a, b) => a.deliveryDeadline.hoursRemaining - b.deliveryDeadline.hoursRemaining);

      if (import.meta.env.DEV) console.log(`[usePendingDeliveryConfirmations] ✅ ${finalItems.length} entregas pendentes de confirmação`);
      setItems(finalItems);

    } catch (err: any) {
      console.error('[usePendingDeliveryConfirmations] Erro:', err);
      setError(err.message || 'Erro ao buscar entregas pendentes');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [producerId]);

  // Buscar ao montar e quando producerId mudar
  useEffect(() => {
    fetchPendingDeliveries();
  }, [fetchPendingDeliveries]);

  // Configurar realtime subscription para atualizações
  useEffect(() => {
    if (!producerId) return;

    // Escutar mudanças em freight_assignments
    const assignmentChannel = supabase
      .channel('pending-deliveries-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `status=eq.DELIVERED_PENDING_CONFIRMATION`,
        },
        () => {
          if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] Atualização em freight_assignments detectada');
          fetchPendingDeliveries();
        }
      )
      .subscribe();

    // Escutar mudanças em driver_trip_progress
    const tripChannel = supabase
      .channel('pending-deliveries-trip')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_trip_progress',
        },
        (payload) => {
          const statusNew = (payload.new as any)?.current_status;
          const statusOld = (payload.old as any)?.current_status;

          // ✅ Recarregar quando entrar OU sair de DELIVERED_PENDING_CONFIRMATION
          // (ex.: produtor confirmou → status muda para DELIVERED)
          if (
            statusNew === 'DELIVERED_PENDING_CONFIRMATION' ||
            statusOld === 'DELIVERED_PENDING_CONFIRMATION'
          ) {
            if (import.meta.env.DEV) console.log('[usePendingDeliveryConfirmations] Atualização relevante em driver_trip_progress');
            fetchPendingDeliveries();
          }
        }
      )
      .subscribe();

    return () => {
      assignmentChannel.unsubscribe();
      tripChannel.unsubscribe();
    };
  }, [producerId, fetchPendingDeliveries]);

  return {
    items,
    loading,
    error,
    refetch: fetchPendingDeliveries,
    // Contadores para UI
    totalCount: items.length,
    criticalCount: items.filter(i => i.deliveryDeadline.isCritical).length,
    urgentCount: items.filter(i => i.deliveryDeadline.isUrgent && !i.deliveryDeadline.isCritical).length,
  };
}
