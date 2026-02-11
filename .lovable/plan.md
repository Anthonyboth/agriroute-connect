
Contexto confirmado e diagnóstico inicial (com base no código atual)
- O “Mapa de Acompanhamento” do frete (FreightStatusTracker → FreightRealtimeMapMapLibre) NÃO usa MapLibreBase; ele inicializa o maplibre-gl diretamente.
- Hoje, vários mapas silenciam erros de tiles/glyphs (“Failed to fetch” e erros de rede) e continuam renderizando a UI por cima, deixando o canvas branco sem erro visível.
  - FreightRealtimeMapMapLibre ignora explicitamente “Failed to fetch”.
  - useMapLibreMap (usado por MapLibreBase) filtra erros de tiles/glyphs e não eleva erro para UI.
- Há múltiplos pontos de inicialização de mapa no projeto (7 arquivos) com padrões diferentes de resize/guards, o que aumenta chance de “canvas 0x0” e também dificulta fallback consistente quando tiles falham.
- Resultado: quando os tiles falham (por bloqueio, rate limit, CORS intermitente, SW/cache, ou timing de Drawer/Dialog), o app não apresenta fallback, então “parece que nada funciona”.

Objetivo do patch
A) Eliminar “mapa branco” (tiles sempre aparecem), em página normal e dentro de Drawer/Dialog (com animações/transform).
B) Eliminar offset/flutuação de markers: proibir DOM markers e usar apenas layers GeoJSON (circle/symbol).
C) Distância: manual opcional + auto OSRM + fallback Haversine (sem fator mágico), persistindo distance_km + distance_source.

Escopo exato (arquivos afetados por mapa hoje)
Map creation (7):
- src/hooks/maplibre/useMapLibreMap.ts
- src/components/freight/FreightRealtimeMapMapLibre.tsx
- src/components/freight/MultiDriverMapMapLibre.tsx
- src/components/freight/RouteReplayPlayerMapLibre.tsx
- src/components/freight/RouteReplayPlayer.tsx
- src/components/antifraude/AntifraudMapView.tsx
- src/components/FleetGPSTrackingMap.tsx
Markers (DOM Marker ainda existe):
- src/components/freight/FreightRealtimeMapMapLibre.tsx
- src/components/freight/MultiDriverMapMapLibre.tsx
- src/components/freight/RouteReplayPlayerMapLibre.tsx
- src/components/freight/RouteReplayPlayer.tsx
- src/components/antifraude/AntifraudMapView.tsx (tem markers via DOM em outras partes do arquivo)
- src/components/FleetGPSTrackingMap.tsx (markers comentados hoje, mas ainda é DOM marker no código)
GeoJSON marker hook:
- src/hooks/maplibre/useMapLibreGeoJSONLayers.ts
CSS global MapLibre:
- src/index.css

ETAPA 1 — Debug + correção definitiva do “MAPA BRANCO” (primeiro, obrigatório)
1) Implementar “Map Diagnostics” padronizado (DEV-only, sem spam em produção)
   - Criar um helper interno (sem refactor gigante) reaproveitável nos mapas existentes:
     - Uma função utilitária no próprio useMapLibreMap (e copiada de forma mínima nos mapas que ainda não usam o hook), que:
       - Loga uma única vez por instância:
         - container.getBoundingClientRect(), offsetWidth/offsetHeight, computedStyle (display/visibility/position)
         - devicePixelRatio, map.getStyle().sources (ids), map.isStyleLoaded(), map.areTilesLoaded()
       - Assina eventos:
         - map.once('load')
         - map.on('error') (sem suprimir “Failed to fetch” no DEV; em PROD contabilizar para fallback)
         - map.on('styledata')
         - map.on('sourcedata')
         - map.on('data')
         - map.once('idle') (quando possível)
       - Captura URL do erro quando existir (e.g., e?.source?.url) para sabermos se é tile/glyph/sprite.
   - Gatilho: apenas quando import.meta.env.DEV && (localStorage.debug_maplibre === '1'), para você poder ligar/desligar.

2) Parar de “engolir” erro de tile sem fallback (causa principal do branco persistente)
   - Ajustar os handlers:
     - Em FreightRealtimeMapMapLibre: remover o early-return para “Failed to fetch” e, em vez disso:
       - DEV: console.warn detalhado com url/type
       - PROD: incrementar contador de falhas e acionar fallback automático (próximo item)
     - Em useMapLibreMap: manter o filtro apenas para “não travar UI”, mas agora:
       - contabilizar falhas de rede por source
       - disparar fallback se exceder limiar (ex.: 6 erros em 2s ou “areTilesLoaded=false” por 4-6s após load)

