/**
 * src/components/FreightInProgressCard.tsx
 * 
 * Card padronizado para fretes em andamento.
 * Usado em múltiplos dashboards (Produtor, Motorista, Transportadora).
 * Inclui abas para Detalhes e Mapa em tempo real.
 * 
 * CORRIGIDO: Usa useRequesterStatus para determinar corretamente
 * se o solicitante é cadastrado ou convidado.
 */

import React, { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Truck, Clock, ArrowRight, Calendar, AlertTriangle, Bike, Map, FileText, Loader2, User, Users } from 'lucide-react';
import { DriverVehiclePreview } from '@/components/freight/DriverVehiclePreview';
import { MultiDriversList } from '@/components/freight/MultiDriversList';
import { getFreightStatusLabel, getFreightStatusVariant, normalizeFreightStatus } from '@/lib/freight-status';
import { formatKm, formatBRL, formatPricePerTruck, formatTons, formatDate, formatCityState } from '@/lib/formatters';
import { SafeStatusBadge } from '@/components/security';
import { LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { getDaysUntilPickup, getPickupDateBadge } from '@/utils/freightDateHelpers';
import { useRequesterStatus } from '@/hooks/useRequesterStatus';
import { useAuth } from '@/hooks/useAuth';

// Lazy load do mapa MapLibre para performance (100% gratuito, sem Google Maps)
const FreightRealtimeMap = lazy(() => 
  import('@/components/freight/FreightRealtimeMapMapLibre').then(module => ({ 
    default: module.FreightRealtimeMapMapLibre 
  }))
);

// ✅ Lazy load do mapa multi-motorista para fretes multi-carreta
const MultiDriverMap = lazy(() => 
  import('@/components/freight/MultiDriverMapMapLibre').then(module => ({ 
    default: module.MultiDriverMapMapLibre 
  }))
);

// Fallback para quando o mapa falha ao carregar
const MapErrorFallback = () => (
  <div className="flex flex-col items-center justify-center h-[300px] bg-muted/50 rounded-lg border border-dashed gap-2">
    <Map className="h-8 w-8 text-muted-foreground/50" />
    <span className="text-muted-foreground text-sm">Mapa indisponível no momento</span>
    <span className="text-muted-foreground text-xs">Tente recarregar a página</span>
  </div>
);

// ErrorBoundary para capturar falhas no lazy load do mapa
class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[FreightInProgressCard] Map load error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <MapErrorFallback />;
    }
    return this.props.children;
  }
}

interface FreightInProgressCardProps {
  freight: {
    id: string;
    origin_city?: string;
    origin_state?: string;
    origin_address?: string;
    destination_city?: string;
    destination_state?: string;
    destination_address?: string;
    origin_lat?: number;
    origin_lng?: number;
    destination_lat?: number;
    destination_lng?: number;
    weight: number | null;
    distance_km: number | null;
    pickup_date: string | null;
    price: number | null;
    required_trucks?: number | null;
    price_display_mode?: 'TOTAL' | 'PER_TRUCK';
    original_required_trucks?: number | null;
    status: string;
    service_type?: string | null;
    driver_profiles?: {
      full_name: string;
      profile_photo_url?: string;
    } | null;
    producer?: {
      id?: string;
      full_name: string;
      profile_photo_url?: string;
    } | null;
    producer_id?: string | null;
    is_guest_freight?: boolean;
    driver_id?: string;
    drivers_assigned?: string[];
    accepted_trucks?: number | null;
    deliveryDeadline?: {
      hoursRemaining: number;
      isUrgent: boolean;
      isCritical: boolean;
      displayText: string;
    };
    current_lat?: number;
    current_lng?: number;
    last_location_update?: string;
    tracking_status?: string;
  };
  onViewDetails?: () => void;
  onRequestCancel?: () => void;
  showActions?: boolean;
  highlightFreightId?: string;
  /** Ações customizadas de workflow para serviços (PET, Pacotes, etc.) - renderiza dentro do card */
  serviceWorkflowActions?: React.ReactNode;
}

