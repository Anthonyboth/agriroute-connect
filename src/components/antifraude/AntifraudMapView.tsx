import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

  const [mapReady, setMapReady] = useState(false);

  const [layers, setLayers] = useState({
    stops: true,
    deviations: true,
    offline: true,
  });

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 🔒 Centro seguro (0 é válido, NaN não)
  const center = useMemo<[number, number]>(() => {
    const points: [number, number][] = [];

    const push = (lng?: number, lat?: number) => {
      if (typeof lng === "number" && typeof lat === "number" && !Number.isNaN(lng) && !Number.isNaN(lat)) {
        points.push([lng, lat]);
      }
    };

    push(originLng, originLat);
    push(destinationLng, destinationLat);
    push(currentLng, currentLat);

    stops.forEach((s) => push(Number(s.lng), Number(s.lat)));
    routeDeviations.forEach((d) => push(Number(d.lng), Number(d.lat)));
    offlineIncidents.forEach((o) => push(o.last_known_lng, o.last_known_lat));

    if (!points.length) return DEFAULT_CENTER;

    return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
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

  // 🧠 Inicialização robusta do mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    const init = async () => {
      // Aguarda container real (evita mapa branco)
      while (!cancelled) {
        const rect = mapContainerRef.current?.getBoundingClientRect();
        if (rect && rect.width > 10 && rect.height > 10) break;
        await new Promise((r) => requestAnimationFrame(r));
      }

      if (cancelled || !mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center,
        zoom: 8,
        pixelRatio: window.devicePixelRatio || 1,

        // ✅ CORRETO (NUNCA true)
        attributionControl: { compact: true },
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        requestAnimationFrame(() => {
          map.resize();
          requestAnimationFrame(() => map.resize());
        });
        setMapReady(true);
      });

      map.on("error", (e) => {
        console.error("[AntifraudMapView] Map error:", e?.error || e);
      });

      mapRef.current = map;

      const ro = new ResizeObserver(() => map.resize());
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
      setMapReady(false);
    };
  }, [center]);

  // 🔄 Centraliza quando dados mudam
  useEffect(() => {
    if (mapRef.current && mapReady) {
      mapRef.current.setCenter(center);
    }
  }, [center, mapReady]);

  // 📍 Markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const add = (lng: number, lat: number, el: HTMLElement, html?: string) => {
      const m = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]);
      if (html) m.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(html));
      m.addTo(map);
      markersRef.current.push(m);
    };

    if (typeof originLat === "number" && typeof originLng === "number") {
      const el = document.createElement("div");
      el.className =
        "w-6 h-6 bg-green-500 text-white rounded-full border-2 border-white flex items-center justify-center";
      el.textContent = "O";
      add(originLng, originLat, el, "<strong>Origem</strong>");
    }

    if (typeof destinationLat === "number" && typeof destinationLng === "number") {
      const el = document.createElement("div");
      el.className =
        "w-6 h-6 bg-red-500 text-white rounded-full border-2 border-white flex items-center justify-center";
      el.textContent = "D";
      add(destinationLng, destinationLat, el, "<strong>Destino</strong>");
    }

    if (typeof currentLat === "number" && typeof currentLng === "number") {
      const el = document.createElement("div");
      el.className =
        "w-8 h-8 bg-blue-500 text-white rounded-full border-2 border-white flex items-center justify-center animate-pulse";
      el.textContent = "🚛";
      add(currentLng, currentLat, el, "<strong>Posição Atual</strong>");
    }

    if (layers.stops) {
      stops.forEach((s) => {
        add(Number(s.lng), Number(s.lat), document.createElement("div"));
      });
    }

    if (markersRef.current.length) {
      const bounds = new maplibregl.LngLatBounds();
      markersRef.current.forEach((m) => bounds.extend(m.getLngLat()));
      map.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 0 });
    }
  }, [
    mapReady,
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
    stops.length ||
    routeDeviations.length ||
    offlineIncidents.length ||
    typeof originLat === "number" ||
    typeof destinationLat === "number" ||
    typeof currentLat === "number";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="h-4 w-4" /> Mapa Antifraude
          </CardTitle>

          <div className="flex gap-1">
            {(["stops", "deviations", "offline"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={layers[k] ? "default" : "outline"}
                className="h-7 text-xs px-2"
                onClick={() => toggleLayer(k)}
              >
                {layers[k] ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {k}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        <div ref={mapContainerRef} className="h-[350px] w-full rounded-b-lg" />
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <p className="text-sm text-muted-foreground">Sem dados de localização</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
