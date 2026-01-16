import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { Crosshair, Eye } from "lucide-react";

type LatLng = { lat: number; lng: number };

const DEFAULT_CENTER: [number, number] = [-51.925, -14.235]; // Brasil
const DEFAULT_ZOOM = 4.5;

// ✅ Estilo raster SUPER simples (sem glyphs/sprites) -> evita “mapa branco” por bloqueio/CSP
const OSM_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "OSM Raster Minimal",
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-brightness-min": 0.15,
        "raster-brightness-max": 0.95,
        "raster-contrast": 0.2,
        "raster-saturation": -0.1,
      },
    },
  ],
};

function isNum(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n) && !Number.isNaN(n);
}

function toLngLat(p?: LatLng | null): [number, number] | null {
  if (!p) return null;
  if (!isNum(p.lat) || !isNum(p.lng)) return null;
  return [p.lng, p.lat];
}

function buildBounds(points: Array<[number, number] | null | undefined>) {
  const valid = points.filter(Boolean) as [number, number][];
  if (valid.length === 0) return null;
  const b = new maplibregl.LngLatBounds();
  valid.forEach((c) => b.extend(c));
  return b;
}

export interface FreightTrackingMapProps {
  /** posição atual do motorista (se houver) */
  driverPos?: LatLng | null;
  /** origem do frete (se houver) */
  origin?: LatLng | null;
  /** destino do frete (se houver) */
  destination?: LatLng | null;

  /** string para exibir “Offline / Online” no UI (opcional) */
  isOffline?: boolean;

  /** texto do “última atualização” (opcional) */
  lastUpdateText?: string;

  className?: string;
}

/**
 * ✅ Mapa de Acompanhamento: NUNCA fica vazio.
 * - Não depende de Carto/Mapbox style externo
 * - Resistente a aba (container invisível)
 * - Mostra erro real se tiles/style falharem
 */
export const FreightTrackingMap: React.FC<FreightTrackingMapProps> = ({
  driverPos,
  origin,
  destination,
  isOffline,
  lastUpdateText,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const roRef = useRef<ResizeObserver | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const pointsForBounds = useMemo(() => {
    return [toLngLat(origin), toLngLat(destination), toLngLat(driverPos)];
  }, [origin, destination, driverPos]);

  const ensureResize = () => {
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => {
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
  };

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = buildBounds(pointsForBounds);
    if (!bounds) {
      map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 250 });
      return;
    }

    // 1 ponto -> zoom ok, vários -> fitBounds
    const valid = pointsForBounds.filter(Boolean) as [number, number][];
    if (valid.length === 1) {
      map.easeTo({ center: valid[0], zoom: 12, duration: 250 });
      return;
    }

    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 250 });
  };

  const centerOnDriver = () => {
    const map = mapRef.current;
    const p = toLngLat(driverPos);
    if (!map || !p) return;
    map.easeTo({ center: p, zoom: 13, duration: 250 });
  };

  // INIT robusto (aba invisível -> IntersectionObserver força resize)
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    const el = containerRef.current;

    const map = new maplibregl.Map({
      container: el,
      style: OSM_RASTER_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false, // tipagem safe
      pixelRatio: window.devicePixelRatio || 1,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      if (cancelled) return;
      setReady(true);
      setMapError(null);
      ensureResize();
      fitAll();
    });

    // ⚠️ erro real (tiles/style/cors)
    map.on("error", (e: any) => {
      const msg = e?.error?.message || e?.error?.status || e?.type || "Erro desconhecido ao carregar o mapa";
      console.error("[FreightTrackingMap] map error:", e);
      setMapError(String(msg));
    });

    mapRef.current = map;

    // ResizeObserver (layout)
    const ro = new ResizeObserver(() => ensureResize());
    ro.observe(el);
    roRef.current = ro;

    // IntersectionObserver (aba / hidden)
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((en) => en.isIntersecting);
        if (visible) {
          ensureResize();
          // se ficou branco por init escondido, isso salva
          setTimeout(() => {
            ensureResize();
            fitAll();
          }, 80);
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    ioRef.current = io;

    // primeiros resizes
    setTimeout(() => ensureResize(), 0);
    setTimeout(() => ensureResize(), 200);

    return () => {
      cancelled = true;
      ioRef.current?.disconnect();
      roRef.current?.disconnect();
      ioRef.current = null;
      roRef.current = null;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers (origem/destino/motorista)
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const addMarker = (lng: number, lat: number, html: string) => {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 6px 16px rgba(0,0,0,0.22)";
      el.style.background = html; // usamos cor direto

      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      markersRef.current.push(marker);
      return marker;
    };

    const o = toLngLat(origin);
    const d = toLngLat(destination);
    const p = toLngLat(driverPos);

    if (o) addMarker(o[0], o[1], "#22c55e"); // verde
    if (d) addMarker(d[0], d[1], "#ef4444"); // vermelho

    if (p) {
      // caminhão (maior)
      const el = document.createElement("div");
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.22)";
      el.style.background = isOffline ? "#64748b" : "#3b82f6"; // cinza/azul
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "white";
      el.style.fontSize = "13px";
      el.textContent = "🚛";

      const marker = new maplibregl.Marker({ element: el }).setLngLat(p).addTo(map);
      markersRef.current.push(marker);
    }

    ensureResize();
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, origin, destination, driverPos, isOffline]);

  return (
    <div className={className}>
      <div className="relative w-full h-[360px] rounded-xl overflow-hidden border bg-muted/10">
        <div ref={containerRef} className="absolute inset-0" />

        {/* topo: status */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-background/80 backdrop-blur border">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isOffline ? "bg-red-500" : "bg-green-500"}`} />
            {isOffline ? "Offline" : "Online"}
          </div>

          <div className="px-3 py-1.5 rounded-full text-xs bg-background/80 backdrop-blur border">
            {lastUpdateText || "—"}
          </div>
        </div>

        {/* botões */}
        <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-2">
          <Button variant="secondary" className="shadow" onClick={centerOnDriver} disabled={!toLngLat(driverPos)}>
            <Crosshair className="h-4 w-4 mr-2" />
            Centralizar
          </Button>
          <Button variant="secondary" className="shadow" onClick={fitAll}>
            <Eye className="h-4 w-4 mr-2" />
            Ver tudo
          </Button>
        </div>

        {/* erro real */}
        {mapError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90">
            <div className="max-w-md text-center p-4">
              <p className="text-sm font-semibold">Mapa não carregou</p>
              <p className="text-xs text-muted-foreground mt-2 break-words">Motivo: {mapError}</p>
              <p className="text-xs text-muted-foreground mt-2">
                (Isso normalmente é bloqueio de rede/CSP de tiles externos.)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
