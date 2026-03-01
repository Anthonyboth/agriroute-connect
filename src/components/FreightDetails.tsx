import React, { useState, useEffect, Suspense } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Package, Clock, User, Truck, MessageCircle, Star, Phone, FileText, CreditCard, DollarSign, Bell, X, RefreshCw, ChevronRight, FileCheck, Shield, Building2 } from 'lucide-react';
import { FreightChat } from './LazyComponents';
import { FreightStatusTracker } from './FreightStatusTracker';
import { FreightStatusHistory } from './FreightStatusHistory';
import { FreightRatingModal } from './FreightRatingModal';
import { AutoRatingModal } from './AutoRatingModal';
import { FreightAdvanceModal } from './FreightAdvanceModal';
import { FreightPaymentModal } from './FreightPaymentModal';
// FreightAssignmentsList removido - duplicação eliminada
import { ManifestoModal } from './ManifestoModal';
import { FreightNfePanel } from './nfe/FreightNfePanel';
import { ParticipantProfileModal } from './freight/ParticipantProfileModal';
import { FreightParticipantCard } from './freight/FreightParticipantCard';
import { DriverVehiclePreview } from './freight/DriverVehiclePreview';
import { DriverLocationModal } from './freight/DriverLocationModal';
import { useMultiDriverLocations } from '@/hooks/useMultiDriverLocations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { FINAL_STATUSES } from '@/lib/freight-status-helpers';
import { getUrgencyLabel } from '@/lib/urgency-labels';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { useAutoRating } from '@/hooks/useAutoRating';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatKm, getPricePerTruck, formatBRL } from '@/lib/formatters';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';
import { CTeEmitirDialog } from './fiscal/CTeEmitirDialog';
import { isFeatureEnabled } from '@/config/featureFlags';
import { AntifraudPanel } from './antifraude';
import { useDashboardIntegrityGuard } from '@/hooks/useDashboardIntegrityGuard';
import { useRequesterStatus } from '@/hooks/useRequesterStatus';
import { useFreightParticipants } from '@/hooks/useFreightParticipants';

interface FreightDetailsProps {
  freightId: string;
  currentUserProfile: any;
  onClose: () => void;
  onFreightWithdraw?: (freight: any) => void;
  initialTab?: 'status' | 'chat';
}

