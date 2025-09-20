# Sistema de Matching Espacial para Prestadores de Serviços - AgriRoute

## Visão Geral

Sistema de matching inteligente de solicitações de serviços por região/raio implementado com PostgreSQL + PostGIS. O sistema permite que prestadores de serviços cadastrem múltiplas áreas de atendimento e recebam notificações apenas de solicitações relevantes para suas regiões e especialidades.

## Arquitetura

### Backend (Supabase)

#### Tabelas Principais

1. **`service_provider_areas`** - Áreas de atendimento dos prestadores
   - Suporte a múltiplas áreas por prestador
   - Filtro por tipos de serviços oferecidos
   - Geometria geográfica otimizada com índices GiST
   - Precomputed service area polygons para performance

2. **`service_matches`** - Log de matches para auditoria
   - Tipos de match: LOCATION, SERVICE_TYPE, BOTH
   - Score de proximidade (0.1 - 1.0)
   - Score de compatibilidade de serviço (0.5 - 1.0)
   - Timestamp de notificação

3. **`provider_notification_limits`** - Throttling de notificações
   - Máximo 15 notificações por hora por prestador (configurável)
   - Reset automático da janela deslizante

#### Funções SQL Principais

- `find_providers_by_location()` - Matching por localização
- `find_providers_by_service_and_location()` - Matching combinado
- `execute_service_matching()` - Processo completo de matching
- `can_notify_provider()` - Verificação de throttling

### Edge Functions

#### 1. `service-provider-spatial-matching`
**POST** - Executa matching completo para uma solicitação
```json
{
  "service_request_id": "uuid", // OR guest_request_id
  "request_lat": -15.556,
  "request_lng": -54.296, 
  "service_type": "GUINCHO",
  "notify_providers": true
}
```

**GET** - Consulta matches existentes
```
GET /service-provider-spatial-matching?service_request_id=uuid
GET /service-provider-spatial-matching?guest_request_id=uuid
```

#### 2. `service-provider-areas`
**CRUD** completo para áreas de atendimento do prestador
- POST: Criar nova área com tipos de serviços
- GET: Listar áreas do prestador
- PUT: Atualizar área existente
- DELETE: Remover área

### Frontend (React Components)

#### 1. `ServiceProviderAreasManager`
- Interface para gerenciar áreas operacionais
- Seleção de tipos de serviços oferecidos
- Captura de localização GPS
- Configuração de raio de atendimento
- Ativação/desativação de áreas

#### 2. `SpatialServiceMatching`
- Dashboard para executar matching de prestadores
- Matching automático e manual
- Visualização de prestadores compatíveis
- Controle de notificações
- Métricas de compatibilidade

## Algoritmo de Matching

### 1. Matching por Localização
```sql
ST_DWithin(provider_area.geom, request_point, provider_area.radius_m)
```

### 2. Matching por Tipo de Serviço
```sql
required_service_type = ANY(provider_area.service_types)
```

### 3. Scoring Inteligente
```javascript
// Score de proximidade
const proximityScore = Math.max(0.1, 1.0 - (distance_m / radius_m));

// Score de compatibilidade de serviço
const serviceScore = serviceMatch ? 1.0 : 0.5;
```

## Performance e Escalabilidade

### Otimizações Implementadas

1. **Índices Geoespaciais**
   ```sql
   CREATE INDEX idx_service_provider_areas_geom ON service_provider_areas USING GIST (geom);
   CREATE INDEX idx_service_provider_areas_service_types ON service_provider_areas USING GIN (service_types);
   ```

2. **Precomputed Polygons**
   - Service areas são calculadas automaticamente via trigger
   - Projeção Web Mercator (EPSG:3857) para precisão métrica

3. **Notification Throttling**
   - Limita spam de notificações (15/hora)
   - Window sliding de 1 hora

### Tipos de Match

1. **LOCATION** - Apenas proximidade geográfica
2. **SERVICE_TYPE** - Apenas compatibilidade de serviço  
3. **BOTH** - Proximidade + compatibilidade (melhor score)

## Uso do Sistema

### Para Prestadores de Serviços

