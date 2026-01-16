import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, Eye, EyeOff } from "lucide-react";
import type { StopEvent, RouteDeviation, OfflineIncident, TimelineEvent } from "@/hooks/useAntifraudData";

interface AntifraudMapViewProps {
  stops: StopEvent[];
  routeDeviations: RouteDeviation[];
  offlineIncidents: OfflineIncident[];
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  currentLat?: number;
  currentLng?: number;
  onEventClick?: (event: TimelineEvent) => void;
}

const DEFAULT_CENTER: [number, number] = [-51.925, -14.235]; // Brasil

export const AntifraudMapView: React.FC<AntifraudMapViewProps> = ({
  stops,
  routeDeviations,
  offlineIncidents,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  currentLat,
  currentLng,
  onEventClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);

  const [layers, setLayers] = useState({
    stops: true,
    deviations: true,
    offline: true,
  });

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // ✅ Centro robusto (não usa "if(lat && lng)" porque 0 é válido)
  const computedCenter = useMemo<[number, number]>(() => {
    const points: [number, number][] = [];

    const pushIfNum = (lng?: number, lat?: number) => {
      if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        points.push([lng, lat]);
      }
    };

    pushIfNum(originLng, originLat);
    pushIfNum(destinationLng, destinationLat);
    pushIfNum(currentLng, currentLat);

    stops.forEach((s) => pushIfNum(Number(s.lng), Number(s.lat)));
    routeDeviations.forEach((d) => pushIfNum(Number(d.lng), Number(d.lat)));

    offlineIncidents.forEach((o) => {
      if (typeof o.last_known_lat === "number" && typeof o.last_known_lng === "number") {
        pushIfNum(Number(o.last_known_lng), Number(o.last_known_lat));
      }
    });

    if (points.length === 0) return DEFAULT_CENTER;

    const avgLng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const avgLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    return [avgLng, avgLat];
  }, [
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    currentLat,
    currentLng,
    stops,
    routeDeviations,
    offlineIncidents,
  ]);

  // ✅ Init do mapa: espera o container ter tamanho > 0 e só marca ready após load+resize
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;

    const waitForNonZeroSize = async () => {
      // Espera o container ter width/height > 0
      while (!cancelled && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
    };

    const init = async () => {
      await waitForNonZeroSize();
      if (cancelled || !mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        // ✅ Evita “qualidade horrível”: estilo leve e estável
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: computedCenter,
        zoom: 8,
        attributionControl: true,
        // mantém sharp em telas retina
        pixelRatio: window.devicePixelRatio || 1,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        // ✅ resize em 2 frames (resolve canvas branco)
        requestAnimationFrame(() => {
          map.resize();
          requestAnimationFrame(() => map.resize());
        });
        setIsMapReady(true);
      });

      map.on("error", (e) => {
        // log útil
        console.error("[AntifraudMapView] Map error:", e?.error || e);
      });

      mapRef.current = map;

      // ResizeObserver (mantém funcionando em resize/layout)
      const ro = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      ro.observe(mapContainerRef.current);
      resizeObserverRef.current = ro;
    };

    init();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      mapRef.current?.remove();
      mapRef.current = null;

      setIsMapReady(false);
    };
  }, [computedCenter]);

  // ✅ Atualiza centro se dados mudarem (sem precisar recriar mapa)
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    mapRef.current.setCenter(computedCenter);
  }, [computedCenter, isMapReady]);

  // ✅ Render de markers SOMENTE quando mapa estiver pronto
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const map = mapRef.current;

    // Clear markers antigos
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const addMarker = (lng: number, lat: number, el: HTMLElement, popupHtml?: string) => {
      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]);

      if (popupHtml) marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml));
      marker.addTo(map);

      markersRef.current.push(marker);
      return marker;
    };

    // Origem
    if (typeof originLat === "number" && typeof originLng === "number") {
      const el = document.createElement("div");
      el.className =
        "w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold";
      el.textContent = "O";
      addMarker(originLng, originLat, el, "<strong>Origem</strong>");
    }

    // Destino
    if (typeof destinationLat === "number" && typeof destinationLng === "number") {
      const el = document.createElement("div");
      el.className =
        "w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold";
      el.textContent = "D";
      addMarker(destinationLng, destinationLat, el, "<strong>Destino</strong>");
    }

    // Posição atual
    if (typeof currentLat === "number" && typeof currentLng === "number") {
      const el = document.createElement("div");
      el.className =
        "w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center animate-pulse";
      el.innerHTML = "🚛";
      addMarker(currentLng, currentLat, el, "<strong>Posição Atual</strong>");
    }

    // Paradas
    if (layers.stops) {
      stops.forEach((stop) => {
        const lat = Number(stop.lat);
        const lng = Number(stop.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const riskColor =
          stop.risk_level === "critical"
            ? "bg-red-600"
            : stop.risk_level === "high"
              ? "bg-orange-500"
              : stop.risk_level === "medium"
                ? "bg-yellow-500"
                : "bg-gray-400";

        const el = document.createElement("div");
        el.className = `w-5 h-5 rounded-full ${riskColor} border-2 border-white shadow-lg cursor-pointer`;

        const popupHtml = `
          <div class="p-2">
            <strong class="text-sm">Parada ${stop.risk_level}</strong>
            <p class="text-xs text-gray-600 mt-1">${stop.reason || "Parada detectada"}</p>
            ${stop.duration_minutes ? `<p class="text-xs mt-1">Duração: ${stop.duration_minutes} min</p>` : ""}
          </div>
        `;

        addMarker(lng, lat, el, popupHtml);

        el.addEventListener("click", () => {
          onEventClick?.({
            id: stop.id,
            type: "stop",
            timestamp: stop.started_at,
            duration_minutes: stop.duration_minutes,
            description: stop.reason || "Parada detectada",
            risk_level: stop.risk_level,
            lat,
            lng,
          });
        });
      });
    }

    // Desvios
    if (layers.deviations) {
      routeDeviations.forEach((deviation) => {
        const lat = Number(deviation.lat);
        const lng = Number(deviation.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const el = document.createElement("div");
        el.className =
          "w-5 h-5 rounded-full bg-purple-500 border-2 border-white shadow-lg cursor-pointer flex items-center justify-center";
        el.innerHTML = "↗";
        el.style.fontSize = "10px";
        el.style.color = "white";

        const popupHtml = `
          <div class="p-2">
            <strong class="text-sm">Desvio de Rota</strong>
            <p class="text-xs text-gray-600 mt-1">${Number(deviation.deviation_km).toFixed(1)} km da rota</p>
            <p class="text-xs">Severidade: ${deviation.severity}</p>
          </div>
        `;

        addMarker(lng, lat, el, popupHtml);
      });
    }

    // Offline
    if (layers.offline) {
      offlineIncidents.forEach((incident) => {
        const lat = typeof incident.last_known_lat === "number" ? Number(incident.last_known_lat) : NaN;
        const lng = typeof incident.last_known_lng === "number" ? Number(incident.last_known_lng) : NaN;
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const el = document.createElement("div");
        el.className = `w-5 h-5 rounded-full ${incident.is_suspicious ? "bg-red-600" : "bg-gray-500"} border-2 border-white shadow-lg cursor-pointer flex items-center justify-center`;
        el.innerHTML = "📡";
        el.style.fontSize = "10px";

        const popupHtml = `
          <div class="p-2">
            <strong class="text-sm">${incident.is_suspicious ? "⚠️ Offline Suspeito" : "Perda de Sinal"}</strong>
            ${incident.duration_minutes ? `<p class="text-xs mt-1">Duração: ${incident.duration_minutes} min</p>` : ""}
            ${incident.distance_gap_km ? `<p class="text-xs">Gap: ${Number(incident.distance_gap_km).toFixed(1)} km</p>` : ""}
          </div>
        `;

        addMarker(lng, lat, el, popupHtml);
      });
    }

    // ✅ Fit bounds sempre (mesmo com 1 marker, dá zoom/centralização decente)
    if (markersRef.current.length >= 1) {
      const bounds = new maplibregl.LngLatBounds();
      markersRef.current.forEach((m) => bounds.extend(m.getLngLat()));

      // Evita zoom absurdo quando só tem 1 ponto
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 12,
        duration: 0,
      });

      // garante render
      requestAnimationFrame(() => map.resize());
    }
  }, [
    isMapReady,
    layers,
    stops,
    routeDeviations,
    offlineIncidents,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    currentLat,
    currentLng,
    onEventClick,
  ]);

  const hasData =
    stops.length > 0 ||
    routeDeviations.length > 0 ||
    offlineIncidents.length > 0 ||
    typeof originLat === "number" ||
    typeof destinationLat === "number" ||
    typeof currentLat === "number";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="h-4 w-4" />
            Mapa Antifraude
          </CardTitle>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={layers.stops ? "default" : "outline"}
              className="h-7 text-xs px-2"
              onClick={() => toggleLayer("stops")}
            >
              {layers.stops ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              Paradas
            </Button>

            <Button
              size="sm"
              variant={layers.deviations ? "default" : "outline"}
              className="h-7 text-xs px-2"
              onClick={() => toggleLayer("deviations")}
            >
              {layers.deviations ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              Desvios
            </Button>

            <Button
              size="sm"
              variant={layers.offline ? "default" : "outline"}
              className="h-7 text-xs px-2"
              onClick={() => toggleLayer("offline")}
            >
              {layers.offline ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              Offline
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        <div ref={mapContainerRef} className="h-[350px] w-full rounded-b-lg" />

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-b-lg">
            <p className="text-sm text-muted-foreground">Sem dados de localização disponíveis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
