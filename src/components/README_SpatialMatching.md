# Sistema de Matching Espacial - AgriRoute

## Visão Geral

Sistema de matching inteligente de fretes por região/raio implementado com PostgreSQL + PostGIS. O sistema permite que motoristas cadastrem múltiplas bases operacionais e recebam notificações apenas de fretes relevantes para suas áreas de atendimento.

## Arquitetura

### Backend (Supabase)

#### Tabelas Principais

1. **`driver_service_areas`** - Áreas de atendimento dos motoristas
   - Suporte a múltiplas áreas por motorista
   - Geometria geográfica otimizada com índices GiST
   - Precomputed service area polygons para performance

2. **`freight_matches`** - Log de matches para auditoria
   - Tipos de match: ORIGIN, ROUTE, DESTINATION
   - Score de compatibilidade (0.1 - 1.0)
   - Timestamp de notificação

3. **`driver_notification_limits`** - Throttling de notificações
   - Máximo 10 notificações por hora por motorista (configurável)
   - Reset automático da janela deslizante

#### Funções SQL Principais

- `find_drivers_by_origin()` - Matching por ponto de origem
- `find_drivers_by_route()` - Matching por intersecção de rota
- `execute_freight_matching()` - Processo completo de matching
- `can_notify_driver()` - Verificação de throttling

### Edge Functions

#### 1. `spatial-freight-matching`
**POST** - Executa matching completo para um frete
```json
{
  "freight_id": "uuid",
  "notify_drivers": true
}
```

**GET** - Consulta matches existentes
```
GET /spatial-freight-matching?freight_id=uuid
```

#### 2. `driver-service-areas`
**CRUD** completo para áreas de atendimento do motorista
- POST: Criar nova área
- GET: Listar áreas do motorista
- PUT: Atualizar área existente
- DELETE: Remover área

### Frontend (React Components)

#### 1. `DriverServiceAreasManager`
- Interface para gerenciar bases operacionais
- Captura de localização GPS
- Configuração de raio de atendimento
- Ativação/desativação de áreas

#### 2. `SpatialFreightMatching`
- Dashboard para produtores executarem matching
- Visualização de motoristas compatíveis
- Controle de notificações
- Métricas de performance

## Performance e Escalabilidade

### Otimizações Implementadas

1. **Índices Geoespaciais**
   ```sql
   CREATE INDEX idx_driver_service_areas_geom ON driver_service_areas USING GIST (geom);
   CREATE INDEX idx_driver_service_areas_service_area ON driver_service_areas USING GIST (service_area);
   ```

2. **Precomputed Polygons**
   - Service areas são calculadas automaticamente via trigger
   - Projeção Web Mercator (EPSG:3857) para precisão métrica

3. **Notification Throttling**
   - Limita spam de notificações
   - Window sliding de 1 hora

### Métricas Alvo

- **Latência**: ≤ 300ms para matching com 100k áreas
- **Throughput**: Suporte a múltiplos fretes simultâneos
- **Precisão**: Matching assertivo por distância euclidiana

## Uso do Sistema

### Para Motoristas

1. **Cadastrar Áreas de Atendimento**
   ```javascript
   // Exemplo: Motorista com base em Primavera do Leste + Rondonópolis
   const areas = [
     {
       city_name: "Primavera do Leste",
       state: "MT", 
       lat: -15.556,
       lng: -54.296,
       radius_km: 100
     },
     {
       city_name: "Rondonópolis",
       state: "MT",
       lat: -16.470,
       lng: -54.635, 
       radius_km: 80
     }
   ];
   ```

2. **Receber Notificações Inteligentes**
   - Apenas fretes dentro do raio configurado
   - Throttling automático (máx 10/hora)
   - Score de compatibilidade

### Para Produtores

1. **Executar Matching**
   ```javascript
   const result = await executeMatching(freightId, { 
     notify_drivers: true 
   });
   
   console.log(`${result.matches_found} motoristas encontrados`);
   console.log(`${result.notifications_sent} notificações enviadas`);
   ```

2. **Visualizar Resultados**
   - Lista de motoristas compatíveis ordenada por score
   - Distância e tipo de match
   - Status de notificação

## Algoritmo de Matching

### 1. Matching por Origem
```sql
ST_DWithin(driver_area.geom, freight.origin_geog, driver_area.radius_m)
```

### 2. Matching por Rota (Futuro)
```sql
ST_Intersects(driver_area.service_area, ST_Transform(freight.route_geom, 3857))
```

### 3. Score Calculation
```javascript
const score = Math.max(0.1, 1.0 - (distance_m / radius_m));
```

## Configuração e Deploy

### 1. Enable PostGIS
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 2. Deploy Edge Functions
```bash
# Automatically deployed by Lovable
# Functions available at:
# - /functions/v1/spatial-freight-matching
# - /functions/v1/driver-service-areas
```

### 3. Frontend Integration
```jsx
import DriverServiceAreasManager from '@/components/DriverServiceAreasManager';
import SpatialFreightMatching from '@/components/SpatialFreightMatching';

// Para motoristas
<DriverServiceAreasManager />

// Para produtores  
<SpatialFreightMatching freightId={freight.id} />
```

## Monitoramento e Logs

### Métricas Importantes
- Número de matches por frete
- Latência de queries espaciais  
- Taxa de notificações throttled
- Distribuição de scores

### Debugging
```javascript
// Logs disponíveis via Supabase Functions
console.log('Spatial matching executed:', {
  freight_id,
  matches_found: results.length,
  execution_time: performance.now() - start
});
```

## Extensões Futuras

1. **Machine Learning Scoring**
   - Histórico de aceites do motorista
   - Preferências de carga
   - Rating e performance

2. **Matching por Rota Completa**
   - ST_ClosestPoint para rotas complexas
   - Otimização de trajetos

3. **Geofencing Dinâmico**
   - Áreas baseadas em polígonos irregulares
   - Zonas de exclusão temporárias

4. **Cache Inteligente**
   - Redis para matches frequentes
   - Invalidação por região

## Segurança

- RLS policies implementadas
- Throttling de notificações
- Validação de ownership
- Function search paths imutáveis

Este sistema oferece matching espacial de alta performance e escalabilidade para o AgriRoute, garantindo que motoristas recebam apenas fretes relevantes para suas áreas de operação.