1. **Cadastrar Áreas de Atendimento**
   ```javascript
   const areas = [
     {
       city_name: "Primavera do Leste",
       state: "MT", 
       lat: -15.556,
       lng: -54.296,
       radius_km: 50,
       service_types: ["GUINCHO", "MECANICA", "BORRACHARIA"]
     },
     {
       city_name: "Rondonópolis", 
       state: "MT",
       lat: -16.470,
       lng: -54.635,
       radius_km: 40,
       service_types: ["GUINCHO", "REBOQUE"]
     }
   ];
   ```

2. **Receber Notificações Inteligentes**
   - Apenas solicitações na área de cobertura
   - Filtradas por tipos de serviços oferecidos
   - Throttling automático (máx 15/hora)
   - Scoring por proximidade e compatibilidade

### Para Clientes/Produtores

1. **Executar Matching Automático**
   ```javascript
   // Para service_requests existentes
   const result = await executeMatching(serviceRequestId);
   
   // Para guest_requests
   const result = await executeMatching(guestRequestId, 'guest_request');
   ```

2. **Matching Manual**
   ```javascript
   const result = await executeMatching({
     request_lat: -15.556,
     request_lng: -54.296,
     service_type: 'GUINCHO',
     notify_providers: true
   });
   ```

## Integração com Sistema Existente

### Compatibilidade
- Funciona com `service_requests` existentes
- Suporta `guest_requests` anônimas  
- Integra com sistema de notificações atual
- Mantém auditoria completa de matches

### Fluxo de Integração
1. Cliente cria solicitação → Salva com coordenadas
2. Sistema executa `execute_service_matching()` automaticamente
3. Prestadores compatíveis são notificados via push
4. Matches ficam logados para análise

## API Endpoints

### Gerenciar Áreas do Prestador
```
POST   /functions/v1/service-provider-areas
GET    /functions/v1/service-provider-areas  
PUT    /functions/v1/service-provider-areas?id=uuid
DELETE /functions/v1/service-provider-areas?id=uuid
```

### Executar Matching
```
POST /functions/v1/service-provider-spatial-matching
{
  "service_request_id": "uuid",
  "request_lat": -15.556,
  "request_lng": -54.296,
  "service_type": "GUINCHO",
  "notify_providers": true
}

Response:
{
  "success": true,
  "request_id": "uuid", 
  "matches_found": 5,
  "matches": [...],
  "notifications_sent": 3
}
```

## Configuração Frontend

### Para Prestadores de Serviços
```jsx
import ServiceProviderAreasManager from '@/components/ServiceProviderAreasManager';

// No dashboard do prestador
<ServiceProviderAreasManager />
```

### Para Executar Matching
```jsx
import SpatialServiceMatching from '@/components/SpatialServiceMatching';

// No painel de admin ou dashboard do cliente
<SpatialServiceMatching 
  requestId={serviceRequest.id}
  requestType="service_request"
  requestLat={serviceRequest.location_lat}
  requestLng={serviceRequest.location_lng}
  requestServiceType={serviceRequest.service_type}
  onMatchComplete={(matches) => console.log('Matches:', matches)}
/>
```

## Monitoramento e Métricas

### Métricas Importantes
- Número de matches por solicitação
- Taxa de conversão (notificação → aceite)
- Distribuição de scores de compatibilidade
- Tempo médio de resposta do prestador

### Logs de Performance
```javascript
console.log('Service matching executed:', {
  request_id,
  matches_found: results.length,
  avg_distance: avgDistance,
  service_compatibility_rate: compatibilityRate,
  execution_time: executionTimeMs
});
```

## Diferenças do Sistema de Fretes

1. **Service Types Array** - Prestadores podem oferecer múltiplos serviços
2. **Dual Scoring** - Proximidade + compatibilidade de serviço  
3. **Guest Requests** - Suporte a solicitações anônimas
4. **Menor Raio** - Prestadores geralmente atendem áreas menores (30-100km)
5. **Maior Throttling** - 15 notificações/hora (vs 10 para motoristas)

## Extensões Futuras

1. **Priorização por Urgência**
   - Emergências bypass throttling
   - Notificação imediata para casos críticos

2. **Machine Learning Scoring**
   - Histórico de aceites do prestador
   - Tempo médio de resposta
   - Rating por tipo de serviço

3. **Routing Otimizado**
   - Considerar trânsito em tempo real
   - Múltiplos prestadores para mesmo cliente

Este sistema oferece matching espacial e por especialidade de alta performance para prestadores de serviços, garantindo que apenas profissionais qualificados e próximos sejam notificados sobre solicitações relevantes.