import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
  Crosshair,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
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

const DEFAULT_CENTER: [number, number] = [-51.925, -14.235]; // Centro do Brasil
const DEFAULT_ZOOM = 4.5;

function isValidNum(n: any): n is number {
  return typeof n === "number" && !Number.isNaN(n) && Number.isFinite(n);
}

function makeDriverMarkerEl(driver: DriverLocation) {
  const el = document.createElement("div");
  const isTransit = !!driver.current_freight_id;
  const isAvail = !!driver.is_available;

  // cores
  const bg = isTransit
    ? "#3b82f6" // blue-500
    : isAvail
      ? "#22c55e" // green-500
      : "#64748b"; // slate-500

  el.style.width = "26px";
  el.style.height = "26px";
  el.style.borderRadius = "999px";
  el.style.background = bg;
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 6px 16px rgba(0,0,0,0.18)";
  el.style.cursor = "pointer";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.color = "white";
  el.style.fontSize = "12px";
  el.style.fontWeight = "700";
  el.textContent = driver.driver_name?.trim()?.[0]?.toUpperCase() || "M";

  return el;
}

/**
 * Fleet GPS Tracking Map
 * Real-time visualization of all company drivers on a map (MapLibre)
 */
export const FleetGPSTrackingMap = memo(function FleetGPSTrackingMap({
  companyId,
  refreshInterval = 30000,
  showDriverList = true,
  className,
}: FleetGPSTrackingMapProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatus>("all");

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const roRef = useRef<ResizeObserver | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
        .not("current_lat", "is", null);

      if (error) throw error;

      const driverIds = trackingData?.map((t) => t.driver_profile_id).filter(Boolean) || [];
      if (driverIds.length === 0) return [];

      const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", driverIds);

      const freightIds = trackingData?.map((t) => t.current_freight_id).filter(Boolean) || [];
      const freightsMap: Record<string, any> = {};

      if (freightIds.length > 0) {
        const { data: freights } = await supabase
          .from("freights")
          .select("id, origin_city, origin_state, destination_city, destination_state")
          .in("id", freightIds);

        freights?.forEach((f) => {
          freightsMap[f.id] = f;
        });
      }

      const locations: DriverLocation[] = (trackingData || [])
        .map((tracking) => {
          const profile = profiles?.find((p) => p.id === tracking.driver_profile_id);
          const freight = tracking.current_freight_id ? freightsMap[tracking.current_freight_id] : null;

          return {
            id: tracking.id,
            driver_profile_id: tracking.driver_profile_id || "",
            driver_name: profile?.full_name || "Motorista",
            driver_phone: profile?.phone || null,
            current_lat: tracking.current_lat,
            current_lng: tracking.current_lng,
            last_gps_update: tracking.last_gps_update,
            is_available: tracking.is_available || false,
            tracking_status: tracking.tracking_status || "offline",
            current_freight_id: tracking.current_freight_id,
            freight_origin: freight ? `${freight.origin_city}/${freight.origin_state}` : undefined,
            freight_destination: freight ? `${freight.destination_city}/${freight.destination_state}` : undefined,
          };
        })
        // só mantém coords válidas
        .filter((d) => isValidNum(d.current_lat) && isValidNum(d.current_lng));

      return locations;
    },
    refetchInterval: refreshInterval,
    staleTime: 10000,
  });

  // Filter drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const matchesSearch =
        driver.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (driver.vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && driver.is_available) ||
        (statusFilter === "in_transit" && !!driver.current_freight_id) ||
        (statusFilter === "offline" && !driver.is_available && !driver.current_freight_id);

      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: drivers.length,
      available: drivers.filter((d) => d.is_available).length,
      inTransit: drivers.filter((d) => d.current_freight_id).length,
      offline: drivers.filter((d) => !d.is_available && !d.current_freight_id).length,
    };
  }, [drivers]);

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

  // === Map helpers ===
  const fitAllDrivers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const pts = filteredDrivers
      .map((d) => [d.current_lng, d.current_lat] as [number, number])
      .filter(([lng, lat]) => isValidNum(lng) && isValidNum(lat));

    if (pts.length === 0) {
      map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 300 });
      return;
    }

    if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 12, duration: 300 });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    pts.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 300 });
  }, [filteredDrivers, mapReady]);

  const centerOnSelected = useCallback(
    (driverId: string) => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      const d = filteredDrivers.find((x) => x.id === driverId);
      if (!d) return;

      map.easeTo({ center: [d.current_lng, d.current_lat], zoom: 13, duration: 300 });
      const marker = markersRef.current[driverId];
      if (marker) marker.togglePopup?.();
    },
    [filteredDrivers, mapReady],
  );

  // === Init Map (robusto) ===
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;

    const waitForNonZeroSize = async () => {
      while (!cancelled && mapContainerRef.current) {
        const r = mapContainerRef.current.getBoundingClientRect();
        if (r.width > 10 && r.height > 10) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
    };

    const init = async () => {
      await waitForNonZeroSize();
      if (cancelled || !mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        // estilo vetorial leve (ótima nitidez)
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: true,
        pixelRatio: window.devicePixelRatio || 1,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        // resize em 2 frames (resolve canvas branco em tabs/layout)
        requestAnimationFrame(() => {
          map.resize();
          requestAnimationFrame(() => map.resize());
        });
        setMapReady(true);
      });

      map.on("error", (e) => {
        console.error("[FleetGPSTrackingMap] Map error:", e?.error || e);
      });

      mapRef.current = map;

      const ro = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      ro.observe(mapContainerRef.current);
      roRef.current = ro;
    };

    init();

    return () => {
      cancelled = true;
      roRef.current?.disconnect();
      roRef.current = null;

      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // === Render markers whenever filteredDrivers changes ===
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove markers que não existem mais
    const nextIds = new Set(filteredDrivers.map((d) => d.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!nextIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Upsert markers
    filteredDrivers.forEach((d) => {
      const lng = d.current_lng;
      const lat = d.current_lat;
      if (!isValidNum(lng) || !isValidNum(lat)) return;

      const popupHtml = `
        <div style="padding:8px; min-width: 180px;">
          <div style="font-weight:600; margin-bottom:6px;">${d.driver_name}</div>
          <div style="font-size:12px; color:#555;">
            <div>Status: ${d.current_freight_id ? "Em Viagem" : d.is_available ? "Disponível" : "Offline"}</div>
            <div>Última atualização: ${getLastUpdateText(d.last_gps_update)}</div>
            ${
              d.current_freight_id && d.freight_origin
                ? `<div style="margin-top:6px;">${d.freight_origin} → ${d.freight_destination ?? ""}</div>`
                : ""
            }
          </div>
        </div>
      `;

      const existing = markersRef.current[d.id];
      if (existing) {
        existing.setLngLat([lng, lat]);
        return;
      }

      const el = makeDriverMarkerEl(d);
      el.addEventListener("click", () => {
        setSelectedDriver(d.id);
        // centraliza ao clicar no marker
        mapRef.current?.easeTo({ center: [lng, lat], zoom: 13, duration: 250 });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml))
        .addTo(map);

      markersRef.current[d.id] = marker;
    });

    // Ajusta bounds na primeira carga / quando filtro muda muito
    // (evita “mapa vazio” mesmo com 1 ponto)
    fitAllDrivers();

    // garante render
    requestAnimationFrame(() => map.resize());
  }, [filteredDrivers, mapReady, fitAllDrivers]);

  // Quando seleciona um motorista na lista -> centraliza
  useEffect(() => {
    if (!selectedDriver) return;
    centerOnSelected(selectedDriver);
  }, [selectedDriver, centerOnSelected]);

  return (
    <div className={className}>
      <Card className="h-full">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Rastreamento da Frota
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fitAllDrivers()}
                disabled={!mapReady}
                title="Ver todos"
              >
                <Crosshair className="h-4 w-4 mr-2" />
                Ver tudo
              </Button>

              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
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

          {/* Map + Driver List */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Map Area */}
            <div className="lg:col-span-2">
              <div className="relative aspect-video rounded-xl overflow-hidden border">
                <div ref={mapContainerRef} className="absolute inset-0" />

                {/* overlay de vazio */}
                {!isLoading && filteredDrivers.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
                    <div className="text-center p-8">
                      <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="font-medium">Nenhum motorista com GPS disponível</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ajuste os filtros ou verifique se o motorista enviou localização.
                      </p>
                    </div>
                  </div>
                )}

                {/* loading */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                    <div className="text-center">
                      <Skeleton className="h-6 w-40 mx-auto mb-3" />
                      <Skeleton className="h-4 w-64 mx-auto" />
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