3) Implementar “Tile Watchdog” (garantia de nunca ficar branco)
   - Após map 'load':
     - Executar checks em 1.0s, 2.5s, 5.0s:
       - se map.areTilesLoaded() ainda false OU nenhuma sourcedata “loaded=true” do source principal, então:
         - Forçar map.resize() burst curto (para timing de Dialog/Drawer)
         - Se persistir, trocar estilo para fallback com provedor alternativo.
   - Fallback em cascata (tudo raster, sem Google):
     1) CARTO Voyager (já usado em /public/styles/rural-dark.json e RURAL_STYLE_INLINE)
     2) OSM HOT (ou tile.openstreetmap.org) como alternativa
     3) Outro endpoint CARTO (light_all/dark_all) se necessário
   - Implementação técnica:
     - Criar uma função geradora de style “raster base” (mesmo shape do RURAL_STYLE_INLINE, mas com tiles trocáveis).
     - Quando watchdog falhar: map.setStyle(novoStyle) e re-aplicar overlays (rota, heatmap) no evento 'styledata'/'load' do novo style.

4) Resize robusto para Drawer/Dialog (fim de animação)
   - Padronizar: TODOS os mapas devem usar o mesmo mecanismo.
   - A ação mínima e segura:
     - Integrar useMapLibreAutoResize em FreightRealtimeMapMapLibre e nos demais mapas que ainda gerenciam resize “na mão”.
       - enableResizeBurst=true
       - listener de transitionend/animationend em ancestrais (o hook já faz isso)
   - Adicionar um “resize burst” também quando Drawer/Dialog abrir:
     - gatilho via transitionend (já no hook), + rAF burst ~700ms.

5) CSS: remover/relaxar containment que possa interferir com WebGL em alguns layouts
   - Ajuste mínimo e rastreável:
     - Em src/index.css: remover contain: layout paint de .maplibregl-map (manter isolation: isolate).
     - Em MapLibreBase wrapper (src/components/map/MapLibreBase.tsx): remover contain: 'layout paint' do wrapper (manter isolation).
   - Motivo: paint containment pode causar comportamento inconsistente em canvas/WebGL em alguns browsers e stacking contexts; como você relatou “tudo branco”, vamos eliminar essa variável global e deixar resize + watchdog fazer o trabalho.

Critério de sucesso A (como vamos validar)
- Em /dashboard/driver, abrir/fechar detalhes do frete 10x: o mapa sempre aparece com tiles em até 2s.
- Abrir mapa em Dialog/Drawer com animação: tiles aparecem sempre.
- Alternar abas/sections: tiles permanecem e não somem.
- Se o provedor falhar, entra fallback automático (OSM) sem tela branca.

ETAPA 2 — Padrão definitivo de markers (proibir DOM Markers)
Meta: zerar `new maplibregl.Marker()` no runtime para mapas dentro de Drawer/Dialog.

1) Evoluir useMapLibreGeoJSONLayers para suportar múltiplos tipos e labels sem recriar layer
   - Manter o export existente (não quebrar imports).
   - Melhorias mínimas:
     - Fonte GeoJSON única (FeatureCollection).
     - circle-color com expressão `match` pelo `properties.type`:
       - origin: verde, destination: vermelho, driver/truck: primary, default: cinza
     - Adicionar layer “symbol” opcional para label (A/B) via `text-field` e `text-size`.
     - Garantir ids únicos por instância de mapa:
       - prefixar source/layer IDs com um “mapInstanceId” (gerado no hook com Math.random/Date.now) para evitar colisão quando múltiplos mapas existem em portais.
     - Atualização via `source.setData()` apenas (sem remover/adicionar layers em updates).

