/**
 * useFreightLifecycle.ts
 * 
 * Hook CENTRAL para gestão COMPLETA do ciclo de vida do frete em andamento.
 * 
 * Responsabilidades:
 * 1. PROGRESSÃO DE STATUS - Idempotência, retry, fila offline
 * 2. GESTÃO DE RISCO - Incidentes, paradas, desvios, alertas antifraude
 * 3. RASTREAMENTO - GPS, offline detection, timeline de eventos
 * 4. ALERTAS/SLA - Atrasos, deadlines, notificações automáticas
 * 5. SEGURANÇA - Armazenamento de evidências para autoridades
 * 
 * Este hook é a FONTE ÚNICA DE VERDADE para todo o transporte ativo.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

// =============================================================================
// TIPOS
// =============================================================================

/** Status válidos do ciclo de vida */
export const FREIGHT_STATUS_ORDER = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
] as const;

export type FreightStatus = (typeof FREIGHT_STATUS_ORDER)[number] | 'CANCELLED' | 'OPEN';

/** Tipos de incidentes de risco */
export type RiskIncidentType =
  | 'STOP_PROLONGED'       // Parada prolongada não justificada
  | 'ROUTE_DEVIATION'       // Desvio de rota
  | 'OFFLINE_SUSPICIOUS'    // GPS offline suspeito
  | 'SPEED_ANOMALY'         // Velocidade anormal
  | 'ZONE_VIOLATION'        // Entrada em zona não autorizada
  | 'DELAY_CRITICAL'        // Atraso crítico
  | 'CARGO_INCIDENT'        // Incidente com carga (avaria, roubo)
  | 'DRIVER_ALERT'          // Alerta manual do motorista
  | 'COMMUNICATION_LOST'    // Comunicação perdida
  | 'OTHER';                // Outros

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskIncident {
  id?: string;
  freightId: string;
  type: RiskIncidentType;
  severity: RiskSeverity;
  description: string;
  lat?: number;
  lng?: number;
  evidence?: {
    photoUrl?: string;
    notes?: string;
    metadata?: Record<string, any>;
  };
  occurredAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notifiedTelegram?: boolean;
}

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export interface FreightProgress {
  freightId: string;
  currentStatus: FreightStatus;
  acceptedAt?: string;
  loadingAt?: string;
  loadedAt?: string;
  inTransitAt?: string;
  deliveredAt?: string;
  lastLocation?: LocationUpdate;
  driverNotes?: string;
}

export interface SLAStatus {
  pickupDeadline?: Date;
  deliveryDeadline?: Date;
  pickupDelayMinutes: number;
  deliveryDelayMinutes: number;
  isPickupDelayed: boolean;
  isDeliveryDelayed: boolean;
  isUrgent: boolean;
  isCritical: boolean;
}

interface QueuedOperation {
  id: string;
  type: 'status_update' | 'incident_report' | 'location_update';
  payload: any;
  timestamp: number;
  attempts: number;
}

interface UseFreightLifecycleOptions {
  freightId?: string;
  /** Intervalo de sync de localização em ms (padrão: 60000) */
  locationSyncIntervalMs?: number;
  /** Ativar monitoramento de SLA */
  enableSLAMonitoring?: boolean;
  /** Notificar Telegram em incidentes críticos */
  notifyTelegramOnCritical?: boolean;
}

interface UseFreightLifecycleResult {
  // Estado
  isUpdating: boolean;
  isOnline: boolean;
  pendingOperations: number;
  lastError: string | null;
  progress: FreightProgress | null;
  slaStatus: SLAStatus | null;

