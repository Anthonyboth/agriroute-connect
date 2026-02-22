import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTileWatchdog } from "@/hooks/maplibre";
import { RURAL_STYLE_INLINE } from "@/config/maplibre";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Truck,
  RefreshCw,
  Search,
  Navigation,
  Clock,
  AlertCircle,
  CheckCircle,
  Circle,
  Users,
  Route,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { sanitizeForDisplaySafe } from "@/lib/validation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DriverLocation {
  id: string;
  driver_profile_id: string;
  driver_name: string;
  driver_phone: string | null;
  current_lat: number;
  current_lng: number;
  last_gps_update: string;
  is_available: boolean;
  tracking_status: string;
  current_freight_id: string | null;
  freight_origin?: string;
  freight_destination?: string;
  vehicle_plate?: string;
}

interface FleetGPSTrackingMapProps {
  companyId: string;
  refreshInterval?: number;
  showDriverList?: boolean;
  className?: string;
}

type DriverStatus = "all" | "available" | "in_transit" | "offline";

const DEFAULT_CENTER: [number, number] = [-47.9292, -15.7801]; // Brasília (lng, lat)

function isNum(n: unknown): n is number {
  return typeof n === "number" && !Number.isNaN(n) && Number.isFinite(n);
}

/**
 * ✅ PADRÃO OURO: Elemento raiz neutro (width:0, height:0), sem transform.
 * Estilos visuais vão apenas em filhos internos.
 */
function buildDriverMarkerEl(status: "in_transit" | "available" | "offline") {
  // ✅ ELEMENTO RAIZ NEUTRO - sem styles que afetem posicionamento
  const root = document.createElement("div");
  root.className = "truck-marker"; // Define width:0; height:0 via CSS
  
  const bgColor = status === "in_transit" 
    ? "#3b82f6" // azul
    : status === "available" 
      ? "#22c55e" // verde
      : "#6b7280"; // cinza
  
  const icon = status === "in_transit" ? "🚛" : status === "available" ? "✅" : "⚪";
  
  // ✅ Todos os estilos visuais vão no wrapper INTERNO
  root.innerHTML = `
    <div class="truck-marker-inner">
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${bgColor};
        font-size: 16px;
        cursor: pointer;
        user-select: none;
      ">
        ${icon}
      </div>
    </div>
  `;
  
  return root;
}

/**
 * Fleet GPS Tracking Map
 * Real-time visualization of all company drivers on a map
 */