const FreightInProgressCardComponent: React.FC<FreightInProgressCardProps> = ({
  freight,
  onViewDetails,
  onRequestCancel,
  showActions = true,
  highlightFreightId,
  serviceWorkflowActions,
}) => {
  const { profile } = useAuth();
  // ✅ Regra de exibição de valores:
  // - Motorista: NUNCA pode ver o total (somente /carreta)
  // - Produtor: pode ver total (linha secundária)
  // - Transportadora: frequentemente precisa ver o total do contrato; mostramos total como valor principal
  const viewerRole = profile?.role;
  const canShowTotalFreightValue = viewerRole === 'PRODUTOR' || viewerRole === 'TRANSPORTADORA';
  const preferTotalAsPrimary = viewerRole === 'TRANSPORTADORA';

  const [activeTab, setActiveTab] = useState<string>('details');
  const [mapMounted, setMapMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0); // ✅ Key para forçar re-render do mapa
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // ✅ NOVO: Hook para verificar status do solicitante
  const requesterStatus = useRequesterStatus(freight.id, {
    producer: freight.producer,
    isGuestFreight: freight.is_guest_freight,
    producerId: freight.producer_id,
    autoFetch: true,
  });

  // GPS precision indicator
  const precisionInfo = React.useMemo(() => {
    const originReal = freight.origin_lat !== null && freight.origin_lat !== undefined && 
                       freight.origin_lng !== null && freight.origin_lng !== undefined;
    const destReal = freight.destination_lat !== null && freight.destination_lat !== undefined && 
                     freight.destination_lng !== null && freight.destination_lng !== undefined;
    
    if (originReal && destReal) {
      return {
        isAccurate: true,
        icon: '📍',
        tooltip: 'Distância calculada com GPS preciso'
      };
    }
    
    return {
      isAccurate: false,
      icon: '📌',
      tooltip: 'Distância estimada por endereço'
    };
  }, [freight.origin_lat, freight.origin_lng, freight.destination_lat, freight.destination_lng]);

  const isHighlighted = highlightFreightId === freight.id;

  // Verificar se o frete está em andamento (permite mapa)
  // Inclui LOADED/CARREGADO para que o mapa funcione nesse status também
  // ✅ CORREÇÃO: Para fretes multi-carreta (OPEN mas com drivers_assigned), 
  // o produtor deve poder ver a localização dos motoristas já atribuídos
  const normalizedStatus = normalizeFreightStatus(freight.status ?? '');
  const hasAssignedDrivers = Array.isArray(freight.drivers_assigned) && freight.drivers_assigned.length > 0;
  const hasMainDriver = !!freight.driver_id;
  const hasAcceptedTrucks = (freight.accepted_trucks ?? 0) > 0;
  
  // ✅ NOVO: Detectar se é frete multi-carreta (múltiplos motoristas)
  const isMultiTruckFreight = (freight.required_trucks ?? 1) > 1;
  const hasMultipleDrivers = hasAssignedDrivers && (freight.drivers_assigned?.length ?? 0) > 1;
  // Usar mapa multi-motorista se é produtor vendo frete multi-carreta com motoristas
  const shouldUseMultiDriverMap = canShowTotalFreightValue && (isMultiTruckFreight || hasMultipleDrivers) && (hasAssignedDrivers || hasAcceptedTrucks);
  
  const canShowMap = [
    'ACCEPTED', 
    'LOADING', 
    'LOADED', 
    'IN_TRANSIT', 
    'DELIVERED_PENDING_CONFIRMATION'
  ].includes(normalizedStatus) || (normalizedStatus === 'OPEN' && (hasAssignedDrivers || hasMainDriver || hasAcceptedTrucks));

  const priceDisplayMode = freight.price_display_mode;
  const originalRequiredTrucks = Math.max((freight.original_required_trucks ?? freight.required_trucks) || 1, 1);

  // ✅ Handler para quando a aba mapa é selecionada
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'map') {
      if (!mapMounted) {
        setMapMounted(true);
      }
      // ✅ Forçar re-render do mapa para garantir que ele carregue corretamente
      // quando a aba é selecionada (resolve problema de tela em branco)
      // Delay maior para garantir que o container esteja visível
      setTimeout(() => {
        setMapKey(prev => prev + 1);
      }, 150);
    }
  };

  // ✅ Resolver nome e foto do produtor usando o hook
  const producerInfo = React.useMemo(() => {
    // Prioridade 1: Dados locais do freight.producer
    if (freight.producer?.full_name) {
      return {
        name: freight.producer.full_name,
        photoUrl: freight.producer.profile_photo_url || null,
        hasRegistration: true,
      };
    }
    
    // Prioridade 2: Dados do hook useRequesterStatus
    if (requesterStatus.hasRegistration && requesterStatus.producerName) {
      return {
        name: requesterStatus.producerName,
        photoUrl: requesterStatus.producerPhotoUrl,
        hasRegistration: true,
      };
    }
    
    // Prioridade 3: É um frete de convidado
    if (requesterStatus.type === 'GUEST' || freight.is_guest_freight) {
      return {
        name: 'Solicitante não cadastrado',
        photoUrl: null,
        hasRegistration: false,
      };
    }
    
    // Loading ou desconhecido
    if (requesterStatus.isLoading) {
      return {
        name: 'Carregando...',
        photoUrl: null,
        hasRegistration: false,
      };
    }
    
    // Fallback: Produtor não identificado (mas não é guest)
    return {
      name: 'Produtor não identificado',
      photoUrl: null,
      hasRegistration: requesterStatus.hasRegistration,
    };
  }, [freight.producer, freight.is_guest_freight, requesterStatus]);

  return (
    <Card className={cn(
      "h-full flex flex-col border-l-4 hover:shadow-lg transition-all overflow-hidden",
      isHighlighted ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-xl ring-2 ring-yellow-400" : "border-l-primary"
    )}>
      <CardHeader className="pb-2 min-h-[100px] overflow-x-auto">
        <div className="min-w-fit">
          {/* Origem → Destino */}
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm whitespace-nowrap">
              {freight.origin_city && freight.origin_state
                ? formatCityState(freight.origin_city, freight.origin_state)
                : 'Carregando origem...'}
            </p>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="font-semibold text-sm whitespace-nowrap">
              {freight.destination_city && freight.destination_state
                ? formatCityState(freight.destination_city, freight.destination_state)
                : 'Carregando destino...'}
            </p>
          </div>

          {/* Endereços detalhados (coleta e entrega) */}
          {(freight.origin_address || freight.destination_address) && (
            <div className="text-xs text-muted-foreground space-y-0.5 mb-1">
              {freight.origin_address && (
                <p className="truncate" title={freight.origin_address}>📍 Coleta: {freight.origin_address}</p>
              )}
              {freight.destination_address && (
                <p className="truncate" title={freight.destination_address}>🏁 Entrega: {freight.destination_address}</p>
              )}
            </div>
          )}

          {/* Container para badges e informações */}
          <div className="flex items-start justify-between gap-3 mt-3">
            {/* Pílulas: peso, distância (com precisão GPS), data */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap shrink-0">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span>{formatTons(freight.weight)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap shrink-0" title={precisionInfo.tooltip}>
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>{formatKm(typeof freight.distance_km === 'number' ? freight.distance_km : 0)}</span>
                <span className="text-[10px]">{precisionInfo.icon}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap shrink-0">
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span>{formatDate(freight.pickup_date)}</span>
              </div>
              {/* Badge de capacidade máxima para moto */}
              {freight.service_type === 'FRETE_MOTO' && (
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 shrink-0">
                  <Bike className="h-3 w-3 mr-1" />
                  Máx. 500kg
                </Badge>
              )}
            </div>

            {/* Status e Preço no lado direito */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {/* ✅ SEGURANÇA: SafeStatusBadge - NUNCA renderiza string crua */}
              <SafeStatusBadge
                status={freight.status}
                type="freight"
                className="whitespace-nowrap"
              />
              
              {/* Badge de dias até coleta */}
              {(() => {
                const badgeInfo = getPickupDateBadge(freight.pickup_date);
                
                if (!badgeInfo) return null;
                
                const iconMap = {
                  AlertTriangle,
                  Clock,
                  Calendar
                };
                const IconComponent = iconMap[badgeInfo.icon];
                
                return (
                  <Badge variant={badgeInfo.variant} className="text-xs whitespace-nowrap flex items-center gap-1 justify-end">
                    <IconComponent className="h-3 w-3" />
                    {badgeInfo.text}
                  </Badge>
                );
              })()}
            
              {(() => {
                // ✅ Segurança (Motorista): quando o preço já é unitário, nunca exibir total.
                if (priceDisplayMode === 'PER_TRUCK') {
                  const unitPrice = typeof freight.price === 'number' && Number.isFinite(freight.price) ? freight.price : 0;
                  const totalFromUnit = unitPrice * Math.max(originalRequiredTrucks || 1, 1);

                  // ✅ Transportadora: exibir TOTAL como primário e /carreta como secundário
                  if (preferTotalAsPrimary && originalRequiredTrucks > 1) {
                    return (
                      <div className="flex flex-col items-end">
                        <p className="font-bold text-lg text-primary whitespace-nowrap">
                          {formatBRL(totalFromUnit, true)}
                        </p>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatBRL(unitPrice, true)}
                          <span className="font-semibold">/carreta</span>
                          <span className="ml-1">({originalRequiredTrucks} carretas)</span>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <p className="font-bold text-lg text-primary whitespace-nowrap">
                      {formatBRL(unitPrice, true)}
                      {originalRequiredTrucks > 1 && (
                        <span className="text-xs font-semibold text-muted-foreground">/carreta</span>
                      )}
                    </p>
                  );
                }

                const priceInfo = formatPricePerTruck(freight.price, freight.required_trucks, true);

                if (priceInfo.hasMultipleTrucks) {
                  // ✅ Transportadora: exibir TOTAL como primário e /carreta como secundário
                  if (preferTotalAsPrimary) {
                    return (
                      <div className="flex flex-col items-end">
                        <p className="font-bold text-lg text-primary whitespace-nowrap">
                          {priceInfo.totalPrice}
                        </p>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {priceInfo.pricePerTruck}
                          <span className="font-semibold">/carreta</span>
                          <span className="ml-1">({priceInfo.trucksCount} carretas)</span>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col items-end">
                      <p className="font-bold text-lg text-primary whitespace-nowrap">
                        {priceInfo.pricePerTruck}
                        <span className="text-xs font-semibold text-muted-foreground">/carreta</span>
                      </p>
                      {canShowTotalFreightValue && (
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                          Total ({priceInfo.trucksCount} carretas): {priceInfo.totalPrice}
                        </p>
                      )}
                    </div>
                  );
                }

                return (
                  <p className="font-bold text-lg text-primary whitespace-nowrap">
                    {formatBRL(freight.price, true)}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Deadline indicator */}
          {freight.deliveryDeadline && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs font-bold mt-2",
              freight.deliveryDeadline.isCritical && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
              freight.deliveryDeadline.isUrgent && !freight.deliveryDeadline.isCritical && "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
              !freight.deliveryDeadline.isUrgent && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
            )}>
              <Clock className="h-3 w-3" />
              {freight.deliveryDeadline.displayText}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 flex-1 pt-0 overflow-hidden">
        {/* Abas: Detalhes e Mapa */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="details" className="text-xs flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger 
              value="map" 
              className="text-xs flex items-center gap-1.5"
              disabled={!canShowMap}
            >
              <Map className="h-3.5 w-3.5" />
              Mapa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 flex flex-col mt-2 space-y-3 overflow-y-auto max-h-[300px]">
            {/* ✅ PRODUTOR vendo MOTORISTAS: Mostrar lista completa de todos os motoristas */}
            {canShowTotalFreightValue && (isMultiTruckFreight || hasMultipleDrivers) && (hasAssignedDrivers || hasAcceptedTrucks) ? (
              <>
                {/* Indicador de capacidade */}
                <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">Motoristas</span>
                  </div>
                  <Badge variant="secondary">
                    {freight.accepted_trucks ?? freight.drivers_assigned?.length ?? 0} / {freight.required_trucks ?? 1} carretas
                  </Badge>
                </div>
                
                {/* Lista completa de motoristas com status individual e veículos */}
                <MultiDriversList freightId={freight.id} />
              </>
            ) : (
              /* Layout original para frete de 1 carreta ou motorista vendo produtor */
              <>
                {/* Grid de informações */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {/* Coluna 1: Motorista OU Produtor (depende de quem está vendo) */}
                  <div className="min-w-0">
                    {/* ✅ CORRIGIDO: Usa producerInfo do hook para exibição correta */}
                    {/* Se temos producer_id ou producer object, é contexto de motorista vendo produtor */}
                    {(freight.producer_id || freight.producer) ? (
                      <>
                        <p className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                          Produtor
                        </p>
                        <div className="flex items-center gap-2">
                          {producerInfo.photoUrl ? (
                            <img 
                              src={producerInfo.photoUrl} 
                              alt="Foto do produtor"
                              className="h-6 w-6 rounded-full object-cover border"
                              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <p className={cn(
                            "truncate whitespace-nowrap",
                            producerInfo.hasRegistration ? "text-foreground" : "text-muted-foreground italic"
                          )}>
                            {producerInfo.name}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                          {LABELS.MOTORISTA_LABEL}
                        </p>
                        <div className="flex items-center gap-2">
                          {freight.driver_profiles?.profile_photo_url ? (
                            <img 
                              src={freight.driver_profiles.profile_photo_url} 
                              alt="Foto do motorista"
                              className="h-6 w-6 rounded-full object-cover border"
                              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <p className="text-foreground truncate whitespace-nowrap">
                            {freight.driver_profiles?.full_name || LABELS.AGUARDANDO_MOTORISTA}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                      {LABELS.PESO_LABEL}
                    </p>
                    <p className="text-foreground truncate whitespace-nowrap">
                      {formatTons(freight.weight)}
                    </p>
                  </div>
                </div>

                {/* Preview do veículo do motorista */}
                {(freight.driver_id || (freight.drivers_assigned && freight.drivers_assigned.length > 0)) && (
                  <DriverVehiclePreview 
                    driverId={freight.driver_id || (freight.drivers_assigned?.[0] ?? '')}
                    freightId={freight.id}
                  />
                )}
              </>
            )}

            {/* Botões de ação - padrão ou customizado para serviços */}
            {serviceWorkflowActions ? (
              <div className="mt-auto pt-3 space-y-2">
                {serviceWorkflowActions}
              </div>
            ) : showActions && (
              <div className="mt-auto grid grid-cols-2 gap-3 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onViewDetails}
                  className="w-full"
                >
                  {LABELS.VER_DETALHES}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onRequestCancel}
                  className="w-full"
                >
                  {LABELS.CANCELAR}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent 
            value="map" 
            className="mt-2" 
            style={{ minHeight: '280px' }}
            ref={tabsContainerRef}
          >
            {mapMounted && activeTab === 'map' && (
              <MapErrorBoundary>
                <Suspense fallback={
                  <div className="flex items-center justify-center bg-muted/30 rounded-lg" style={{ height: '280px' }}>
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-sm">Carregando mapa...</span>
                    </div>
                  </div>
                }>
                  {/* ✅ NOVO: Usar mapa multi-motorista para fretes multi-carreta do produtor */}
                  {shouldUseMultiDriverMap ? (
                    <MultiDriverMap
                      key={`multi-map-${freight.id}-${mapKey}`}
                      freightId={freight.id}
                      originLat={freight.origin_lat}
                      originLng={freight.origin_lng}
                      destinationLat={freight.destination_lat}
                      destinationLng={freight.destination_lng}
                      originCity={freight.origin_city}
                      originState={freight.origin_state}
                      destinationCity={freight.destination_city}
                      destinationState={freight.destination_state}
                    />
                  ) : (
                    <FreightRealtimeMap
                      key={`map-${freight.id}-${mapKey}`}
                      freightId={freight.id}
                      originLat={freight.origin_lat}
                      originLng={freight.origin_lng}
                      destinationLat={freight.destination_lat}
                      destinationLng={freight.destination_lng}
                      originCity={freight.origin_city}
                      originState={freight.origin_state}
                      destinationCity={freight.destination_city}
                      destinationState={freight.destination_state}
                      initialDriverLat={freight.current_lat}
                      initialDriverLng={freight.current_lng}
                      lastLocationUpdate={freight.last_location_update}
                    />
                  )}
                </Suspense>
              </MapErrorBoundary>
            )}
            {!mapMounted && (
              <Button
                variant="outline"
                className="w-full h-[280px] flex flex-col items-center justify-center gap-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setMapMounted(true);
                  setMapKey(prev => prev + 1);
                }}
              >
                <Map className="h-10 w-10 text-primary opacity-70" />
                <span className="text-sm font-medium">Clique para abrir o mapa</span>
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// ✅ Memoização para evitar re-renders desnecessários em listas
// Não comparar callbacks (onViewDetails, onRequestCancel) pois são instáveis quando inline
export const FreightInProgressCard = React.memo(FreightInProgressCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.freight.id === nextProps.freight.id &&
    prevProps.freight.status === nextProps.freight.status &&
    prevProps.freight.price === nextProps.freight.price &&
    prevProps.freight.current_lat === nextProps.freight.current_lat &&
    prevProps.freight.current_lng === nextProps.freight.current_lng &&
    prevProps.showActions === nextProps.showActions &&
    prevProps.highlightFreightId === nextProps.highlightFreightId &&
    // ✅ Incluir producer para evitar "Solicitante sem cadastro"
    prevProps.freight.producer?.full_name === nextProps.freight.producer?.full_name &&
    prevProps.freight.producer_id === nextProps.freight.producer_id &&
    prevProps.freight.is_guest_freight === nextProps.freight.is_guest_freight &&
    prevProps.freight.driver_profiles?.full_name === nextProps.freight.driver_profiles?.full_name
  );
});
