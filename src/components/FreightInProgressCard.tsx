/**
 * src/components/FreightInProgressCard.tsx
 * 
 * Card padronizado para fretes em andamento.
 * Usado em múltiplos dashboards (Produtor, Motorista, Transportadora).
 * Inclui abas para Detalhes e Mapa em tempo real.
 * 
 * ✅ REDESIGN: Alinhado com o visual do FreightCard (dot-line, 3-col grid, service icon header).
 */

import React, { useState, lazy, Suspense, useMemo, useRef } from 'react';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';
import { resolveUiPriceMode } from '@/lib/precoUI';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  MapPin, Truck, Clock, Calendar, Package, Wrench, Home,
  Map, FileText, Loader2, User, Users, Bike, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react';
import { DriverVehiclePreview } from '@/components/freight/DriverVehiclePreview';
import { MultiDriversList } from '@/components/freight/MultiDriversList';
import { normalizeFreightStatus } from '@/lib/freight-status';
import { formatKm, formatTons, formatDate, formatCityState } from '@/lib/formatters';
import { SafeStatusBadge } from '@/components/security';
import { LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useRequesterStatus } from '@/hooks/useRequesterStatus';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, differenceInHours } from 'date-fns';

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
    origin_neighborhood?: string;
    origin_street?: string;
    origin_number?: string;
    origin_complement?: string;
    origin_zip_code?: string;
    destination_city?: string;
    destination_state?: string;
    destination_address?: string;
    destination_neighborhood?: string;
    destination_street?: string;
    destination_number?: string;
    destination_complement?: string;
    destination_zip_code?: string;
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
  const viewerRole = profile?.role;
  // ✅ REGRA UNIVERSAL: só solicitante vê secondary/meta
  const priceMode = resolveUiPriceMode(profile?.id, viewerRole, freight.producer_id);
  const isUnitOnly = priceMode === 'UNIT_ONLY';

  const [activeTab, setActiveTab] = useState<string>('details');
  const [mapMounted, setMapMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const requesterStatus = useRequesterStatus(freight.id, {
    producer: freight.producer,
    isGuestFreight: freight.is_guest_freight,
    producerId: freight.producer_id,
    autoFetch: true,
  });

  const isHighlighted = highlightFreightId === freight.id;

  // === Status & Map Logic ===
  const normalizedStatus = normalizeFreightStatus(freight.status ?? '');
  const hasAssignedDrivers = Array.isArray(freight.drivers_assigned) && freight.drivers_assigned.length > 0;
  const hasMainDriver = !!freight.driver_id;
  const hasAcceptedTrucks = (freight.accepted_trucks ?? 0) > 0;
  const isMultiTruckFreight = (freight.required_trucks ?? 1) > 1;
  const hasMultipleDrivers = hasAssignedDrivers && (freight.drivers_assigned?.length ?? 0) > 1;
  const shouldUseMultiDriverMap = !isUnitOnly && (isMultiTruckFreight || hasMultipleDrivers) && (hasAssignedDrivers || hasAcceptedTrucks);
  
  const canShowMap = [
    'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'
  ].includes(normalizedStatus) || (normalizedStatus === 'OPEN' && (hasAssignedDrivers || hasMainDriver || hasAcceptedTrucks));

  const priceDisplayMode = freight.price_display_mode;
  const originalRequiredTrucks = Math.max((freight.original_required_trucks ?? freight.required_trucks) || 1, 1);
  const requiredTrucks = freight.required_trucks || 1;
  const hasMultipleTrucks = requiredTrucks > 1;

  // === Service Icon & Title (from FreightCard) ===
  const getServiceIcon = () => {
    switch (freight.service_type) {
      case 'GUINCHO': return <Wrench className="h-5 w-5 text-warning" />;
      case 'MUDANCA': return <Home className="h-5 w-5 text-accent" />;
      case 'FRETE_MOTO': return <Bike className="h-5 w-5 text-blue-500" />;
      default: return <Package className="h-5 w-5 text-primary" />;
    }
  };

  const getServiceLabel = () => {
    switch (freight.service_type) {
      case 'GUINCHO': return 'Guincho';
      case 'MUDANCA': return 'Mudança';
      case 'FRETE_MOTO': return 'Frete Moto';
      default: return 'Carga';
    }
  };

  // === Pickup countdown (from FreightCard) ===
  const pickupRemaining = useMemo(() => {
    if (!freight.pickup_date) return null;
    const now = new Date();
    const pickup = new Date(freight.pickup_date);
    const days = differenceInDays(pickup, now);
    if (days > 1) return `Coleta em ${days} dias`;
    if (days === 1) return 'Coleta amanhã';
    if (days === 0) return 'Coleta hoje';
    const hours = differenceInHours(pickup, now);
    if (hours > 0) return `Coleta em ${hours}h`;
    return 'Coleta atrasada';
  }, [freight.pickup_date]);

  const pickupIsUrgent = useMemo(() => {
    if (!freight.pickup_date) return false;
    return differenceInDays(new Date(freight.pickup_date), new Date()) <= 1;
  }, [freight.pickup_date]);

  // === R$/km — uses centralized hook to prevent regressions ===
  const distKmNum = parseFloat(String(freight.distance_km ?? 0).replace(/[^\d.]/g, "")) || 0;
  const estimatedHours = distKmNum > 0 ? Math.round(distKmNum / 60) : null;

  // ✅ PREÇO PREENCHIDO: fonte única de verdade + gating por viewer
  const priceDisplay = useMemo(() => {
    const freightId = freight.id || 'unknown';
    return precoPreenchidoDoFrete(freightId, {
      price: freight.price || 0,
      pricing_type: (freight as any).pricing_type,
      price_per_km: (freight as any).price_per_km,
      price_per_ton: (freight as any).price_per_ton,
      required_trucks: requiredTrucks,
      distance_km: distKmNum,
      weight: (freight as any).weight,
    }, { unitOnly: isUnitOnly });
  }, [freight.id, freight.price, (freight as any).pricing_type, (freight as any).price_per_km, (freight as any).price_per_ton, requiredTrucks, distKmNum, (freight as any).weight, isUnitOnly]);

  const pricePerKmCalc = priceDisplay?.unitValue ?? null;
  const rpmColor = pricePerKmCalc === null ? 'text-muted-foreground' : pricePerKmCalc >= 6 ? 'text-primary' : pricePerKmCalc >= 4 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive';
  const rpmIcon = pricePerKmCalc === null ? null : pricePerKmCalc >= 6 ? <TrendingUp className="h-3 w-3" /> : pricePerKmCalc < 4 ? <TrendingDown className="h-3 w-3" /> : null;

  // === Producer Info ===
  const producerInfo = useMemo(() => {
    if (freight.producer?.full_name) {
      return { name: freight.producer.full_name, photoUrl: freight.producer.profile_photo_url || null, hasRegistration: true };
    }
    if (requesterStatus.hasRegistration && requesterStatus.producerName) {
      return { name: requesterStatus.producerName, photoUrl: requesterStatus.producerPhotoUrl, hasRegistration: true };
    }
    if (requesterStatus.type === 'GUEST' || freight.is_guest_freight) {
      return { name: 'Solicitante não cadastrado', photoUrl: null, hasRegistration: false };
    }
    if (requesterStatus.isLoading) {
      return { name: 'Carregando...', photoUrl: null, hasRegistration: false };
    }
    return { name: 'Produtor não identificado', photoUrl: null, hasRegistration: requesterStatus.hasRegistration };
  }, [freight.producer, freight.is_guest_freight, requesterStatus]);

  // === Tab handler ===
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'map') {
      if (!mapMounted) setMapMounted(true);
      setTimeout(() => setMapKey(prev => prev + 1), 150);
    }
  };

  // === Price display logic — ALWAYS uses centralized pipeline ===
  const renderPrice = () => {
    if (!priceDisplay) {
      return <p className="font-bold text-xl text-primary">—</p>;
    }

    return (
      <div>
        <p className="font-bold text-xl text-primary">
          {priceDisplay.primaryText}
        </p>
        {priceDisplay.secondaryText && (
          <p className="text-[10px] text-muted-foreground">
            {priceDisplay.secondaryText}
          </p>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card
        className={cn(
          "h-full flex flex-col hover:shadow-lg transition-all duration-300 border-2 rounded-xl overflow-hidden bg-card",
          isHighlighted
            ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-xl ring-2 ring-yellow-400"
            : "border-border"
        )}
        style={{ boxShadow: '0 2px 8px hsl(var(--foreground) / 0.06)' }}
      >
        {/* ── HEADER: Service Icon + Title + Status ── */}
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {getServiceIcon()}
              <div className="min-w-0">
                <h3 className="font-bold text-foreground text-base truncate">{getServiceLabel()}</h3>
                {pickupRemaining && (
                  <p className={`text-xs mt-0.5 ${pickupIsUrgent ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {pickupIsUrgent && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                    {pickupRemaining}
                  </p>
                )}
              </div>
            </div>
            {/* Status badge — accent zone */}
            <SafeStatusBadge
              status={freight.status}
              type="freight"
              className="whitespace-nowrap shrink-0"
            />
          </div>

          {/* Vagas (multi-carreta) */}
          {hasMultipleTrucks && (
            <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border/30">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                {freight.accepted_trucks || 0}/{freight.required_trucks} carretas
              </span>
            </div>
          )}

          {/* Delivery deadline indicator */}
          {freight.deliveryDeadline && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs font-bold mt-2",
              freight.deliveryDeadline.isCritical && "bg-destructive/10 text-destructive",
              freight.deliveryDeadline.isUrgent && !freight.deliveryDeadline.isCritical && "bg-warning/10 text-warning",
              !freight.deliveryDeadline.isUrgent && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
            )}>
              <Clock className="h-3 w-3" />
              {freight.deliveryDeadline.displayText}
            </div>
          )}
        </CardHeader>

        {/* ── CONTENT: Route + Specs + Grid + Tabs ── */}
        <CardContent className="px-4 py-3 space-y-3 flex-1 flex flex-col">
          {/* Origem → Destino with detailed address */}
          <div className="space-y-0">
            {/* COLETA */}
            <div className="p-3 rounded-t-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-3 w-3 rounded-full border-2 border-primary/60 bg-card shrink-0" />
                <p className="text-xs font-bold text-primary uppercase tracking-wider">📍 Coleta</p>
              </div>
              <p className="text-sm font-semibold text-foreground ml-5">
                {freight.origin_city && freight.origin_state
                  ? formatCityState(freight.origin_city, freight.origin_state)
                  : 'Carregando origem...'}
              </p>
              {(freight.origin_neighborhood || freight.origin_street || freight.origin_number || freight.origin_complement || freight.origin_zip_code || freight.origin_address) && (
                <div className="ml-5 mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {freight.origin_neighborhood && (
                    <p><span className="font-medium text-foreground/70">Bairro/Local:</span> {freight.origin_neighborhood}</p>
                  )}
                  {(freight.origin_street || freight.origin_number) && (
                    <p>
                      <span className="font-medium text-foreground/70">Endereço:</span>{' '}
                      {[freight.origin_street, freight.origin_number && `nº ${freight.origin_number}`].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {freight.origin_complement && (
                    <p><span className="font-medium text-foreground/70">Complemento:</span> {freight.origin_complement}</p>
                  )}
                  {freight.origin_zip_code && (
                    <p><span className="font-medium text-foreground/70">CEP:</span> {freight.origin_zip_code}</p>
                  )}
                  {!freight.origin_neighborhood && !freight.origin_street && freight.origin_address && (
                    <p>{freight.origin_address}</p>
                  )}
                </div>
              )}
            </div>

            {/* Divider line */}
            <div className="flex justify-center -my-px">
              <div className="w-0.5 h-3 bg-gradient-to-b from-primary/40 to-accent/40" />
            </div>

            {/* ENTREGA */}
            <div className="p-3 rounded-b-lg bg-accent/5 border border-accent/20">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-3 w-3 rounded-full bg-accent shrink-0" />
                <p className="text-xs font-bold text-accent uppercase tracking-wider">🏁 Entrega</p>
              </div>
              <p className="text-sm font-semibold text-foreground ml-5">
                {freight.destination_city && freight.destination_state
                  ? formatCityState(freight.destination_city, freight.destination_state)
                  : 'Carregando destino...'}
              </p>
              {(freight.destination_neighborhood || freight.destination_street || freight.destination_number || freight.destination_complement || freight.destination_zip_code || freight.destination_address) && (
                <div className="ml-5 mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {freight.destination_neighborhood && (
                    <p><span className="font-medium text-foreground/70">Bairro/Local:</span> {freight.destination_neighborhood}</p>
                  )}
                  {(freight.destination_street || freight.destination_number) && (
                    <p>
                      <span className="font-medium text-foreground/70">Endereço:</span>{' '}
                      {[freight.destination_street, freight.destination_number && `nº ${freight.destination_number}`].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {freight.destination_complement && (
                    <p><span className="font-medium text-foreground/70">Complemento:</span> {freight.destination_complement}</p>
                  )}
                  {freight.destination_zip_code && (
                    <p><span className="font-medium text-foreground/70">CEP:</span> {freight.destination_zip_code}</p>
                  )}
                  {!freight.destination_neighborhood && !freight.destination_street && freight.destination_address && (
                    <p>{freight.destination_address}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Specs line (from FreightCard) */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap px-1">
            <MapPin className="h-3 w-3 text-muted-foreground/60" />
            <span className="font-medium">{formatKm(distKmNum)}</span>
            {estimatedHours !== null && (
              <>
                <span className="text-border">•</span>
                <Clock className="h-3 w-3 text-muted-foreground/60" />
                <span>~{estimatedHours}h</span>
              </>
            )}
            {freight.service_type !== 'GUINCHO' && freight.service_type !== 'MUDANCA' && (
              <>
                <span className="text-border">•</span>
                <span>{formatTons(freight.weight)}</span>
              </>
            )}
          </div>

          {/* 3-column grid: Coleta | Peso | R$/km (from FreightCard) */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-secondary/40 rounded-lg text-center border border-border/20">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Coleta</p>
              </div>
              <p className="text-xs font-bold text-foreground">{formatDate(freight.pickup_date)}</p>
            </div>
            <div className="p-2.5 bg-secondary/40 rounded-lg text-center border border-border/20">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Peso</p>
              </div>
              <p className="text-xs font-bold text-foreground">{formatTons(freight.weight)}</p>
            </div>
            {/* R$/km — semantic color */}
            <div className={`p-2.5 rounded-lg text-center border ${
              pricePerKmCalc !== null && pricePerKmCalc >= 6
                ? 'bg-primary/10 border-primary/20'
                : pricePerKmCalc !== null && pricePerKmCalc < 4
                  ? 'bg-destructive/10 border-destructive/20'
                  : 'bg-warning/10 border-warning/20'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{priceDisplay?.pricingType === 'PER_TON' ? 'R$/ton' : 'R$/km'}</p>
              </div>
              <p className={`text-xs font-bold flex items-center justify-center gap-0.5 ${rpmColor}`}>
                {rpmIcon}
                {priceDisplay?.unitValue ? `R$${priceDisplay.unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </p>
            </div>
          </div>

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
              {/* Multi-driver list for producer */}
              {!isUnitOnly && (isMultiTruckFreight || hasMultipleDrivers) && (hasAssignedDrivers || hasAcceptedTrucks) ? (
                <>
                  <div className="flex items-center justify-between text-sm bg-secondary/40 rounded-lg p-2 border border-border/20">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">Motoristas</span>
                    </div>
                    <Badge variant="secondary">
                      {freight.accepted_trucks ?? freight.drivers_assigned?.length ?? 0} / {freight.required_trucks ?? 1} carretas
                    </Badge>
                  </div>
                  <MultiDriversList freightId={freight.id} />
                </>
              ) : (
                <>
                  {/* Driver / Producer info - show the OTHER participant */}
                  <div className="p-3 rounded-lg bg-secondary/20 border border-border/20">
                    {viewerRole === 'PRODUTOR' || !(freight.producer_id || freight.producer) ? (
                      <div className="flex items-center gap-3">
                        {freight.driver_profiles?.profile_photo_url ? (
                          <img 
                            src={freight.driver_profiles.profile_photo_url} 
                            alt="Foto do motorista"
                            className="h-8 w-8 rounded-full object-cover border-2 border-primary/20"
                            onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{LABELS.MOTORISTA_LABEL}</p>
                          <p className="text-sm font-semibold text-foreground truncate">
                            {freight.driver_profiles?.full_name || LABELS.AGUARDANDO_MOTORISTA}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {producerInfo.photoUrl ? (
                          <img 
                            src={producerInfo.photoUrl} 
                            alt="Foto do produtor"
                            className="h-8 w-8 rounded-full object-cover border-2 border-primary/20"
                            onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Produtor</p>
                          <p className={cn(
                            "text-sm font-semibold truncate",
                            producerInfo.hasRegistration ? "text-foreground" : "text-muted-foreground italic"
                          )}>
                            {producerInfo.name}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vehicle preview */}
                  {(freight.driver_id || (freight.drivers_assigned && freight.drivers_assigned.length > 0)) && (
                    <DriverVehiclePreview 
                      driverId={freight.driver_id || (freight.drivers_assigned?.[0] ?? '')}
                      freightId={freight.id}
                    />
                  )}
                </>
              )}

              {/* Service workflow actions or standard buttons */}
              {serviceWorkflowActions ? (
                <div className="mt-auto pt-3 space-y-2">
                  {serviceWorkflowActions}
                </div>
              ) : showActions && (
                <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onViewDetails}
                    className="w-full border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
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

        {/* ── FOOTER: Price (from FreightCard style) ── */}
        <CardFooter className="px-4 py-3 border-t border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between w-full">
            {renderPrice()}
            <SafeStatusBadge
              status={freight.status}
              type="freight"
              className="text-[10px]"
            />
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
};

// ✅ Memoização para evitar re-renders desnecessários em listas
export const FreightInProgressCard = React.memo(FreightInProgressCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.freight.id === nextProps.freight.id &&
    prevProps.freight.status === nextProps.freight.status &&
    prevProps.freight.price === nextProps.freight.price &&
    prevProps.freight.current_lat === nextProps.freight.current_lat &&
    prevProps.freight.current_lng === nextProps.freight.current_lng &&
    prevProps.showActions === nextProps.showActions &&
    prevProps.highlightFreightId === nextProps.highlightFreightId &&
    prevProps.freight.producer?.full_name === nextProps.freight.producer?.full_name &&
    prevProps.freight.producer_id === nextProps.freight.producer_id &&
    prevProps.freight.is_guest_freight === nextProps.freight.is_guest_freight &&
    prevProps.freight.driver_profiles?.full_name === nextProps.freight.driver_profiles?.full_name
  );
});