export const FreightDetails: React.FC<FreightDetailsProps> = ({ 
  freightId, 
  currentUserProfile, 
  onClose,
  onFreightWithdraw,
  initialTab = 'status'
}) => {
  // ✅ GUARD: Valida integridade do modal - evita regressões
  useDashboardIntegrityGuard('freight_details_modal', 'FreightDetails');
  
  // No toast initialization needed - using sonner directly
  const [freight, setFreight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [userToRate, setUserToRate] = useState<any>(null);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [advances, setAdvances] = useState<any[]>([]);
  const [movingToHistory, setMovingToHistory] = useState(false);
  const [manifestoModalOpen, setManifestoModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState<{ open: boolean; userId: string; userType: 'driver' | 'producer'; userName: string }>({ open: false, userId: '', userType: 'driver', userName: '' });
  const [cteModalOpen, setCteModalOpen] = useState(false);
  const [locationModalState, setLocationModalState] = useState<{
    open: boolean;
    driverId: string;
    driverName: string;
    avatarUrl?: string;
  }>({ open: false, driverId: '', driverName: '' });
  
  // ✅ Hook centralizado para gerenciar TODOS os participantes do frete
  // Fonte ÚNICA de verdade: elimina bugs de motoristas não relacionados aparecerem
  const { 
    data: participants, 
    isLoading: participantsLoading,
    isParticipant: checkIsParticipant
  } = useFreightParticipants({
    freightId,
    includePending: true,
    realtime: true
  });

  // ✅ Hook para localização em tempo real de motoristas (apenas para produtores)
  const { drivers: multiDriversLocations } = useMultiDriverLocations(freightId);

  // ✅ Fallback para identificar solicitante cadastrado quando o JOIN/`profiles_secure` não retornam
  // (ex: frete multi-carreta ainda com status OPEN, mas já aceito pelo motorista)
  const requesterStatus = useRequesterStatus(freightId, {
    autoFetch: !!freightId,
    producer: freight?.producer,
    producerId: freight?.producer_id,
    isGuestFreight: freight?.is_guest_freight,
  });

  // Status order for calculating effective status
  const statusOrder = ['OPEN','IN_NEGOTIATION','ACCEPTED','LOADING','LOADED','IN_TRANSIT','DELIVERED_PENDING_CONFIRMATION','DELIVERED','COMPLETED','CANCELLED','REJECTED','PENDING'];
  const statusRank = (s?: string) => Math.max(0, statusOrder.indexOf(s || 'OPEN'));

  const fetchFreightDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles_secure!freights_producer_id_fkey(id, full_name, contact_phone, active_mode, profile_photo_url, selfie_url, rating, total_ratings),
          driver:profiles_secure!freights_driver_id_fkey(id, full_name, contact_phone, active_mode, profile_photo_url, selfie_url, rating, total_ratings)
        `)
        .eq('id', freightId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar frete:', error.message, error.details);
        throw error;
      }

      // Normalizar producer e driver (podem vir como arrays)
      let normalizedFreight = {
        ...data,
        producer: Array.isArray(data.producer) ? data.producer[0] : data.producer,
        driver: Array.isArray(data.driver) ? data.driver[0] : data.driver,
      };
      
      // ✅ CORREÇÃO BUG 1: Buscar produtor secundariamente se JOIN falhou
      if (data.producer_id && (!normalizedFreight.producer || !normalizedFreight.producer.full_name)) {
        console.log('[FreightDetails] Producer JOIN vazio, buscando diretamente...');
        
        // Tentar profiles_secure primeiro
        const { data: producerData } = await (supabase as any)
          .from('profiles_secure')
          .select('id, full_name, profile_photo_url, rating, total_ratings')
          .eq('id', data.producer_id)
          .maybeSingle();
        
        if (producerData) {
          normalizedFreight = { ...normalizedFreight, producer: producerData };
          console.log('[FreightDetails] Produtor encontrado:', producerData.full_name);
        } else {
          // ✅ FALLBACK: Usar edge function para buscar produtor
          console.log('[FreightDetails] profiles_secure vazio para produtor, tentando edge function...');
          try {
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-participant-public-profile', {
              body: {
                freight_id: freightId,
                participant_profile_id: data.producer_id,
                participant_type: 'producer',
              },
            });
            
            if (!edgeError && edgeData?.success && edgeData?.profile) {
              normalizedFreight = { ...normalizedFreight, producer: edgeData.profile };
              console.log('[FreightDetails] Produtor encontrado via edge function:', edgeData.profile.full_name);
            } else {
              // Verificar se existe guest info no metadata ou como fallback
              const guestInfo = (data as any).guest_name || (data.metadata as any)?.guest_name;
              const guestPhone = (data as any).guest_phone || (data.metadata as any)?.guest_phone;
              
              if (guestInfo) {
                normalizedFreight = { 
                  ...normalizedFreight, 
                  producer: { 
                    id: null, 
                    full_name: guestInfo, 
                    contact_phone: guestPhone || null,
                    role: 'GUEST' 
                  } 
                };
              }
            }
          } catch (edgeFallbackErr) {
            console.warn('[FreightDetails] Edge function fallback falhou para produtor:', edgeFallbackErr);
          }
        }
      }

      // ✅ CORREÇÃO BUG 1b: Buscar motorista secundariamente se JOIN falhou (após endurecimento de RLS em profiles)
      if (data.driver_id && (!normalizedFreight.driver || !normalizedFreight.driver.full_name)) {
        console.log('[FreightDetails] Driver JOIN vazio, buscando diretamente...');
        
        // Tentar profiles_secure primeiro
        const { data: driverData } = await (supabase as any)
          .from('profiles_secure')
          .select('id, full_name, profile_photo_url, rating, total_ratings')
          .eq('id', data.driver_id)
          .maybeSingle();

        if (driverData) {
          normalizedFreight = { ...normalizedFreight, driver: driverData };
          console.log('[FreightDetails] Motorista encontrado:', driverData.full_name);
        } else {
          // ✅ FALLBACK: Usar edge function para buscar motorista
          console.log('[FreightDetails] profiles_secure vazio para motorista, tentando edge function...');
          try {
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-participant-public-profile', {
              body: {
                freight_id: freightId,
                participant_profile_id: data.driver_id,
                participant_type: 'driver',
              },
            });
            
            if (!edgeError && edgeData?.success && edgeData?.profile) {
              normalizedFreight = { ...normalizedFreight, driver: edgeData.profile };
              console.log('[FreightDetails] Motorista encontrado via edge function:', edgeData.profile.full_name);
            }
          } catch (edgeFallbackErr) {
            console.warn('[FreightDetails] Edge function fallback falhou para motorista:', edgeFallbackErr);
          }
        }
      }

      // ✅ REMOVIDO: Lógica duplicada de carregamento de motoristas
      // Agora gerenciado centralizadamente pelo hook useFreightParticipants
      
      setFreight(normalizedFreight);

      // Buscar adiantamentos
      const { data: advancesData } = await supabase
        .from('freight_advances')
        .select('*')
        .eq('freight_id', freightId)
        .order('requested_at', { ascending: false });
      
      setAdvances(advancesData || []);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes do frete:', error);
      toast.error("Erro ao carregar detalhes do frete. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return <Badge variant={getFreightStatusVariant(status)}>{getFreightStatusLabel(status)}</Badge>;
  };

  const canRate = () => {
    return freight?.status === 'DELIVERED' && currentUserProfile;
  };

  const handleOpenRating = (userToRate: any) => {
    setUserToRate(userToRate);
    setRatingModalOpen(true);
  };

  const handleMoveToHistory = async () => {
    try {
      setMovingToHistory(true);
      
      const { error } = await supabase
        .from('freights')
        .update({ 
          status: 'COMPLETED', 
          updated_at: new Date().toISOString(),
          metadata: { 
            ...(freight?.metadata || {}), 
            moved_to_history_at: new Date().toISOString() 
          }
        })
        .eq('id', freightId);
      
      if (error) throw error;

      // Best effort: inserir histórico (ignorar erro se houver RLS)
      try {
        await supabase
          .from('freight_status_history')
          .insert({ 
            freight_id: freightId, 
            status: 'COMPLETED', 
            changed_by: currentUserProfile.id 
          });
      } catch (historyError) {
        console.log('Erro ao inserir histórico (ignorado):', historyError);
      }

      setFreight((prev: any) => prev ? { ...prev, status: 'COMPLETED' } : prev);
      
      // Disparar evento para redirecionar para histórico
      window.dispatchEvent(new CustomEvent('freight:movedToHistory', { 
        detail: { freightId } 
      }));
      
      toast.success('Frete movido para o histórico');
      onClose?.();
    } catch (e: any) {
      console.error('Erro ao mover para o histórico:', e);
      toast.error(e?.message || 'Não foi possível mover para o histórico');
    } finally {
      setMovingToHistory(false);
    }
  };

  const isProducer = currentUserProfile?.role === 'PRODUTOR';
  const isDriver = ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(currentUserProfile?.role);
  const isTransportadora = currentUserProfile?.role === 'TRANSPORTADORA';
  
  // CT-e pode ser emitido por transportadoras em fretes carregados, em trânsito ou entregues
  const canEmitCTe = isFeatureEnabled('enable_cte_emission') && 
    isTransportadora && 
    ['LOADED', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION'].includes(freight?.status);
  
  // Verificar se é participante (produtor, motorista direto, ou tem assignment ativo)
  const [hasActiveAssignment, setHasActiveAssignment] = useState(false);
  const [driverAssignment, setDriverAssignment] = useState<any>(null);
  const [hasActiveCompanyAssignment, setHasActiveCompanyAssignment] = useState(false);
  const [companyDriverAssignment, setCompanyDriverAssignment] = useState<any>(null);
  
  useEffect(() => {
    const checkAssignment = async () => {
      if (!currentUserProfile?.id || !freightId) return;
      
      const { data } = await supabase
        .from('freight_assignments')
        .select('*')
        .eq('freight_id', freightId)
        .eq('driver_id', currentUserProfile.id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'DELIVERED_PENDING_CONFIRMATION'])
        .limit(1);
      
      setHasActiveAssignment(!!data && data.length > 0);
      setDriverAssignment(data && data.length > 0 ? data[0] : null);
    };
    
    checkAssignment();
  }, [freightId, currentUserProfile?.id]);

  // ✅ Transportadora também é participante quando existe assignment ativo para a empresa.
  // Isso libera Chat / NF-es / Antifraude no modal para o fluxo de 3+ participantes.
  useEffect(() => {
    const checkCompanyAssignment = async () => {
      if (!isTransportadora || !currentUserProfile?.id || !freightId) {
        setHasActiveCompanyAssignment(false);
        return;
      }

      try {
        const { data: companyRow, error: companyErr } = await supabase
          .from('transport_companies')
          .select('id')
          .eq('profile_id', currentUserProfile.id)
          .maybeSingle();

        if (companyErr || !companyRow?.id) {
          setHasActiveCompanyAssignment(false);
          return;
        }

        const { data: assignmentRows, error: asgErr } = await supabase
          .from('freight_assignments')
          .select('id, status, driver_id')
          .eq('freight_id', freightId)
          .eq('company_id', companyRow.id)
          .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'DELIVERED_PENDING_CONFIRMATION'])
          .limit(1);

        if (asgErr) {
          setHasActiveCompanyAssignment(false);
          setCompanyDriverAssignment(null);
          return;
        }

        setHasActiveCompanyAssignment(!!assignmentRows && assignmentRows.length > 0);
        setCompanyDriverAssignment(assignmentRows && assignmentRows.length > 0 ? assignmentRows[0] : null);
      } catch {
        setHasActiveCompanyAssignment(false);
      }
    };

    checkCompanyAssignment();
  }, [freightId, currentUserProfile?.id, isTransportadora]);

  // Calculate effective status (prioritize freight.status if final)
  const effectiveStatus = React.useMemo(() => {
    if (FINAL_STATUSES.includes(freight?.status as any)) {
      return freight.status;
    }
    // ✅ Carrier: use their affiliated driver's assignment status
    const relevantAssignment = driverAssignment || companyDriverAssignment;
    if (relevantAssignment?.status) {
      return statusRank(freight?.status) >= statusRank(relevantAssignment.status) 
        ? freight?.status 
        : relevantAssignment.status;
    }
    return freight?.status;
  }, [freight?.status, driverAssignment?.status, companyDriverAssignment?.status]);
  // ✅ Multi-carreta (status OPEN): o motorista pode estar em drivers_assigned sem existir row em freight_assignments.
  const isAssignedDriver = Array.isArray(freight?.drivers_assigned)
    ? (freight.drivers_assigned as string[]).includes(currentUserProfile?.id)
    : false;

  // ✅ FONTE ÚNICA DE VERDADE: usar hook useFreightParticipants
  // Mantemos fallbacks para compatibilidade durante carregamento
  const isParticipant = 
    checkIsParticipant(currentUserProfile?.id) ||
    freight?.producer?.id === currentUserProfile?.id || 
    freight?.driver?.id === currentUserProfile?.id ||
    hasActiveAssignment ||
    isAssignedDriver ||
    hasActiveCompanyAssignment;
  
  const isFreightProducer = freight?.producer?.id === currentUserProfile?.id;
  
  const totalAdvances = advances.reduce((sum, advance) => sum + ((advance.approved_amount || 0) / 100), 0);
  const remainingAmount = freight?.price - totalAdvances;
  
  const canRequestAdvance = isDriver && (freight?.status === 'ACCEPTED' || freight?.status === 'LOADING' || freight?.status === 'IN_TRANSIT') && totalAdvances < (freight?.price * 0.5);
  const canMakePayment = isFreightProducer && freight?.status === 'DELIVERED' && remainingAmount > 0;

  // Hook para avaliação automática quando frete é finalizado
  const { 
    showRatingModal: showAutoRatingModal, 
    userToRate: autoUserToRate, 
    closeRatingModal: closeAutoRatingModal 
  } = useAutoRating({
    freightId,
    freightStatus: freight?.status || '',
    currentUserProfile,
    freight
  });

  useEffect(() => {
    // ✅ AbortController para cancelar requisições quando o componente desmonta
    const abortController = new AbortController();
    let isMounted = true;

    const fetchData = async () => {
      // Verificar se ainda está montado antes de fazer requisições
      if (!isMounted || abortController.signal.aborted) return;
      
      try {
        await fetchFreightDetails();
      } catch (error: any) {
        // Ignorar erros de abort - são esperados quando o componente desmonta
        if (error?.name === 'AbortError' || abortController.signal.aborted) {
          console.log('[FreightDetails] Fetch cancelado - componente desmontado');
          return;
        }
        console.error('[FreightDetails] Erro ao carregar dados:', error);
      }
    };

    fetchData();

    // Subscribe to real-time freight updates
    const channel = supabase
      .channel(`freight-row-${freightId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'freights',
        filter: `id=eq.${freightId}`
      }, (payload) => {
        // Apenas atualizar se ainda estiver montado
        if (isMounted && !abortController.signal.aborted) {
          setFreight((prev: any) => prev ? { ...prev, status: payload.new.status } : prev);
        }
      })
      .subscribe();

    return () => {
      // Cleanup: marcar como desmontado e abortar requisições pendentes
      isMounted = false;
      abortController.abort();
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  // Listener para notificação de avaliação automática
  useEffect(() => {
    const handleRatingNotification = (event: any) => {
      const { userName, userRole } = event.detail;
      const roleText = userRole === 'MOTORISTA' ? 'motorista' : 'produtor';
      toast.success(
        `Frete finalizado! Que tal avaliar ${roleText} ${userName}?`, 
        {
          description: "Sua avaliação ajuda a melhorar a qualidade da plataforma.",
          duration: 4000
        }
      );
    };

    window.addEventListener('showRatingNotification', handleRatingNotification);
    
    return () => {
      window.removeEventListener('showRatingNotification', handleRatingNotification);
    };
  }, []);

  if (loading) {
    return <CenteredSpinner />;
  }

  if (!freight) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Frete não encontrado.</p>
          <Button onClick={onClose} className="mt-4">Voltar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-4 w-4" />
                Frete: {getCargoTypeLabel(freight.cargo_type)}
              </CardTitle>
              {/* ID do frete sempre visível */}
              <span className="text-xs text-muted-foreground font-mono">
                ID: {freight.id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(freight.status)}
              {freight.status === 'DELIVERED' && (isProducer || currentUserProfile?.role === 'ADMIN') && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleMoveToHistory} 
                  disabled={movingToHistory}
                >
                  Mover para o histórico
                </Button>
              )}
              {/* Botão X para fechar o modal */}
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-9 w-9 p-0 rounded-full border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/60 transition-all duration-200 shadow-sm"
                title="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Peso:</span>
              <p className="font-medium">{(freight.weight / 1000).toFixed(1)}t</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Distância:</span>
              <div className="flex items-center gap-2">
                <p className="font-medium">{formatKm(freight.distance_km)}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={async () => {
                    try {
                      toast.info('Recalculando distância...');
                      const { data, error } = await supabase.functions.invoke('calculate-route', {
                        body: {
                          origin: `${freight.origin_city}, ${freight.origin_state}`,
                          destination: `${freight.destination_city}, ${freight.destination_state}`,
                          origin_address_detail: {
                            street: (freight as any).origin_street || undefined,
                            number: (freight as any).origin_number || undefined,
                            neighborhood: (freight as any).origin_neighborhood || undefined,
                          },
                          destination_address_detail: {
                            street: (freight as any).destination_street || undefined,
                            number: (freight as any).destination_number || undefined,
                            neighborhood: (freight as any).destination_neighborhood || undefined,
                          },
                          origin_coords: (freight as any).origin_lat && (freight as any).origin_lng 
                            ? { lat: (freight as any).origin_lat, lng: (freight as any).origin_lng } 
                            : undefined,
                          destination_coords: (freight as any).destination_lat && (freight as any).destination_lng 
                            ? { lat: (freight as any).destination_lat, lng: (freight as any).destination_lng } 
                            : undefined,
                        }
                      });
                      
                      if (error) throw error;
                      
                      if (data && data.distance_km) {
                        // Arredondar distância antes de salvar
                        const roundedDistance = Math.round(data.distance_km);
                        
                        // Atualizar no banco
                        const { error: updateError } = await supabase
                          .from('freights')
                          .update({ distance_km: roundedDistance })
                          .eq('id', freight.id);
                        
                        if (updateError) throw updateError;
                        
                        // Atualizar estado local
                        setFreight({ ...freight, distance_km: roundedDistance });
                        toast.success(`Distância recalculada: ${roundedDistance} km`);
                      }
                    } catch (error: any) {
                      toast.error('Erro ao recalcular distância', {
                        description: error.message
                      });
                    }
                  }}
                  title="Recalcular distância usando Google Maps"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {(() => {
              // ✅ PREÇO PREENCHIDO — fonte única de verdade
              const pd = precoPreenchidoDoFrete(freight.id, {
                price: freight.price || 0,
                pricing_type: freight.pricing_type,
                price_per_km: freight.price_per_km,
                required_trucks: freight.required_trucks,
                distance_km: freight.distance_km,
                weight: freight.weight,
              });
              return (
                <>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      {pd.pricingType !== 'PER_VEHICLE' ? 'Valor unitário:' : isFreightProducer ? 'Valor total:' : 'Valor do frete:'}
                    </span>
                    <p className="font-medium">{pd.primaryText}</p>
                  </div>
                  {pd.secondaryText && (
                    <div>
                      <span className="text-muted-foreground text-xs">Detalhes:</span>
                      <p className="font-medium text-muted-foreground text-sm">{pd.secondaryText}</p>
                    </div>
                  )}
                </>
              );
            })()}
            <div>
              <span className="text-muted-foreground text-xs">Urgência:</span>
              <p className="font-medium">{getUrgencyLabel(freight.urgency)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Route Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-success" />
              Origem
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <p className="font-medium text-sm">{freight.origin_address}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Coleta: {format(new Date(freight.pickup_date), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
            {freight.pickup_observations && (
              <p className="text-xs p-2 bg-muted rounded">
                {freight.pickup_observations}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-destructive" />
              Destino
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <p className="font-medium text-sm">{freight.destination_address}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Entrega: {format(new Date(freight.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
            {freight.delivery_observations && (
              <p className="text-xs p-2 bg-muted rounded">
                {freight.delivery_observations}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ FreightAssignmentsList REMOVIDO para evitar duplicação.
          A lista de motoristas atribuídos já é exibida abaixo via participants.drivers */}

      {/* Participants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card do Produtor - oculto quando o próprio produtor está visualizando */}
        {!isFreightProducer && (
          <>
            {freight.producer?.id ? (
              <FreightParticipantCard
                participantId={freight.producer.id}
                participantType="producer"
                name={freight.producer.full_name || 'Produtor'}
                avatarUrl={freight.producer.profile_photo_url || freight.producer.selfie_url}
                rating={freight.producer.rating || 0}
                totalRatings={freight.producer.total_ratings || 0}
                onClick={() => {
                  setProfileModalOpen({ 
                    open: true, 
                    userId: freight.producer.id, 
                    userType: 'producer', 
                    userName: freight.producer.full_name || '' 
                  });
                }}
              />
            ) : requesterStatus.hasRegistration && (freight.producer_id || requesterStatus.producerId) ? (
              <FreightParticipantCard
                participantId={(freight.producer_id || requesterStatus.producerId) as string}
                participantType="producer"
                name={requesterStatus.producerName || 'Produtor'}
                avatarUrl={requesterStatus.producerPhotoUrl || undefined}
                rating={0}
                totalRatings={0}
                onClick={() => {
                  const id = (freight.producer_id || requesterStatus.producerId) as string;
                  setProfileModalOpen({
                    open: true,
                    userId: id,
                    userType: 'producer',
                    userName: requesterStatus.producerName || '',
                  });
                }}
              />
            ) : (freight.is_guest_freight || requesterStatus.type === 'GUEST') ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4" />
                    Produtor
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">Solicitante sem cadastro</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4" />
                    Produtor
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    {requesterStatus.isLoading ? 'Carregando...' : 'Produtor não identificado'}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Card do Motorista */}
        {freight.driver?.id ? (
          <div className="space-y-2">
            <FreightParticipantCard
              participantId={freight.driver.id}
              participantType="driver"
              name={freight.driver.full_name || 'Motorista'}
              avatarUrl={freight.driver.profile_photo_url || freight.driver.selfie_url}
              rating={freight.driver.rating || 0}
              totalRatings={freight.driver.total_ratings || 0}
              onClick={() => {
                setProfileModalOpen({
                  open: true,
                  userId: freight.driver.id,
                  userType: 'driver',
                  userName: freight.driver.full_name || ''
                });
              }}
            />

            {/* ✅ Exibir fotos do veículo para o produtor */}
            {isFreightProducer && <DriverVehiclePreview driverId={freight.driver.id} freightId={freightId} />}
          </div>
        ) : participants.drivers.length > 0 && (isFreightProducer || (isTransportadora && hasActiveCompanyAssignment)) ? (
          // ✅ Regra: Lista de motoristas atribuídos visível para:
          // - Produtor do frete
          // - Transportadora participante (quando existir assignment ativo da empresa)
          // Motoristas não precisam ver dados de outros motoristas no mesmo frete
          <div className="space-y-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4" />
                  Motoristas atribuídos ({participants.drivers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Toque em um motorista para ver perfil e fotos do veículo.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-2">
              {participants.drivers.map((d) => {
                // Buscar localização em tempo real deste motorista
                const driverLocation = multiDriversLocations.find(dl => dl.driverId === d.profileId);
                
                return (
                  <div key={d.id} className="space-y-2">
                    <FreightParticipantCard
                      participantId={d.profileId}
                      participantType="driver"
                      name={d.name || 'Motorista'}
                      avatarUrl={d.avatarUrl}
                      rating={d.rating || 0}
                      totalRatings={d.totalRatings || 0}
                      onClick={() => {
                        setProfileModalOpen({
                          open: true,
                          userId: d.profileId,
                          userType: 'driver',
                          userName: d.name || ''
                        });
                      }}
                    />

                    {/* ✅ Botão Localização + Histórico para o produtor */}
                    {isFreightProducer && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setLocationModalState({
                          open: true,
                          driverId: d.profileId,
                          driverName: d.name || 'Motorista',
                          avatarUrl: d.avatarUrl
                        })}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Localização e Histórico
                      </Button>
                    )}

                    {/* Evitar exposição desnecessária: fotos do veículo apenas para o produtor */}
                    {isFreightProducer && <DriverVehiclePreview driverId={d.profileId} freightId={freightId} />}
                  </div>
                );
              })}
            </div>

            {/* ✅ Exibir transportadoras envolvidas */}
            {participants.companies.length > 0 && (
              <Card className="mt-3">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" />
                    Transportadoras ({participants.companies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {participants.companies.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{c.companyName || c.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : isDriver && isParticipant ? (
          // ✅ CORREÇÃO: Em fretes multi-carreta (driver_id nulo), o motorista deve ver o próprio perfil
          // e não "Aguardando motorista".
          <div className="space-y-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4" />
                  Motorista
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <FreightParticipantCard
                  participantId={currentUserProfile.id}
                  participantType="driver"
                  name={currentUserProfile.full_name || 'Motorista'}
                  avatarUrl={currentUserProfile.profile_photo_url || currentUserProfile.selfie_url}
                  rating={currentUserProfile.rating || 0}
                  totalRatings={currentUserProfile.total_ratings || 0}
                  onClick={() => {
                    setProfileModalOpen({
                      open: true,
                      userId: currentUserProfile.id,
                      userType: 'driver',
                      userName: currentUserProfile.full_name || ''
                    });
                  }}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4" />
                Motorista
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">Aguardando motorista</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Botões de Ação: Avaliação e CT-e */}
      <div className="flex flex-wrap gap-2">
        {/* Botões de Avaliação */}
        {canRate() && (
          <>
            {isDriver && freight.producer?.full_name && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenRating(freight.producer)}
              >
                <Star className="h-3 w-3 mr-1" />
                Avaliar Produtor
              </Button>
            )}
            {isProducer && freight.driver?.full_name && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenRating(freight.driver)}
              >
                <Star className="h-3 w-3 mr-1" />
                Avaliar Motorista
              </Button>
            )}
          </>
        )}

        {/* Botão Emitir CT-e para Transportadoras */}
        {canEmitCTe && (
          <Button
            size="sm"
            variant="default"
            onClick={() => setCteModalOpen(true)}
          >
            <FileCheck className="h-3 w-3 mr-1" />
            Emitir CT-e
          </Button>
        )}
      </div>

      {/* Advance Request Notifications */}
      {isProducer && advances && advances.filter(advance => advance.status === 'PENDING').length > 0 && (
        <Card className={`border-2 ${
          freight.metadata?.advance_payment_required 
            ? 'border-red-300 bg-red-50 ring-2 ring-red-200' 
            : 'border-orange-200 bg-orange-50'
        }`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell className={`h-4 w-4 ${
                    freight.metadata?.advance_payment_required 
                      ? 'text-red-600' 
                      : 'text-orange-600'
                  }`} />
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center">
                    {advances.filter(advance => advance.status === 'PENDING').length}
                  </span>
                </div>
                <div>
                  <p className={`font-medium text-sm ${
                    freight.metadata?.advance_payment_required 
                      ? 'text-red-800' 
                      : 'text-orange-800'
                  }`}>
                    {freight.metadata?.advance_payment_required 
                      ? '🚨 PAGAMENTO OBRIGATÓRIO' 
                      : (advances.filter(advance => advance.status === 'PENDING').length === 1 
                        ? 'Nova solicitação de adiantamento' 
                        : `${advances.filter(advance => advance.status === 'PENDING').length} solicitações de adiantamento`
                      )
                    }
                  </p>
                  <p className={`text-xs ${
                    freight.metadata?.advance_payment_required 
                      ? 'text-red-600' 
                      : 'text-orange-600'
                  }`}>
                    {freight.metadata?.advance_payment_required 
                      ? 'Você deve aprovar pelo menos um adiantamento'
                      : 'O motorista solicitou adiantamento para este frete'
                    }
                  </p>
                </div>
              </div>
              <Button
                variant={freight.metadata?.advance_payment_required ? "destructive" : "outline"}
                size="sm"
                className={`${freight.metadata?.advance_payment_required 
                  ? "bg-red-600 hover:bg-red-700 ring-2 ring-red-300" 
                  : "border-orange-300 text-orange-700 hover:bg-orange-100"
                }`}
                onClick={() => {
                  // Tenta ir direto para a lista de solicitações
                  const requests = document.getElementById('advance-requests');
                  if (requests) {
                    requests.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                  }
                  // Fallback: cartão de pagamentos
                  const paymentSection = document.getElementById('payment-section');
                  if (paymentSection) {
                    paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                  }
                  // Último fallback: seletor por atributo
                  const paymentCard = document.querySelector('[data-payment-card]');
                  if (paymentCard instanceof HTMLElement) {
                    paymentCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                {freight.metadata?.advance_payment_required ? 'PAGAR AGORA' : 'Ver Solicitações'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Actions */}
      {(canRequestAdvance || canMakePayment || (isDriver && freight?.status === 'ACCEPTED') || (isProducer && advances && advances.filter(advance => advance.status === 'PENDING').length > 0)) && (
        <Card id="payment-section" data-payment-card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {(canRequestAdvance || canMakePayment) ? 'Pagamentos' : 'Ações do Frete'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {totalAdvances > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                <p className="text-xs font-medium text-green-700 dark:text-green-300">
                  Adiantamentos pagos: R$ {totalAdvances.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Valor restante: R$ {remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* Mandatory Advance Payment Alert */}
            {isProducer && freight.metadata?.advance_payment_required && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Bell className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Pagamento de Adiantamento Obrigatório
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        Sua carga foi carregada e há solicitações de adiantamento pendentes. 
                        Você deve aprovar pelo menos uma solicitação antes de prosseguir com o frete.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Advance Requests for Producers */}
            {isProducer && advances && advances.filter(advance => advance.status === 'PENDING').length > 0 && (
              <div className="space-y-2" id="advance-requests">
                <h4 className="font-medium text-xs">Solicitações de Adiantamento</h4>
                {advances.filter(advance => advance.status === 'PENDING').map((advance) => (
                  <div key={advance.id} className={`${
                    freight.metadata?.advance_payment_required 
                      ? 'bg-red-50 border-red-300 ring-2 ring-red-200' 
                      : 'bg-orange-50 border-orange-200'
                  } border rounded-lg p-3`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">
                          {freight.metadata?.advance_payment_required 
                            ? '🚨 Adiantamento solicitado (OBRIGATÓRIO)' 
                            : 'Adiantamento solicitado'
                          }
                        </p>
                        <p className={`text-lg font-bold ${
                          freight.metadata?.advance_payment_required 
                            ? 'text-red-600' 
                            : 'text-orange-600'
                        }`}>
                          R$ {((advance.requested_amount || 0) / 100).toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Solicitado em {new Date(advance.requested_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-800">
                          <strong>Pagamento direto:</strong> Faça o pagamento diretamente ao motorista via PIX ou transferência bancária.
                        </div>
                        <div className="flex gap-2">
                          <Button
                            disabled={true}
                            className="bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            size="sm"
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Pagar via Plataforma
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!!freight.metadata?.advance_payment_required}
                            onClick={async (e) => {
                              if (freight.metadata?.advance_payment_required) {
                                toast.error("Você deve aprovar pelo menos um adiantamento antes de recusar outros.");
                                return;
                              }
                              
                              e.currentTarget.disabled = true; // Prevent multiple clicks
                              try {
                                const reason = window.prompt("Motivo da rejeição (opcional):");
                                if (reason === null) return; // User cancelled
                                
                                const { error } = await supabase.functions.invoke('reject-freight-advance', {
                                  body: { 
                                    advance_id: advance.id,
                                    rejection_reason: reason?.trim() || undefined
                                  }
                                });
                                
                                if (error) {
                                  if (error.message?.includes('já foi processad')) {
                                    toast.error("Esta solicitação já foi processada");
                                  } else {
                                    throw error;
                                  }
                                  return;
                                }
                                
                                toast.success("Adiantamento rejeitado com sucesso");
                                fetchFreightDetails(); // Refresh data
                              } catch (error) {
                                console.error('Error rejecting advance:', error);
                                toast.error("Erro ao rejeitar adiantamento");
                              } finally {
                                e.currentTarget.disabled = false; // Re-enable after request
                              }
                            }}
                            title={freight.metadata?.advance_payment_required ? "Você deve aprovar pelo menos um adiantamento primeiro" : "Recusar adiantamento"}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Recusar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Advance History */}
            {advances && advances.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-xs">Histórico de Adiantamentos</h4>
                {advances.filter(advance => advance.status !== 'PENDING').map((advance) => (
                  <div key={advance.id} className="bg-muted/20 p-2 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">
                          R$ {((advance.approved_amount || advance.requested_amount || 0) / 100).toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {advance.status === 'APPROVED' ? 'Aprovado' : 
                           advance.status === 'PAID' ? 'Pago' : 
                           advance.status === 'REJECTED' ? 'Rejeitado' : advance.status}
                        </p>
                      </div>
                      <Badge variant={
                        advance.status === 'PAID' ? 'default' : 
                        advance.status === 'APPROVED' ? 'secondary' : 
                        'destructive'
                      } className="text-xs">
                        {advance.status === 'PAID' ? 'Pago' : 
                         advance.status === 'APPROVED' ? 'Aprovado' : 
                         advance.status === 'REJECTED' ? 'Rejeitado' : advance.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              {canRequestAdvance && (
                <Button 
                  onClick={() => setAdvanceModalOpen(true)}
                  variant="default"
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Solicitar Adiantamento
                </Button>
              )}
              
              {canMakePayment && (
                <Button 
                  onClick={() => setPaymentModalOpen(true)}
                  size="sm"
                  className="flex-1"
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  Pagar Frete
                </Button>
              )}
            </div>

            {/* Botão Manifesto - disponível para transportadoras e motoristas */}
            {(isDriver || currentUserProfile?.role === 'TRANSPORTADORA') && (
              freight?.status === 'ACCEPTED' || 
              freight?.status === 'LOADING' || 
              freight?.status === 'IN_TRANSIT' ||
              freight?.status === 'DELIVERED_PENDING_CONFIRMATION' ||
              freight?.status === 'DELIVERED'
            ) && (
              <div className="pt-2">
                <Button 
                  onClick={() => setManifestoModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <FileText className="h-3 w-3" />
                  Manifesto
                </Button>
              </div>
            )}

            {/* Botão de desistir do frete para motoristas */}
            {isDriver && (freight?.status === 'ACCEPTED' || freight?.status === 'LOADING') && onFreightWithdraw && (
              <div className="pt-2 border-t">
                <Button 
                  onClick={() => onFreightWithdraw(freight)}
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 text-xs"
                >
                  Desistir do Frete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs - Only for participants */}
      {isParticipant && (
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="status" className="text-sm">Status</TabsTrigger>
            <TabsTrigger value="chat" className="text-sm">
              <MessageCircle className="h-3 w-3 mr-1" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="nfes" className="text-sm">
              <FileText className="h-3 w-3 mr-1" />
              NF-es
            </TabsTrigger>
            <TabsTrigger value="antifraude" className="text-sm">
              <Shield className="h-3 w-3 mr-1" />
              Antifraude
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" forceMount className="mt-4 data-[state=inactive]:hidden">
            <FreightStatusTracker
              freightId={freightId}
              currentStatus={effectiveStatus}
              currentUserProfile={currentUserProfile}
              isDriver={isDriver}
              freightServiceType={freight?.service_type}
              originLat={freight?.origin_lat}
              originLng={freight?.origin_lng}
              destinationLat={freight?.destination_lat}
              destinationLng={freight?.destination_lng}
              originCity={freight?.origin_city}
              originState={freight?.origin_state}
              destinationCity={freight?.destination_city}
              destinationState={freight?.destination_state}
              onStatusUpdated={(newStatus) => {
                // Atualizar estado local do frete
                setFreight((prev: any) => prev ? { ...prev, status: newStatus } : prev);
                // Recarregar detalhes completos
                fetchFreightDetails();
              }}
              companyId={currentUserProfile?.transport_company_id || undefined}
              assignmentId={driverAssignment?.id || companyDriverAssignment?.id || undefined}
            />
          </TabsContent>
          
          <TabsContent value="chat" forceMount className="mt-4 data-[state=inactive]:hidden">
            <Suspense fallback={<CenteredSpinner />}>
              <FreightChat
                freightId={freightId}
                currentUserProfile={currentUserProfile}
              />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="nfes" forceMount className="mt-4 data-[state=inactive]:hidden">
            <FreightNfePanel freightId={freightId} autoLoad={false} />
          </TabsContent>
          
          <TabsContent value="antifraude" forceMount className="mt-4 data-[state=inactive]:hidden">
            <AntifraudPanel 
              freightId={freightId}
              originCity={freight?.origin_city}
              destinationCity={freight?.destination_city}
              driverName={freight?.driver?.full_name}
              originLat={freight?.origin_lat}
              originLng={freight?.origin_lng}
              destinationLat={freight?.destination_lat}
              destinationLng={freight?.destination_lng}
              currentLat={freight?.current_lat}
              currentLng={freight?.current_lng}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Documents */}
      {freight.fiscal_documents_url && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Documentos Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" size="sm" asChild>
              <a 
                href={freight.fiscal_documents_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <FileText className="h-3 w-3" />
                Visualizar Documentos
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {ratingModalOpen && freight && (
        <FreightRatingModal
          freight={{
            id: freight.id,
            producer_profiles: freight.producer,
            driver_profiles: freight.driver,
            metadata: freight.metadata
          }}
          isOpen={ratingModalOpen}
          onClose={() => setRatingModalOpen(false)}
          onRatingSubmitted={() => {
            setRatingModalOpen(false);
            fetchFreightDetails(); // Refresh data
          }}
          userRole={currentUserProfile?.role as 'PRODUTOR' | 'MOTORISTA'}
        />
      )}

      {advanceModalOpen && (
        <FreightAdvanceModal
          isOpen={advanceModalOpen}
          onClose={() => setAdvanceModalOpen(false)}
          freightId={freightId}
          freightPrice={freight?.price || 0}
        />
      )}

      {paymentModalOpen && (
        <FreightPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          freightId={freightId}
          freightPrice={freight?.price || 0}
          advancesTotal={totalAdvances}
        />
      )}

      {/* Modal de Avaliação Automática */}
      {showAutoRatingModal && autoUserToRate && (
        <AutoRatingModal
          isOpen={showAutoRatingModal}
          onClose={closeAutoRatingModal}
          freightId={freightId}
          userToRate={autoUserToRate}
          currentUserProfile={currentUserProfile}
        />
      )}

      {/* Modal de Manifesto */}
      <ManifestoModal 
        open={manifestoModalOpen}
        onClose={() => setManifestoModalOpen(false)}
        freightId={freightId}
      />

      {/* Modal de Perfil Público */}
      <ParticipantProfileModal
        isOpen={profileModalOpen.open}
        onClose={() => setProfileModalOpen({ open: false, userId: '', userType: 'driver', userName: '' })}
        userId={profileModalOpen.userId}
        userType={profileModalOpen.userType}
        userName={profileModalOpen.userName}
        freightId={freightId}
      />

      {/* Modal de Emissão de CT-e */}
      <CTeEmitirDialog
        open={cteModalOpen}
        onOpenChange={setCteModalOpen}
        freightId={freightId}
        onSuccess={() => {
          setCteModalOpen(false);
          fetchFreightDetails();
        }}
      />

      {/* Modal de Localização + Histórico do Motorista */}
      {locationModalState.open && (
        <DriverLocationModal
          open={locationModalState.open}
          onOpenChange={(open) => setLocationModalState({ ...locationModalState, open })}
          driverId={locationModalState.driverId}
          driverName={locationModalState.driverName}
          freightId={freightId}
          avatarUrl={locationModalState.avatarUrl}
          lat={multiDriversLocations.find(d => d.driverId === locationModalState.driverId)?.lat}
          lng={multiDriversLocations.find(d => d.driverId === locationModalState.driverId)?.lng}
          isOnline={multiDriversLocations.find(d => d.driverId === locationModalState.driverId)?.isOnline}
          secondsAgo={multiDriversLocations.find(d => d.driverId === locationModalState.driverId)?.secondsAgo}
          currentStatus={multiDriversLocations.find(d => d.driverId === locationModalState.driverId)?.assignmentStatus}
        />
      )}
    </div>
  );
};