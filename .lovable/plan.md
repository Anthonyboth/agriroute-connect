
# Plano de Correção: Markers do Mapa Deslocados para o Oceano

## Diagnóstico do Problema

Após análise detalhada do código e dados do banco, identifiquei as seguintes questões:

### 1. Dados no Banco de Dados
- **Origem** (Primavera do Leste): `lat=-15.5606322, lng=-54.2890136` ✅ Correto
- **Destino** (Canarana): `lat=null, lng=null` ❌ Faltando no frete
- **Tabela Cities** (Canarana-MT): `lat=-13.5514, lng=-52.2697` ✅ Correto
- **Motorista**: `lat=-15.568, lng=-54.309` ✅ Correto

### 2. Problema Identificado
Os markers aparecem sobre o oceano Atlântico porque:

1. **Falta de anchor nos markers do FreightRealtimeMapMapLibre**: Os markers de origem/destino são criados diretamente sem especificar `anchor: 'bottom'`, diferente do padrão usado no hook `useMapLibreMarkers`.

2. **Inconsistência na criação de markers**: O componente `FreightRealtimeMapMapLibre` cria markers manualmente em vez de usar o hook padronizado `useMapLibreMarkers`, resultando em comportamento diferente.

3. **Potencial problema no cálculo de bounds**: O `fitBounds` pode estar calculando a área visível incorretamente quando as coordenadas são muito próximas.

4. **Logs de debug não ativos**: Os console.logs estão lá mas o mapa pode estar recebendo coordenadas diferentes do esperado.

## Solução Proposta

### Parte 1: Corrigir Anchor dos Markers (Principal)

Adicionar `anchor: 'bottom'` aos markers de origem e destino no `FreightRealtimeMapMapLibre.tsx`:

```typescript
// Antes
originMarkerRef.current = new maplibregl.Marker({
  element: originElement,
})

// Depois  
originMarkerRef.current = new maplibregl.Marker({
  element: originElement,
  anchor: 'bottom',  // ✅ Ponta do pin na coordenada exata
})
```

### Parte 2: Forçar Validação de Coordenadas

Adicionar validação explícita antes de criar markers, garantindo que coordenadas fora do Brasil sejam rejeitadas:

```typescript
const isValidBrazilCoord = (lat: number, lng: number): boolean => {
  return lat >= -35 && lat <= 6 && lng >= -75 && lng <= -30;
};
```

### Parte 3: Melhorar Logs de Debug

Adicionar logs mais detalhados para rastrear o fluxo completo das coordenadas:

```typescript
console.log('[FreightRealtimeMapMapLibre] 📍 Coords received:', {
  originLat, originLng,
  destinationLat, destinationLng,
  initialDriverLat, initialDriverLng
});

console.log('[FreightRealtimeMapMapLibre] 📍 After normalization:', {
  mapOrigin, mapDestination, mapDriverLocation
});
```

### Parte 4: Validar Coordenadas na Criação do Frete

Garantir que ao criar um frete, as coordenadas de destino sejam preenchidas corretamente (atualmente estão `null`).

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/freight/FreightRealtimeMapMapLibre.tsx` | Adicionar anchor aos markers, melhorar logs, validação extra |
| `src/lib/geo/normalizeLatLngPoint.ts` | Adicionar log mais detalhado para debug |

## Detalhes Técnicos

### Correção 1: FreightRealtimeMapMapLibre.tsx

Nos useEffects que criam markers (~linhas 488-530), adicionar o anchor correto:

```typescript
// Marker de Origem
originMarkerRef.current = new maplibregl.Marker({
  element: originElement,
  anchor: 'bottom', // ✅ CRÍTICO: Pin apontando para coordenada
})

// Marker de Destino  
destinationMarkerRef.current = new maplibregl.Marker({
  element: destinationElement,
  anchor: 'bottom', // ✅ CRÍTICO: Pin apontando para coordenada
})

// Marker do Motorista (já está correto com 'center')
```

### Correção 2: Adicionar Validação de Sanidade

Antes de usar coordenadas normalizadas, validar que estão dentro do Brasil:

```typescript
const mapOrigin = useMemo(() => {
  const normalized = normalizeLatLngPoint(effectiveOrigin, 'BR');
  // Validação extra de sanidade
  if (normalized && 
      normalized.lat >= -35 && normalized.lat <= 6 &&
      normalized.lng >= -75 && normalized.lng <= -30) {
    return normalized;
  }
  console.warn('[FreightRealtimeMapMapLibre] ❌ Origin coords invalid after normalization:', normalized);
  return null;
}, [effectiveOrigin]);
```

### Correção 3: Logs de Rastreamento

Adicionar logs no início do componente para rastrear todo o fluxo:

```typescript
// Logo após os useMemo de effectiveOrigin, effectiveDestination, effectiveDriverLocation
useEffect(() => {
  console.log('[FreightRealtimeMapMapLibre] 🔍 Coordinate Flow Debug:', {
    props: { originLat, originLng, destinationLat, destinationLng },
    effective: { effectiveOrigin, effectiveDestination, effectiveDriverLocation },
    normalized: { mapOrigin, mapDestination, mapDriverLocation },
    fallback: { cityOriginCoords, cityDestinationCoords }
  });
}, [originLat, originLng, destinationLat, destinationLng, effectiveOrigin, effectiveDestination, effectiveDriverLocation, mapOrigin, mapDestination, mapDriverLocation, cityOriginCoords, cityDestinationCoords]);
```

## Resultado Esperado

Após as correções:
1. Markers de origem (A) e destino (B) aparecerão nas posições corretas dentro do Brasil
2. O marker do caminhão aparecerá na localização real do motorista
3. A rota OSRM conectará corretamente os pontos
4. Logs detalhados permitirão debug rápido de problemas futuros

## Observação Importante

O problema também pode estar relacionado ao fato de que `destination_lat` e `destination_lng` estão `null` no banco. Recomendo também verificar o wizard de criação de frete para garantir que essas coordenadas sejam salvas corretamente quando o destino é selecionado.