  // Ações de Status
  updateStatus: (newStatus: FreightStatus, options?: {
    lat?: number;
    lng?: number;
    notes?: string;
    showToast?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  advanceToNextStatus: (options?: {
    lat?: number;
    lng?: number;
    notes?: string;
  }) => Promise<{ success: boolean; message: string }>;

  // Gestão de Risco
  reportIncident: (incident: Omit<RiskIncident, 'freightId'>) => Promise<{ success: boolean; id?: string }>;
  resolveIncident: (incidentId: string, notes?: string) => Promise<boolean>;
  getActiveIncidents: () => Promise<RiskIncident[]>;

  // Rastreamento
  updateLocation: (location: Omit<LocationUpdate, 'timestamp'>) => Promise<boolean>;
  reportStop: (reason: string, duration?: number) => Promise<boolean>;

  // Utilidades
  getNextStatus: (currentStatus: FreightStatus) => FreightStatus | null;
  getStatusLabel: (status: FreightStatus) => string;
  canAdvance: (currentStatus: FreightStatus) => boolean;
  syncPendingOperations: () => Promise<void>;
  fetchProgress: () => Promise<void>;

  // Constantes
  STATUS_ORDER: typeof FREIGHT_STATUS_ORDER;
  STATUS_LABELS: Record<string, string>;
}

// =============================================================================
// CONSTANTES
// =============================================================================

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberto',
  ACCEPTED: 'Aceito',
  LOADING: 'A caminho da coleta',
  LOADED: 'Carregado',
  IN_TRANSIT: 'Em trânsito',
  DELIVERED_PENDING_CONFIRMATION: 'Entrega reportada',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

const QUEUE_KEY = 'freight_lifecycle_queue';
const MAX_QUEUE_ATTEMPTS = 5;

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

export function useFreightLifecycle(
  options: UseFreightLifecycleOptions = {}
): UseFreightLifecycleResult {
  const {
    freightId,
    locationSyncIntervalMs = 60000,
    enableSLAMonitoring = true,
    notifyTelegramOnCritical = true,
  } = options;

  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Estados
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastError, setLastError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FreightProgress | null>(null);
  const [slaStatus, setSlaStatus] = useState<SLAStatus | null>(null);
  const [pendingOperations, setPendingOperations] = useState(0);

  // Refs para controle de concorrência
  const lockRef = useRef<Set<string>>(new Set());
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // QUEUE OFFLINE
  // ---------------------------------------------------------------------------

  const getQueue = useCallback((): QueuedOperation[] => {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const saveQueue = useCallback((queue: QueuedOperation[]) => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      setPendingOperations(queue.length);
    } catch (err) {
      console.error('[FreightLifecycle] Erro ao salvar queue:', err);
    }
  }, []);

  const addToQueue = useCallback((type: QueuedOperation['type'], payload: any) => {
    const queue = getQueue();
    queue.push({
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      attempts: 0,
    });
    saveQueue(queue);
    if (import.meta.env.DEV) console.log('[FreightLifecycle] Operação adicionada à fila:', type);
  }, [getQueue, saveQueue]);

  // ---------------------------------------------------------------------------
  // NETWORK MONITORING
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sincronizar operações pendentes
      syncPendingOperations();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // FETCH PROGRESS
  // ---------------------------------------------------------------------------

  const fetchProgress = useCallback(async () => {
    if (!freightId) return;

    try {
      const { data, error } = await supabase
        .from('driver_trip_progress')
        .select('*')
        .eq('freight_id', freightId)
        .eq('driver_id', profile?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[FreightLifecycle] Erro ao buscar progresso:', error);
        return;
      }

      if (data) {
        setProgress({
          freightId: data.freight_id,
          currentStatus: data.current_status as FreightStatus,
          acceptedAt: data.accepted_at,
          loadingAt: data.loading_at,
          loadedAt: data.loaded_at,
          inTransitAt: data.in_transit_at,
          deliveredAt: data.delivered_at,
          lastLocation: data.last_lat && data.last_lng ? {
            lat: data.last_lat,
            lng: data.last_lng,
            timestamp: data.updated_at,
          } : undefined,
          driverNotes: data.driver_notes,
        });
      }
    } catch (err) {
      console.error('[FreightLifecycle] Erro inesperado:', err);
    }
  }, [freightId, profile?.id]);

  useEffect(() => {
    if (freightId) {
      fetchProgress();
    }
  }, [freightId, fetchProgress]);

  // ---------------------------------------------------------------------------
  // STATUS UPDATE
  // ---------------------------------------------------------------------------

  const updateStatus = useCallback(async (
    newStatus: FreightStatus,
    opts?: { lat?: number; lng?: number; notes?: string; showToast?: boolean }
  ): Promise<{ success: boolean; message: string }> => {
    const showToast = opts?.showToast !== false;
    const normalizedStatus = String(newStatus).toUpperCase().trim();
    const lockKey = `status:${freightId}:${normalizedStatus}`;

    // Bloquear chamadas duplicadas
    if (lockRef.current.has(lockKey)) {
      return { success: true, message: 'Operação já em andamento' };
    }

    // =====================================================
    // VALIDAÇÃO DE NÃO-REGRESSÃO NO FRONTEND (UX rápido)
    // =====================================================
    if (progress?.currentStatus) {
      const statusOrderStrings = FREIGHT_STATUS_ORDER as readonly string[];
      const currentIndex = statusOrderStrings.indexOf(progress.currentStatus);
      const newIndex = statusOrderStrings.indexOf(normalizedStatus);
      
      // Se ambos estão na lista, verificar regressão
      if (currentIndex !== -1 && newIndex !== -1) {
        // Bloquear regressão
        if (newIndex < currentIndex) {
          const errorMsg = `Não é permitido voltar de "${STATUS_LABELS[progress.currentStatus] || progress.currentStatus}" para "${STATUS_LABELS[normalizedStatus] || normalizedStatus}". O status só pode avançar.`;
          setLastError(errorMsg);
          
          if (showToast) {
            toast.error('Atualização bloqueada', { description: errorMsg });
          }
          
          return { success: false, message: errorMsg };
        }
        
        // Bloquear salto de etapas (mais de 1 passo)
        if (newIndex > currentIndex + 1) {
          const expectedNext = FREIGHT_STATUS_ORDER[currentIndex + 1];
          const errorMsg = `Não é permitido pular etapas. De "${STATUS_LABELS[progress.currentStatus] || progress.currentStatus}" você deve ir para "${STATUS_LABELS[expectedNext] || expectedNext}".`;
          setLastError(errorMsg);
          
          if (showToast) {
            toast.error('Atualização bloqueada', { description: errorMsg });
          }
          
          return { success: false, message: errorMsg };
        }
      }
    }
    // =====================================================

    lockRef.current.add(lockKey);
    setIsUpdating(true);
    setLastError(null);

    try {
      // Se offline, adicionar à fila
      if (!navigator.onLine) {
        addToQueue('status_update', {
          freightId,
          newStatus: normalizedStatus,
          lat: opts?.lat,
          lng: opts?.lng,
          notes: opts?.notes,
        });

        if (showToast) {
          toast.info('Sem conexão', {
            description: 'Atualização será sincronizada quando a conexão voltar.',
          });
        }

        return { success: false, message: 'Offline - operação enfileirada' };
      }

      // Chamar RPC idempotente
      const { data, error } = await supabase.rpc('update_trip_progress', {
        p_freight_id: freightId,
        p_new_status: normalizedStatus,
        p_lat: opts?.lat ?? null,
        p_lng: opts?.lng ?? null,
        p_notes: opts?.notes ?? null,
      });

      if (error) {
        console.error('[FreightLifecycle] Erro RPC:', error);
        setLastError(error.message);

        if (showToast) {
          toast.error('Erro ao atualizar', { description: error.message });
        }

        return { success: false, message: error.message };
      }

      const result = data as any;
      const ok = Boolean(result?.success ?? result?.ok);

      if (!ok) {
        const msg = result?.message || result?.error || 'Erro desconhecido';
        setLastError(msg);

        if (showToast) {
          toast.error('Falha na atualização', { description: msg });
        }

        return { success: false, message: msg };
      }

      // Sucesso
      if (showToast) {
        const label = STATUS_LABELS[normalizedStatus] || normalizedStatus;
        toast.success(`Status: ${label}`);
      }

      // Atualizar estado local
      setProgress(prev => prev ? { ...prev, currentStatus: normalizedStatus as FreightStatus } : prev);

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['driver-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['freight-details', freightId] });

      // Notificar produtor em entrega reportada
      if (normalizedStatus === 'DELIVERED_PENDING_CONFIRMATION') {
        window.dispatchEvent(new CustomEvent('freight:movedToHistory', { detail: { freightId } }));
      }

      return { success: true, message: 'Atualizado com sucesso' };

    } catch (err: any) {
      const msg = err?.message || 'Erro inesperado';
      console.error('[FreightLifecycle] Erro:', err);
      setLastError(msg);

      if (showToast) {
        toast.error('Erro inesperado', { description: msg });
      }

      return { success: false, message: msg };
    } finally {
      setIsUpdating(false);
      lockRef.current.delete(lockKey);
    }
  }, [freightId, queryClient, addToQueue]);

  // ---------------------------------------------------------------------------
  // ADVANCE TO NEXT STATUS
  // ---------------------------------------------------------------------------

  const getNextStatus = useCallback((current: FreightStatus): FreightStatus | null => {
    const idx = FREIGHT_STATUS_ORDER.indexOf(current as any);
    if (idx === -1 || idx >= FREIGHT_STATUS_ORDER.length - 1) return null;
    return FREIGHT_STATUS_ORDER[idx + 1] as FreightStatus;
  }, []);

  const getStatusLabel = useCallback((status: FreightStatus): string => {
    return STATUS_LABELS[status] || status;
  }, []);

  const canAdvance = useCallback((current: FreightStatus): boolean => {
    const normalized = String(current).toUpperCase().trim();
    if (normalized === 'CANCELLED' || normalized === 'COMPLETED') return false;
    const idx = FREIGHT_STATUS_ORDER.indexOf(normalized as any);
    return idx !== -1 && idx < FREIGHT_STATUS_ORDER.length - 1;
  }, []);

  const advanceToNextStatus = useCallback(async (opts?: {
    lat?: number;
    lng?: number;
    notes?: string;
  }) => {
    if (!progress?.currentStatus) {
      return { success: false, message: 'Status atual desconhecido' };
    }

    const next = getNextStatus(progress.currentStatus);
    if (!next) {
      return { success: false, message: 'Não há próximo status disponível' };
    }

    return updateStatus(next, opts);
  }, [progress?.currentStatus, getNextStatus, updateStatus]);

  // ---------------------------------------------------------------------------
  // INCIDENT REPORTING (GESTÃO DE RISCO)
  // ---------------------------------------------------------------------------

  const reportIncident = useCallback(async (
    incident: Omit<RiskIncident, 'freightId'>
  ): Promise<{ success: boolean; id?: string }> => {
    if (!freightId) {
      return { success: false };
    }

    const fullIncident: RiskIncident = {
      ...incident,
      freightId,
      occurredAt: incident.occurredAt || new Date().toISOString(),
    };

    // Se offline, enfileirar
    if (!navigator.onLine) {
      addToQueue('incident_report', fullIncident);
      toast.info('Incidente registrado localmente');
      return { success: true };
    }

    try {
      // Inserir em auditoria_eventos
      const { data, error } = await supabase
        .from('auditoria_eventos')
        .insert({
          frete_id: freightId,
          tipo: incident.type,
          codigo_regra: `INCIDENT_${incident.type}`,
          descricao: incident.description,
          severidade: incident.severity,
          resolvido: false,
          evidencias: incident.evidence ? JSON.stringify(incident.evidence) : null,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[FreightLifecycle] Erro ao registrar incidente:', error);
        // Enfileirar para retry
        addToQueue('incident_report', fullIncident);
        return { success: false };
      }

      // Notificar Telegram em incidentes críticos
      if (notifyTelegramOnCritical && (incident.severity === 'critical' || incident.severity === 'high')) {
        try {
          await supabase.functions.invoke('send-telegram-alert', {
            body: {
              message: `🚨 ALERTA DE RISCO - Frete ${freightId}\n\nTipo: ${incident.type}\nSeveridade: ${incident.severity.toUpperCase()}\nDescrição: ${incident.description}\n\nHora: ${new Date().toLocaleString('pt-BR')}`,
              priority: incident.severity === 'critical' ? 'urgent' : 'high',
            },
          });
        } catch (telegramErr) {
          console.warn('[FreightLifecycle] Erro ao notificar Telegram:', telegramErr);
        }
      }

      // Inserir em stop_events se for parada
      if (incident.type === 'STOP_PROLONGED' && incident.lat && incident.lng) {
        await supabase
          .from('stop_events')
          .insert({
            freight_id: freightId,
            driver_id: profile?.id,
            lat: incident.lat,
            lng: incident.lng,
            started_at: incident.occurredAt,
            reason: incident.description,
            risk_level: incident.severity,
            is_known_point: false,
          });
      }

      toast.success('Incidente registrado');
      return { success: true, id: data?.id };

    } catch (err) {
      console.error('[FreightLifecycle] Erro inesperado:', err);
      addToQueue('incident_report', fullIncident);
      return { success: false };
    }
  }, [freightId, profile?.id, notifyTelegramOnCritical, addToQueue]);

  const resolveIncident = useCallback(async (incidentId: string, notes?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('auditoria_eventos')
        .update({
          resolvido: true,
          resolvido_at: new Date().toISOString(),
          resolvido_por: profile?.id,
          notas_resolucao: notes,
        })
        .eq('id', incidentId);

      if (error) {
        console.error('[FreightLifecycle] Erro ao resolver incidente:', error);
        return false;
      }

      toast.success('Incidente resolvido');
      return true;
    } catch (err) {
      console.error('[FreightLifecycle] Erro:', err);
      return false;
    }
  }, [profile?.id]);

  const getActiveIncidents = useCallback(async (): Promise<RiskIncident[]> => {
    if (!freightId) return [];

    try {
      const { data, error } = await supabase
        .from('auditoria_eventos')
        .select('*')
        .eq('frete_id', freightId)
        .eq('resolvido', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[FreightLifecycle] Erro ao buscar incidentes:', error);
        return [];
      }

      return (data || []).map(e => ({
        id: e.id,
        freightId: e.frete_id,
        type: e.tipo as RiskIncidentType,
        severity: e.severidade as RiskSeverity,
        description: e.descricao,
        evidence: e.evidencias ? (typeof e.evidencias === 'string' ? JSON.parse(e.evidencias) : e.evidencias) : undefined,
        occurredAt: e.created_at,
      }));
    } catch (err) {
      console.error('[FreightLifecycle] Erro:', err);
      return [];
    }
  }, [freightId]);

  // ---------------------------------------------------------------------------
  // LOCATION UPDATE
  // ---------------------------------------------------------------------------

  const updateLocation = useCallback(async (
    location: Omit<LocationUpdate, 'timestamp'>
  ): Promise<boolean> => {
    if (!freightId || !profile?.id) return false;

    const fullLocation: LocationUpdate = {
      ...location,
      timestamp: new Date().toISOString(),
    };

    // Se offline, enfileirar
    if (!navigator.onLine) {
      addToQueue('location_update', { freightId, driverId: profile.id, ...fullLocation });
      return true;
    }

    try {
      // Atualizar driver_current_locations (upsert)
      const { error } = await supabase
        .from('driver_current_locations')
        .upsert({
          driver_profile_id: profile.id,
          lat: location.lat,
          lng: location.lng,
          last_gps_update: fullLocation.timestamp,
          updated_at: fullLocation.timestamp,
        }, {
          onConflict: 'driver_profile_id',
        });

      if (error) {
        console.error('[FreightLifecycle] Erro ao atualizar localização:', error);
        return false;
      }

      // Atualizar driver_trip_progress com última localização
      await supabase
        .from('driver_trip_progress')
        .update({
          last_lat: location.lat,
          last_lng: location.lng,
          updated_at: fullLocation.timestamp,
        })
        .eq('freight_id', freightId)
        .eq('driver_id', profile.id);

      // Inserir no histórico (para auditoria/autoridades)
      await supabase
        .from('driver_location_history')
        .insert({
          driver_profile_id: profile.id,
          freight_id: freightId,
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          captured_at: fullLocation.timestamp,
        });

      return true;
    } catch (err) {
      console.error('[FreightLifecycle] Erro:', err);
      return false;
    }
  }, [freightId, profile?.id, addToQueue]);

  const reportStop = useCallback(async (reason: string, durationMinutes?: number): Promise<boolean> => {
    if (!freightId || !profile?.id) return false;

    try {
      // Buscar última localização conhecida
      const { data: locData } = await supabase
        .from('driver_current_locations')
        .select('lat, lng')
        .eq('driver_profile_id', profile.id)
        .single();

      const lat = locData?.lat ?? null;
      const lng = locData?.lng ?? null;

      // Inserir evento de parada
      const { error } = await supabase
        .from('stop_events')
        .insert({
          freight_id: freightId,
          driver_id: profile.id,
          lat,
          lng,
          started_at: new Date().toISOString(),
          reason,
          duration_minutes: durationMinutes,
          risk_level: durationMinutes && durationMinutes > 60 ? 'medium' : 'low',
          is_known_point: false,
        });

      if (error) {
        console.error('[FreightLifecycle] Erro ao registrar parada:', error);
        return false;
      }

      toast.success('Parada registrada');
      return true;
    } catch (err) {
      console.error('[FreightLifecycle] Erro:', err);
      return false;
    }
  }, [freightId, profile?.id]);

  // ---------------------------------------------------------------------------
  // SYNC PENDING OPERATIONS
  // ---------------------------------------------------------------------------

  const syncPendingOperations = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0 || !navigator.onLine) return;

    if (import.meta.env.DEV) console.log(`[FreightLifecycle] Sincronizando ${queue.length} operações pendentes...`);

    const remaining: QueuedOperation[] = [];

    for (const op of queue) {
      if (op.attempts >= MAX_QUEUE_ATTEMPTS) {
        console.warn('[FreightLifecycle] Operação descartada após max tentativas:', op.id);
        continue;
      }

      try {
        let success = false;

        if (op.type === 'status_update') {
          const { data, error } = await supabase.rpc('update_trip_progress', {
            p_freight_id: op.payload.freightId,
            p_new_status: op.payload.newStatus,
            p_lat: op.payload.lat ?? null,
            p_lng: op.payload.lng ?? null,
            p_notes: op.payload.notes ?? null,
          });
          success = !error && Boolean((data as any)?.success);
        } else if (op.type === 'incident_report') {
          const { error } = await supabase
            .from('auditoria_eventos')
            .insert({
              frete_id: op.payload.freightId,
              tipo: op.payload.type,
              codigo_regra: `INCIDENT_${op.payload.type}`,
              descricao: op.payload.description,
              severidade: op.payload.severity,
              resolvido: false,
            });
          success = !error;
        } else if (op.type === 'location_update') {
          const { error } = await supabase
            .from('driver_location_history')
            .insert({
              driver_profile_id: op.payload.driverId,
              freight_id: op.payload.freightId,
              lat: op.payload.lat,
              lng: op.payload.lng,
              captured_at: op.payload.timestamp,
            });
          success = !error;
        }

        if (!success) {
          remaining.push({ ...op, attempts: op.attempts + 1 });
        } else {
          if (import.meta.env.DEV) console.log('[FreightLifecycle] Operação sincronizada:', op.id);
        }
      } catch (err) {
        console.error('[FreightLifecycle] Erro ao sincronizar:', err);
        remaining.push({ ...op, attempts: op.attempts + 1 });
      }
    }

    saveQueue(remaining);

    if (remaining.length === 0) {
      toast.success('Operações sincronizadas com sucesso!');
    } else {
      toast.info(`${queue.length - remaining.length} operações sincronizadas. ${remaining.length} pendentes.`);
    }
  }, [getQueue, saveQueue]);

