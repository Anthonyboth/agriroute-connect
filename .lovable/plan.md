
# Plano: Debug HARD de Markers no MapLibre

## Problema Identificado

Encontrei a **causa raiz** do problema: os markers estao sendo ZERADOS em multiplos lugares:

1. **DriverLocationMapMapLibre.tsx (linha 93)**: Passa `markers={[]}` explicitamente
2. **MapLibreMap.tsx (linha 111)**: Passa `markers={[]}` ignorando o `normalizedMarkers` calculado
3. **useMapLibreMarkers.ts (linhas 80-96)**: Codigo DESATIVADO com comentario `// DESATIVADO TEMPORARIAMENTE - ZERANDO MAPA`

---

## Plano de Correcao em 3 Etapas

### ETAPA 1 - Logs de Debug no MapLibreBase.tsx

Adicionar logs imediatos no componente para provar que markers chegam (ou nao):

```text
LINHA ~92 (inicio do componente):
  console.log("[MapLibreBase] markers prop:", markers, "count:", markers?.length);

APOS map.on("load") em useMapLibreMap.ts:
  console.log("[MapLibreBase] map ready - center:", map.getCenter(), "zoom:", map.getZoom());
```

### ETAPA 2 - Correcao do useMapLibreGeoJSONLayers.ts

O hook ja existe e funciona, mas precisa de logs adicionais e validacao explicita:

```text
LINHA ~138-170 (setupSourceAndLayers):
  - Log quando criar source: "source existe?"
  - Log quando criar layer: "layer existe?"

LINHA ~210-223 (updatePoints):
  - Validar cada feature antes de adicionar:
    - typeof lat === "number"
    - typeof lng === "number"
    - isFinite(lat) && isFinite(lng)
    - lat >= -90 && lat <= 90
    - lng >= -180 && lng <= 180
  - Log: console.log("[MapLibreBase] setData features:", features.length, features[0])

NOVA FUNCAO (apos updatePoints):
  - Se features.length >= 1, calcular bounds e executar fitBounds
  - Executar resize burst por 500ms (15 frames)
```

### ETAPA 3 - Correcao dos Componentes que Passam Markers Vazios

**DriverLocationMapMapLibre.tsx:**
- DESCOMENTAR o useMemo dos markers (linhas 45-69)
- MUDAR linha 93 de `markers={[]}` para `markers={markers}`

**MapLibreMap.tsx:**
- MUDAR linha 111 de `markers={[]}` para `markers={normalizedMarkers}`

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/map/MapLibreBase.tsx` | Adicionar logs de markers prop |
| `src/hooks/maplibre/useMapLibreGeoJSONLayers.ts` | Logs + validacao + fitBounds + resize burst |
| `src/components/driver-details/DriverLocationMapMapLibre.tsx` | Descomentar markers + passar corretamente |
| `src/components/map/MapLibreMap.tsx` | Passar normalizedMarkers ao inves de array vazio |

---

## Codigo Final Esperado

### MapLibreBase.tsx (logs)

```typescript
export const MapLibreBase = forwardRef<MapLibreBaseRef, MapLibreBaseProps>(({
  // ... props
  markers = [],
  // ...
}, ref) => {
  // DEBUG: Provar que markers chegam
  console.log("[MapLibreBase] markers prop:", markers, "count:", markers?.length);
  
  // ... resto do componente
});
```

### useMapLibreGeoJSONLayers.ts (logs + validacao + fitBounds)

```typescript
const updatePoints = useCallback((points: GeoJSONMarkerData[]) => {
  const map = mapRef.current;
  if (!map) return;

  try {
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    
    // LOG: source existe?
    console.log("[MapLibreBase] source existe?", !!source);
    console.log("[MapLibreBase] layer existe?", !!map.getLayer(layerCircleId));
    
    if (source) {
      const geojson = markersToGeoJSON(points);
      
      // Validar features antes de setData
      const validFeatures = geojson.features.filter(f => {
        const coords = (f.geometry as GeoJSON.Point).coordinates;
        const lng = coords[0];
        const lat = coords[1];
        const isValid = 
          typeof lat === 'number' && typeof lng === 'number' &&
          isFinite(lat) && isFinite(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180;
        if (!isValid) {
          console.warn("[MapLibreBase] Feature invalida:", f.properties?.id, { lat, lng });
        }
        return isValid;
      });
      
      console.log("[MapLibreBase] setData features:", validFeatures.length, validFeatures[0]);
      
      source.setData({
        type: 'FeatureCollection',
        features: validFeatures,
      });
      
      // ETAPA 3: fitBounds + resize burst
      if (validFeatures.length >= 1) {
        const bounds = new maplibregl.LngLatBounds();
        validFeatures.forEach(f => {
          const coords = (f.geometry as GeoJSON.Point).coordinates;
          bounds.extend(coords as [number, number]);
        });
        
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 0 });
        console.log("[MapLibreBase] fitBounds executado para", validFeatures.length, "pontos");
        
        // Resize burst por 500ms (15 frames) para Drawers com transform
        for (let i = 0; i < 15; i++) {
          setTimeout(() => map.resize(), i * (500 / 15));
        }
      }
    }
  } catch (error) {
    console.error('[GeoJSONLayers] Erro ao atualizar pontos:', error);
  }
}, [mapRef, sourceId, layerCircleId]);
```

### DriverLocationMapMapLibre.tsx (descomentar markers)

```typescript
// Marker do motorista (usando coordenadas normalizadas)
const markers = useMemo<MapLibreMarkerData[]>(() => {
  if (!normalizedLocation) return [];
  
  return [{
    id: 'driver-location',
    lat: normalizedLocation.lat,
    lng: normalizedLocation.lng,
  }];
}, [normalizedLocation]);

// No JSX:
<MapLibreBase
  ref={mapRef}
  center={{ lat: normalizedLocation.lat, lng: normalizedLocation.lng }}
  zoom={15}
  className={className}
  minHeight={400}
  markers={markers}  // <-- CORRIGIDO: era markers={[]}
  onLoad={handleLoad}
  showNavigationControl
/>
```

### MapLibreMap.tsx (passar normalizedMarkers)

```typescript
<MapLibreBase
  ref={baseRef}
  center={center}
  zoom={zoom}
  className={className}
  markers={normalizedMarkers}  // <-- CORRIGIDO: era markers={[]}
  onClick={onClick}
  onLoad={onLoad}
  showNavigationControl
>
  {children}
</MapLibreBase>
```

---

## Criterio de Aceite

Apos a implementacao, voce deve ver no console:

- `[MapLibreBase] markers prop: [{...}] count: 1`
- `[MapLibreBase] source existe? true`
- `[MapLibreBase] layer existe? true`
- `[MapLibreBase] setData features: 1 {type:"Feature", ...}`
- `[MapLibreBase] fitBounds executado para 1 pontos`

E visualmente:

- Um circulo escuro com borda branca visivel no mapa
- O mapa centralizado automaticamente no ponto
