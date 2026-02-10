
# Correcao Completa do MapLibre - Diagnostico e Plano de Acao

## Problemas Identificados

### 1. CRITICO: `contain: strict` no container do mapa (MapLibreBase.tsx, linha 214)

O container que recebe o mapa MapLibre tem `contain: 'strict'` aplicado via inline style. O valor `strict` equivale a `contain: size layout paint style`. A propriedade `size` faz com que o elemento ignore o tamanho de seus filhos para calcular suas proprias dimensoes -- o MapLibre precisa detectar as dimensoes do container para renderizar o canvas corretamente. Com `size` containment, o canvas pode ser renderizado com dimensoes zero, resultando em **mapa branco**.

**Correcao:** Trocar `contain: 'strict'` por `contain: 'layout paint'` (sem `size`).

### 2. CRITICO: `contain: layout style paint` duplicado no CSS global (index.css, linha 247)

O seletor `.maplibregl-map` tambem aplica `contain: layout style paint`. Embora nao inclua `size`, a combinacao de containment no container pai E no `.maplibregl-map` pode causar problemas de composicao, especialmente em Drawers/Dialogs com transform. A propriedade `style` containment impede que counters e quotes do mapa afetem o exterior, mas pode interferir com a resolucao de `font-size` e `em` units internos do MapLibre.

**Correcao:** Simplificar para `contain: layout paint` no CSS global.

### 3. MODERADO: `attributionControl: {}` (objeto vazio) em MapLibre v5

Em tres arquivos (`useMapLibreMap.ts`, `FreightRealtimeMapMapLibre.tsx`, `RouteReplayPlayerMapLibre.tsx`), o mapa e criado com `attributionControl: {}`. Na v5 do MapLibre, o tipo esperado e `boolean | AttributionControlOptions`. Um objeto vazio `{}` pode funcionar, mas e semanticamente incorreto e pode causar comportamentos inesperados em futuras versoes.

**Correcao:** Trocar `attributionControl: {}` por `attributionControl: true` (ou simplesmente remover, pois `true` e o padrao).

### 4. MODERADO: Type mismatch em MapLibreMap.tsx (wrapper legado)

O componente `MapLibreMap` converte markers para `MapLibreMarkerData[]` (interface do hook deprecated `useMapLibreMarkers`) e passa para `MapLibreBase` que espera `GeoJSONMarkerData[]`. Os campos sao incompativeis: `MapLibreMarkerData` tem `element` e `popup`, enquanto `GeoJSONMarkerData` tem `type` e `properties`. Os markers passados via este wrapper nao serao renderizados corretamente.

**Correcao:** Converter para `GeoJSONMarkerData[]` no `MapLibreMap`.

### 5. MENOR: Markers desativados no RouteReplayPlayerMapLibre.tsx

No `RouteReplayPlayerMapLibre.tsx`, os markers de caminhao, origem e destino estao **comentados** (linhas 130-161) com o texto "DESATIVADO TEMPORARIAMENTE - ZERANDO MAPA". O mapa funciona, mas sem indicadores visuais, o que prejudica a usabilidade do replay.

**Correcao:** Reativar os markers, pois o problema original (mapa zerando) era causado pelo `contain: strict` e nao pelos markers.

## Plano de Implementacao

### Etapa 1 - Corrigir `contain: strict` no MapLibreBase.tsx
- Linha 214: Trocar `contain: 'strict'` por `contain: 'layout paint'`
- Manter `transform: 'none'` e `isolation: 'isolate'` (estes sao corretos)

### Etapa 2 - Corrigir CSS global no index.css
- Linha 247: Trocar `contain: layout style paint` por `contain: layout paint` no seletor `.maplibregl-map`

### Etapa 3 - Corrigir `attributionControl` nos 3 arquivos
- `useMapLibreMap.ts` linha 151: `attributionControl: attributionControl ? true : false`
- `FreightRealtimeMapMapLibre.tsx` linha 431: `attributionControl: true`
- `RouteReplayPlayerMapLibre.tsx` linha 91: `attributionControl: true`

### Etapa 4 - Corrigir type mismatch em MapLibreMap.tsx
- Converter markers de `MapLibreMarkerData[]` para `GeoJSONMarkerData[]` no `useMemo`

### Etapa 5 - Reativar markers no RouteReplayPlayerMapLibre.tsx
- Descomentar o bloco de criacao de markers (linhas 134-161)
- Adicionar a layer `progress-path-line` que esta faltando

## Detalhes Tecnicos

```text
Arquivos a editar:
1. src/components/map/MapLibreBase.tsx        -- contain: strict -> layout paint
2. src/index.css                              -- contain no .maplibregl-map
3. src/hooks/maplibre/useMapLibreMap.ts        -- attributionControl
4. src/components/freight/FreightRealtimeMapMapLibre.tsx -- attributionControl
5. src/components/freight/RouteReplayPlayerMapLibre.tsx  -- attributionControl + markers
6. src/components/map/MapLibreMap.tsx           -- type mismatch markers
```

A causa raiz do "mapa branco" e o `contain: strict` que impede o MapLibre de detectar as dimensoes do container. As demais correcoes sao para evitar regressoes e melhorar a confiabilidade.