2) Migrar mapas que hoje usam DOM markers
   - FreightRealtimeMapMapLibre:
     - Remover originMarkerRef/destinationMarkerRef/driverMarkerRef/ghostDriverMarkerRef e interpolação DOM.
     - Representar driver online/offline como marker type diferente (e.g., driver vs driver_offline) com cor/opacity.
     - Para animação suave: interpolar as coordenadas e atualizar `setData()` a cada frame (ou a cada 200ms) em vez de mover DOM marker.
   - MultiDriverMapMapLibre:
     - Cada motorista vira Feature com id fixo; update só setData.
     - Click: map.on('click', layerId, ...) ou queryRenderedFeatures no click global.
   - RouteReplayPlayerMapLibre e RouteReplayPlayer:
     - Substituir marker do caminhão por Feature com id 'replay-truck' e atualizar coordenadas conforme currentIndex.
   - AntifraudMapView:
     - Idem: pontos e eventos de clique via layers.
   - FleetGPSTrackingMap:
     - Hoje markers estão “desativados temporariamente”; vamos remover o trecho de DOM marker e planejar a versão em GeoJSON (para não voltar a quebrar depois).

Critério de sucesso B
- Sem offset/flutuação em Dialog/Drawer.
- Sem “marker gigante” (porque não dependerá mais de CSS/DOM).
- Click funciona via queryRenderedFeatures.
- Não há criação de DOM markers nos mapas principais.

ETAPA 3 — Distância (manual opcional + OSRM + Haversine) com persistência
Estado atual do banco
- freights.distance_km existe
- freights.distance_source existe (já foi adicionado)
- NÃO existe freights.distancia_km_manual (precisa adicionar)

1) Migração DB (nova)
- Adicionar coluna:
  - freights.distancia_km_manual numeric null
- (Opcional, mas recomendado) constraint lógica via trigger (não CHECK) para garantir >= 0 quando preenchido.

2) Lógica de cálculo (hierarquia obrigatória)
- Na criação/edição de frete:
  1) Se distancia_km_manual preenchida:
     - distance_km = distancia_km_manual
     - distance_source = 'manual'
  2) Senão:
     - tentar OSRM (router.project-osrm.org) e salvar:
       - distance_km (km) = distance_m/1000
       - distance_source = 'auto_osrm'
     - se OSRM falhar:
       - haversine puro e salvar:
         - distance_source = 'auto_haversine'
     - se não houver coords:
       - tentar preencher coords via cities + Nominatim (já existe useCityCoordinates/safeNominatimGeocode)
       - se falhar: erro explícito (sem defaults mágicos)

3) UI
- Adicionar campo opcional “Distância (km) — opcional (manual)” no formulário de solicitação/edição de frete.
- Badge:
  - “X km (Manual)” | “X km (Rota)” | “X km (Linha reta)”
- Garantir que lugares que exibem distance_km não quebrem quando null.

Checklist de teste manual (5 passos) após implementar A/B/C
1) /dashboard/driver → abrir detalhes do frete com “Mapa de Acompanhamento” 10x: tiles sempre aparecem.
2) Abrir o mesmo mapa dentro de Dialog/Drawer e fechar/reabrir: sem canvas branco.
3) Forçar falha de tiles (simular offline / bloquear cartocdn): mapa deve cair para fallback (OSM) automaticamente e continuar visível.
4) Validar markers: origem/destino/motorista “colados” durante pan/zoom; sem offset em animação.
5) Criar/editar frete:
   - Com distancia_km_manual preenchida: badge mostra “Manual” e persiste.
   - Sem manual: calcula OSRM; se OSRM indisponível, Haversine; badge mostra origem.

Notas de compatibilidade / não quebrar exports (regras do projeto)
- Não renomear componentes exportados (ex.: FreightRealtimeMapMapLibre continua exportado).
- Mudanças serão concentradas apenas nos módulos de mapa + cálculo de distância; sem refactor amplo fora disso.
- Onde houver tipagem problemática (ex.: attributionControl), manter o padrão já aceito pelo type do maplibre-gl (false | AttributionControlOptions).

Ação manual (security finding recorrente)
- “Leaked Password Protection Disabled” é configuração do Supabase Auth e precisa ser ativada no painel (não é corrigível via código). Não bloqueia o patch do mapa/distância.

Sequência de implementação (ordem exata)
1) Instrumentação DEV-only + Tile Watchdog + fallback de provedor em useMapLibreMap.
2) Aplicar o mesmo watchdog e resize robusto em TODOS os 7 mapas (padronizar).
3) Remover contain: layout paint de .maplibregl-map e de MapLibreBase wrapper.
4) Converter FreightRealtimeMapMapLibre para GeoJSON markers (primeiro, porque é o mais crítico e está em Dialog/Drawer).
5) Converter os demais mapas (MultiDriver, Replay, Antifraud, Fleet).
6) DB migration distancia_km_manual + UI + persistência distance_source + badge.
