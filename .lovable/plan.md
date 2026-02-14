
# Fix: Markers Flutuando no Mapa de Acompanhamento

## Causa Raiz

O mapa de acompanhamento (`FreightRealtimeMapMapLibre.tsx`) usa **dois sistemas diferentes** para desenhar no mapa:

- **Rota (linha da estrada)**: Desenhada como **GeoJSON layer no canvas** do mapa -- fica fixa ao zoom/pan porque faz parte do rendering interno do MapLibre.
- **Markers (A, B, caminhao)**: Criados como **elementos HTML DOM** (`new maplibregl.Marker({ element })`) -- sao `div`s posicionadas via CSS `transform: translate()` SOBRE o canvas.

Quando o mapa esta dentro de um container que tem CSS transforms (Drawer, Dialog, Sheet -- todos usam `transform: translateY()` para animacao de abertura), o calculo de posicao dos DOM Markers fica incorreto porque o `transform` do ancestral cria um novo "containing block" CSS, deslocando os markers de suas coordenadas reais.

A rota nunca flutua porque esta no **canvas WebGL**, imune a CSS. Os markers flutuam porque sao **HTML puro** sujeito a heranca de transforms.

## Solucao

Converter os 3 markers (origem A, destino B, caminhao) de **DOM Markers** para **GeoJSON Symbol Layers** renderizados no canvas, identico a rota. O projeto ja tem esse padrao implementado em outros componentes (`MapLibreBase` usa `useMapLibreGeoJSONLayers`), mas o `FreightRealtimeMapMapLibre` nunca foi migrado.

## Plano de Implementacao

### Arquivo: `src/components/freight/FreightRealtimeMapMapLibre.tsx`

1. **Remover** toda logica de DOM Markers:
   - Remover refs: `driverMarkerRef`, `ghostDriverMarkerRef`, `originMarkerRef`, `destinationMarkerRef`
   - Remover os 2 `useEffect` que criam/atualizam markers DOM (linhas ~629-759)
   - Remover `createTruckMarkerElement` e `createLocationMarkerElement` imports

2. **Adicionar** markers como GeoJSON symbol layers no evento `map.on('load')`:
   - Gerar imagens SVG como `Image` objects e registra-las com `map.addImage('origin-pin', ...)`, `map.addImage('destination-pin', ...)`, `map.addImage('truck-icon', ...)`
   - Criar source GeoJSON `markers-source` com FeatureCollection
   - Adicionar layer `type: 'symbol'` com `icon-image` baseado em property do feature

3. **Adicionar** `useEffect` para atualizar o GeoJSON source quando `mapOrigin`, `mapDestination` ou `mapDriverLocation` mudam:
   - Montar FeatureCollection com os pontos validos
   - Chamar `source.setData(geojson)` -- identico a como a rota ja e atualizada

4. **Manter** a animacao suave do caminhao usando `requestAnimationFrame` + `source.setData()` (ao inves de `marker.setLngLat()`)

### Arquivo: `src/styles/maplibre-markers.css`

- Nenhuma alteracao necessaria -- as classes CSS continuam uteis para outros mapas que usam DOM markers (ex: `DriverLocationMapMapLibre`), mas nao serao mais usadas neste componente.

### Resultado Esperado

- Markers A, B e caminhao ficam **fixos nas coordenadas exatas**, identico a linha da rota
- Zoom in/out nao causa flutuacao
- Funciona dentro de Drawer/Dialog/Sheet sem interferencia de CSS transforms
- Animacao suave do caminhao mantida
- Popups de click nos markers mantidos via `map.on('click', 'markers-layer', ...)`

## Detalhes Tecnicos

A conversao usa `map.addImage()` para registrar os SVGs como icones rasterizados no estilo do mapa. O processo:

```text
SVG string --> canvas 2D --> ImageData --> map.addImage(id, imageData)
```

Cada feature no GeoJSON tera uma property `icon` que mapeia para o nome da imagem registrada:

```text
GeoJSON Source (markers-source)
  |
  +-- Feature { type: "origin", coords: [lng, lat] }    --> icon: "origin-pin"
  +-- Feature { type: "destination", coords: [lng, lat] } --> icon: "destination-pin"  
  +-- Feature { type: "truck", coords: [lng, lat] }      --> icon: "truck-icon"
  |
Symbol Layer (markers-layer)
  icon-image: ["get", "icon"]
  icon-size: 1
  icon-allow-overlap: true
  icon-anchor: ["match", ["get", "type"], "truck", "center", "bottom"]
```