  // Auto-sync ao carregar
  useEffect(() => {
    const queue = getQueue();
    setPendingOperations(queue.length);

    if (queue.length > 0 && navigator.onLine) {
      syncPendingOperations();
    }
  }, []);

  // Sync periódico
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncPendingOperations();
      }
    }, 120000); // 2 minutos

    return () => clearInterval(interval);
  }, [syncPendingOperations]);

  // ---------------------------------------------------------------------------
  // SLA MONITORING
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!enableSLAMonitoring || !freightId) return;

    const checkSLA = async () => {
      try {
        const { data } = await supabase
          .from('freights')
          .select('pickup_date, delivery_date, status')
          .eq('id', freightId)
          .single();

        if (!data) return;

        const now = new Date();
        const pickupDate = data.pickup_date ? new Date(data.pickup_date) : null;
        const deliveryDate = data.delivery_date ? new Date(data.delivery_date) : null;

        const pickupDelayMinutes = pickupDate ? Math.max(0, (now.getTime() - pickupDate.getTime()) / 60000) : 0;
        const deliveryDelayMinutes = deliveryDate ? Math.max(0, (now.getTime() - deliveryDate.getTime()) / 60000) : 0;

        const isPickupDelayed = pickupDelayMinutes > 60;
        const isDeliveryDelayed = deliveryDelayMinutes > 60;
        const isUrgent = deliveryDelayMinutes > 120 || pickupDelayMinutes > 180;
        const isCritical = deliveryDelayMinutes > 360 || pickupDelayMinutes > 720;

        setSlaStatus({
          pickupDeadline: pickupDate ?? undefined,
          deliveryDeadline: deliveryDate ?? undefined,
          pickupDelayMinutes,
          deliveryDelayMinutes,
          isPickupDelayed,
          isDeliveryDelayed,
          isUrgent,
          isCritical,
        });

        // Alerta crítico
        if (isCritical && notifyTelegramOnCritical) {
          await reportIncident({
            type: 'DELAY_CRITICAL',
            severity: 'critical',
            description: `Atraso crítico detectado. Coleta: ${Math.round(pickupDelayMinutes)}min. Entrega: ${Math.round(deliveryDelayMinutes)}min.`,
          });
        }
      } catch (err) {
        console.error('[FreightLifecycle] Erro no SLA check:', err);
      }
    };

    checkSLA();
    const interval = setInterval(checkSLA, 300000); // 5 minutos

    return () => clearInterval(interval);
  }, [enableSLAMonitoring, freightId, notifyTelegramOnCritical, reportIncident]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    // Estado
    isUpdating,
    isOnline,
    pendingOperations,
    lastError,
    progress,
    slaStatus,

    // Ações de Status
    updateStatus,
    advanceToNextStatus,

    // Gestão de Risco
    reportIncident,
    resolveIncident,
    getActiveIncidents,

    // Rastreamento
    updateLocation,
    reportStop,

    // Utilidades
    getNextStatus,
    getStatusLabel,
    canAdvance,
    syncPendingOperations,
    fetchProgress,

    // Constantes
    STATUS_ORDER: FREIGHT_STATUS_ORDER,
    STATUS_LABELS,
  };
}
