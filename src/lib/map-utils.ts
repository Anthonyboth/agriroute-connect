/**
 * src/lib/map-utils.ts
 * 
 * Utilitários para o mapa em tempo real do AgriRoute.
 * Inclui animação de marker, estilos rurais e formatação de tempo.
 */

/**
 * Estilo de mapa otimizado para zonas rurais
 * Remove POIs desnecessários e melhora a legibilidade
 */
export const RURAL_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#dcdcdc" }] },
  { featureType: "landscape", stylers: [{ color: "#f5f7f2" }] },
  { featureType: "water", stylers: [{ color: "#c9e6f5" }] },
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "simplified" }] }
];

/**
 * Ícone SVG de caminhão para o marker do motorista
 */
export const TRUCK_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="11" fill="#16a34a" stroke="#15803d" stroke-width="2"/>
  <path d="M5 13L2 8l4-2 3 4z" fill="white" stroke="white" stroke-width="1" transform="translate(5, 4) scale(0.7)"/>
  <rect x="7" y="6" width="8" height="6" rx="1" fill="white" stroke="white" stroke-width="0.5" transform="translate(1, 2) scale(0.8)"/>
  <rect x="14" y="8" width="5" height="4" rx="0.5" fill="white" stroke="white" stroke-width="0.5" transform="translate(0, 2) scale(0.8)"/>
  <circle cx="9" cy="14" r="1.5" fill="#16a34a" stroke="white" stroke-width="0.5" transform="translate(1, 0) scale(0.9)"/>
  <circle cx="16" cy="14" r="1.5" fill="#16a34a" stroke="white" stroke-width="0.5" transform="translate(-1, 0) scale(0.9)"/>
</svg>
`;

/**
 * Cria um elemento HTML para o marker do caminhão
 */
export function createTruckMarkerElement(): HTMLDivElement {
  const markerDiv = document.createElement('div');
  markerDiv.innerHTML = TRUCK_ICON_SVG;
  markerDiv.style.cursor = 'pointer';
  markerDiv.style.width = '40px';
  markerDiv.style.height = '40px';
  markerDiv.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
  return markerDiv;
}

/**
 * Função de easing para animação suave
 */
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * Interpola posição do marker com animação suave
 * Evita "teleporte" do marker entre atualizações
 */
export function interpolatePosition(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  duration: number = 1000,
  onUpdate: (pos: { lat: number; lng: number }) => void,
  onComplete?: () => void
): () => void {
  const startTime = Date.now();
  let animationId: number | null = null;
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuad(progress);
    
    const currentPos = {
      lat: from.lat + (to.lat - from.lat) * eased,
      lng: from.lng + (to.lng - from.lng) * eased
    };
    
    onUpdate(currentPos);
    
    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };
  
  animationId = requestAnimationFrame(animate);
  
  // Retorna função de cancelamento
  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
  };
}

/**
 * Calcula bounds para incluir origem, motorista e destino
 */
export function calculateBounds(
  points: Array<{ lat: number; lng: number } | null | undefined>
): google.maps.LatLngBounds | null {
  const validPoints = points.filter((p): p is { lat: number; lng: number } => 
    p !== null && p !== undefined && 
    typeof p.lat === 'number' && typeof p.lng === 'number' &&
    !isNaN(p.lat) && !isNaN(p.lng)
  );
  
  if (validPoints.length === 0) return null;
  
  const bounds = new google.maps.LatLngBounds();
  validPoints.forEach(point => {
    bounds.extend(new google.maps.LatLng(point.lat, point.lng));
  });
  
  return bounds;
}

/**
 * Formata segundos em texto legível
 * Ex: "há 15 segundos", "há 2 minutos"
 */
export function formatSecondsAgo(seconds: number): string {
  if (seconds < 0) return 'agora';
  
  if (seconds < 60) {
    return `há ${Math.floor(seconds)} segundo${Math.floor(seconds) !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `há ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  return `há ${hours} hora${hours !== 1 ? 's' : ''}`;
}

/**
 * Verifica se o motorista está online
 * Threshold padrão: 90 segundos
 */
export function isDriverOnline(lastUpdate: Date | string | null, thresholdMs: number = 90000): boolean {
  if (!lastUpdate) return false;
  
  const lastUpdateDate = typeof lastUpdate === 'string' ? new Date(lastUpdate) : lastUpdate;
  const timeSinceUpdate = Date.now() - lastUpdateDate.getTime();
  
  return timeSinceUpdate < thresholdMs;
}

/**
 * Calcula segundos desde a última atualização
 */
export function getSecondsSinceUpdate(lastUpdate: Date | string | null): number {
  if (!lastUpdate) return Infinity;
  
  const lastUpdateDate = typeof lastUpdate === 'string' ? new Date(lastUpdate) : lastUpdate;
  return Math.floor((Date.now() - lastUpdateDate.getTime()) / 1000);
}