export const FleetGPSTrackingMap = memo(function FleetGPSTrackingMap({
  companyId,
  refreshInterval = 60000, // ✅ Mínimo 60s para GPS tracking
  showDriverList = true,
  className,
}: FleetGPSTrackingMapProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatus>("all");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // ✅ Tile Watchdog
  useTileWatchdog(mapRef);

  // Fetch driver locations
  const {
    data: drivers = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["fleet-drivers", companyId],
    queryFn: async () => {
      const { data: trackingData, error } = await supabase
        .from("affiliated_drivers_tracking")
        .select(
          `
          id,
          driver_profile_id,
          current_lat,
          current_lng,
          last_gps_update,
          is_available,
          tracking_status,
          current_freight_id
        `,
        )
        .eq("company_id", companyId)
        .not("current_lat", "is", null)
        .not("current_lng", "is", null);

      if (error) throw error;

      const driverIds = trackingData?.map((t) => t.driver_profile_id).filter(Boolean) || [];
      if (driverIds.length === 0) return [];

      // Usar profiles_secure para proteção de PII - phone será mascarado para não-proprietários
      const { data: profiles } = await (supabase as any).from("profiles_secure").select("id, full_name, phone").in("id", driverIds);

      const freightIds = trackingData?.map((t) => t.current_freight_id).filter(Boolean) || [];

      let freightsMap: Record<string, any> = {};
      if (freightIds.length > 0) {
        const { data: freights } = await supabase
          .from("freights")
          .select("id, origin_city, origin_state, destination_city, destination_state")
          .in("id", freightIds);

        freights?.forEach((f) => {
          freightsMap[f.id] = f;
        });
      }

      const locations: DriverLocation[] = (trackingData || []).map((tracking: any) => {
        const profile = profiles?.find((p) => p.id === tracking.driver_profile_id);
        const freight = tracking.current_freight_id ? freightsMap[tracking.current_freight_id] : null;

        return {
          id: tracking.id,
          driver_profile_id: tracking.driver_profile_id || "",
          driver_name: profile?.full_name || "Motorista",
          driver_phone: profile?.phone || null,
          current_lat: Number(tracking.current_lat),
          current_lng: Number(tracking.current_lng),
          last_gps_update: tracking.last_gps_update,
          is_available: Boolean(tracking.is_available),
          tracking_status: tracking.tracking_status || "offline",
          current_freight_id: tracking.current_freight_id,
          freight_origin: freight ? `${freight.origin_city}/${freight.origin_state}` : undefined,
          freight_destination: freight ? `${freight.destination_city}/${freight.destination_state}` : undefined,
        };
      });

      return locations.filter((d) => isNum(d.current_lat) && isNum(d.current_lng));
    },
    refetchInterval: Math.max(refreshInterval, 60000), // ✅ Mínimo 60s
    staleTime: 30000, // 30s staleTime para GPS
  });

  // Filter drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const matchesSearch =
        driver.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && driver.is_available) ||
        (statusFilter === "in_transit" && driver.current_freight_id) ||
        (statusFilter === "offline" && !driver.is_available && !driver.current_freight_id);

      return Boolean(matchesSearch && matchesStatus);
    });
  }, [drivers, searchTerm, statusFilter]);

  // Center computed
  const computedCenter = useMemo<[number, number]>(() => {
    if (selectedDriver) {
      const d = filteredDrivers.find((x) => x.id === selectedDriver);
      if (d && isNum(d.current_lat) && isNum(d.current_lng)) return [d.current_lng, d.current_lat];
    }
    if (filteredDrivers.length > 0) {
      const first = filteredDrivers[0];
      if (isNum(first.current_lat) && isNum(first.current_lng)) return [first.current_lng, first.current_lat];
    }
    return DEFAULT_CENTER;
  }, [filteredDrivers, selectedDriver]);

  // Status badge/icon
  const getStatusBadge = (driver: DriverLocation) => {
    if (driver.current_freight_id) return <Badge className="bg-blue-500 text-white">Em Viagem</Badge>;
    if (driver.is_available) return <Badge className="bg-green-500 text-white">Disponível</Badge>;
    return <Badge variant="secondary">Offline</Badge>;
  };

  const getStatusIcon = (driver: DriverLocation) => {
    if (driver.current_freight_id) return <Navigation className="h-4 w-4 text-blue-500" />;
    if (driver.is_available) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  const getLastUpdateText = (lastUpdate: string) => {
    if (!lastUpdate) return "Nunca";
    try {
      return formatDistanceToNow(new Date(lastUpdate), { addSuffix: true, locale: ptBR });
    } catch {
      return "Desconhecido";
    }
  };

  const stats = {
    total: drivers.length,
    available: drivers.filter((d) => d.is_available).length,
    inTransit: drivers.filter((d) => d.current_freight_id).length,
    offline: drivers.filter((d) => !d.is_available && !d.current_freight_id).length,
  };

  // ✅ Init MapLibre (uma vez)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: RURAL_STYLE_INLINE,
      center: computedCenter,
      zoom: 6,
      // ✅ NUNCA use `true` aqui (dá erro no TS)
      attributionControl: false,
      pixelRatio: window.devicePixelRatio || 1,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      // canvas em tab precisa resize
      requestAnimationFrame(() => {
        map.resize();
        requestAnimationFrame(() => map.resize());
      });
    });

    map.on("error", (e) => {
      console.error("[FleetGPSTrackingMap] Map error:", (e as any)?.error || e);
    });

    mapRef.current = map;

    // ResizeObserver (tabs/layout)
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    ro.observe(mapContainerRef.current);
    resizeObserverRef.current = ro;

    // garante resize ao voltar pra aba
    const onVis = () => {
      if (document.visibilityState === "visible") {
        requestAnimationFrame(() => mapRef.current?.resize());
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Recentra quando muda
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter(computedCenter);
  }, [computedCenter]);

  // ✅ REATIVADO: Markers de motoristas
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const keepIds = new Set<string>();

    for (const d of filteredDrivers) {
      if (!isNum(d.current_lat) || !isNum(d.current_lng)) continue;
      keepIds.add(d.id);

      const status: "in_transit" | "available" | "offline" = d.current_freight_id
        ? "in_transit"
        : d.is_available
          ? "available"
          : "offline";

      const existing = markersRef.current.get(d.id);
      if (existing) {
        existing.setLngLat([d.current_lng, d.current_lat]);
        continue;
      }

      const el = buildDriverMarkerEl(status);

      const safeName = sanitizeForDisplaySafe(d.driver_name);
      const safeOrigin = d.freight_origin ? sanitizeForDisplaySafe(d.freight_origin) : '';
      const safeDest = d.freight_destination ? sanitizeForDisplaySafe(d.freight_destination) : '—';
      const popupHtml = `
        <div style="padding:8px; max-width:220px;">
          <div style="font-weight:700; margin-bottom:4px;">${safeName}</div>
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Último GPS: ${getLastUpdateText(
            d.last_gps_update,
          )}</div>
          ${
            d.current_freight_id && safeOrigin
              ? `<div style="font-size:12px;"><strong>Rota:</strong> ${safeOrigin} → ${safeDest}</div>`
              : `<div style="font-size:12px;"><strong>Status:</strong> ${status === "available" ? "Disponível" : "Offline"}</div>`
          }
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([d.current_lng, d.current_lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml))
        .addTo(map);

      el.addEventListener("click", () => setSelectedDriver(d.id));

      markersRef.current.set(d.id, marker);
    }

    // remove markers que sumiram
    for (const [id, marker] of markersRef.current.entries()) {
      if (!keepIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // fit bounds quando tem mais de 1
    const markers = Array.from(markersRef.current.values());
    if (markers.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      markers.forEach((m) => bounds.extend(m.getLngLat()));
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 0 });
    } else if (markers.length === 1) {
      map.easeTo({ center: markers[0].getLngLat(), zoom: 10, duration: 0 });
    }

    requestAnimationFrame(() => map.resize());
  }, [filteredDrivers, selectedDriver]);

  return (
    <div className={className}>
      <Card className="h-full">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Rastreamento da Frota
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <div className="text-xs text-green-600">Disponíveis</div>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.inTransit}</div>
              <div className="text-xs text-blue-600">Em Viagem</div>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-muted-foreground">{stats.offline}</div>
              <div className="text-xs text-muted-foreground">Offline</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar motorista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DriverStatus)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponíveis</SelectItem>
                <SelectItem value="in_transit">Em Viagem</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Map Area */}
            <div className="lg:col-span-2">
              <div className="relative aspect-video rounded-xl overflow-hidden border">
                <div ref={mapContainerRef} className="absolute inset-0" />

                {/* overlay quando não tem drivers */}
                {!isLoading && filteredDrivers.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
                    <div className="text-center p-6">
                      <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum motorista com GPS ativo (ou sem permissão/RLS para ler a tabela).
                      </p>
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                    <div className="text-center p-6">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Carregando mapa...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Driver List */}
            {showDriverList && (
              <div className="lg:col-span-1">
                <div className="border rounded-xl h-full">
                  <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Motoristas ({filteredDrivers.length})
                    </span>
                  </div>

                  <ScrollArea className="h-[300px] lg:h-[400px]">
                    {isLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredDrivers.length === 0 ? (
                      <div className="p-8 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhum motorista encontrado</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredDrivers.map((driver) => (
                          <div
                            key={driver.id}
                            className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                              selectedDriver === driver.id ? "bg-primary/5 border-l-2 border-primary" : ""
                            }`}
                            onClick={() => setSelectedDriver(driver.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-full bg-primary/10">
                                <Truck className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm truncate">{driver.driver_name}</span>
                                  {getStatusIcon(driver)}
                                </div>

                                {driver.current_freight_id && driver.freight_origin && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Route className="h-3 w-3" />
                                    {driver.freight_origin} → {driver.freight_destination}
                                  </p>
                                )}

                                <div className="flex items-center gap-2 mt-2">
                                  {getStatusBadge(driver)}
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {getLastUpdateText(driver.last_gps_update)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default FleetGPSTrackingMap;
