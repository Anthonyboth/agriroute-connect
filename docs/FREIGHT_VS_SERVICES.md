# Separação entre Fretes e Serviços

## 📋 Visão Geral

Este documento explica a arquitetura de separação completa entre **Fretes** (transporte de cargas) e **Serviços** (assistência técnica, consultoria, etc.) no sistema.

## 🎯 Objetivo

Garantir que:
- ✅ **Fretes aparecem APENAS no painel de motoristas**
- ✅ **Serviços aparecem APENAS no painel de prestadores**
- ✅ **Impossível criar tipo errado na tabela errada** (validação de banco)
- ✅ **Zero confusão entre os dois conceitos**

---

## 🗃️ Estrutura de Tabelas

### `freights` - Apenas Transporte

**Tipos permitidos (freight_service_type):**
- `FRETE_MOTO` - Frete de moto
- `CARGA` - Carga geral
- `CARGA_GERAL` - Carga geral
- `CARGA_AGRICOLA` - Carga agrícola
- `CARGA_GRANEL` - Carga a granel
- `CARGA_LIQUIDA` - Carga líquida
- `GUINCHO` - Guincho
- `MUDANCA` - Mudança
- `TRANSPORTE_ANIMAIS` - Transporte de animais
- `TRANSPORTE_MAQUINARIO` - Transporte de maquinário

**Constraint:** `check_freight_service_type`
```sql
CHECK (service_type::text = ANY(ARRAY[
  'FRETE_MOTO', 'CARGA', 'CARGA_GERAL', ...
]::text[]))
```

### `service_requests` - Apenas Serviços

**Tipos permitidos (provider_service_type):**
- `AGRONOMO` - Agrônomo
- `ANALISE_SOLO` - Análise de solo
- `ASSISTENCIA_TECNICA` - Assistência técnica
- `MECANICO` - Mecânico
- `BORRACHEIRO` - Borracheiro
- `CHAVEIRO` - Chaveiro
- `AUTO_ELETRICA` - Auto elétrica
- `COMBUSTIVEL` - Combustível
- `LIMPEZA_RURAL` - Limpeza rural
- `PULVERIZACAO_DRONE` - Pulverização com drone
- `COLHEITA_TERCEIRIZADA` - Colheita terceirizada
- `TOPOGRAFIA` - Topografia
- `ENERGIA_SOLAR` - Energia solar
- `CONSULTORIA_RURAL` - Consultoria rural
- `VETERINARIO` - Veterinário
- `OUTROS` - Outros serviços

**Constraint:** `check_provider_service_type`
```sql
CHECK (service_type::text = ANY(ARRAY[
  'AGRONOMO', 'ANALISE_SOLO', 'ASSISTENCIA_TECNICA', ...
]::text[]))
```

---

## 🔧 RPCs Exclusivas

### Para Motoristas: `get_freights_for_driver(p_driver_id)`

**Retorna:**
- Apenas registros de `freights`
- Filtra por `service_type` de frete
- Exclui fretes já aceitos pelo motorista
- Inclui fretes parcialmente preenchidos (multi-truck)

**Uso:**
```typescript
const { data } = await supabase.rpc('get_freights_for_driver', {
  p_driver_id: profile.id
});
```

### Para Prestadores: `get_services_for_provider(p_provider_id)`

**Retorna:**
- Apenas registros de `service_requests`
- Filtra por `service_type` de serviço (nunca fretes)
- Exclui serviços já aceitos

**Uso:**
```typescript
const { data } = await supabase.rpc('get_services_for_provider', {
  p_provider_id: profile.id
});
```

---

## 🎯 Matching Espacial

### Driver Spatial Matching

**Arquivo:** `supabase/functions/driver-spatial-matching/index.ts`

**Filtro aplicado:**
```typescript
const freightServiceTypes = [
  'FRETE_MOTO', 'CARGA', 'CARGA_GERAL', 'CARGA_AGRICOLA', 
  'GUINCHO', 'MUDANCA', 'TRANSPORTE_ANIMAIS', 'TRANSPORTE_MAQUINARIO'
];

const { data: freights } = await supabase
  .from('freights')
  .select('*')
  .eq('status', 'OPEN')
  .in('service_type', freightServiceTypes) // ✅ Apenas fretes
  .limit(500);
```

### Provider Spatial Matching

**Arquivo:** `supabase/functions/service-provider-spatial-matching/index.ts`

**Filtro aplicado:**
```typescript
const providerServiceTypes = [
  'AGRONOMO', 'ANALISE_SOLO', 'ASSISTENCIA_TECNICA', 'MECANICO',
  'BORRACHEIRO', 'CHAVEIRO', 'AUTO_ELETRICA', 'COMBUSTIVEL', ...
];

const { data: serviceRequests } = await supabase
  .from('service_requests')
  .select('*')
  .eq('status', 'OPEN')
  .in('service_type', providerServiceTypes) // ✅ Apenas serviços
  .limit(100);
```

---

## 📱 Frontend

### SmartFreightMatcher (Motoristas)

**Arquivo:** `src/components/SmartFreightMatcher.tsx`

```typescript
const { data: freightsData } = await supabase.rpc(
  'get_freights_for_driver', 
  { p_driver_id: profile.id }
);
```

### ServiceProviderDashboard (Prestadores)

**Arquivo:** `src/components/ServiceProviderDashboard.tsx`

```typescript
const { data } = await supabase.rpc(
  'get_services_for_provider',
  { p_provider_id: providerId }
);
```

**Removido:** Filtro manual de `freightTypes` (não é mais necessário)

---

## ✅ Validações em Múltiplas Camadas

### 1. **Database Constraints** (Primeira linha de defesa)
- `check_freight_service_type` em `freights`
- `check_provider_service_type` em `service_requests`
- **Impossível** inserir tipo errado

### 2. **RPCs com Filtros** (Segunda linha de defesa)
- `get_freights_for_driver` - apenas tipos de frete
- `get_services_for_provider` - apenas tipos de serviço

### 3. **Edge Functions** (Terceira linha de defesa)
- `driver-spatial-matching` - filtra `freightServiceTypes`
- `service-provider-spatial-matching` - filtra `providerServiceTypes`

### 4. **Frontend** (Interface do usuário)
- Uso direto das RPCs exclusivas
- Sem necessidade de filtros manuais

---

## 🔄 Migração de Dados

A migração automática moveu todos os registros de **tipos de frete** que estavam incorretamente em `service_requests` para a tabela `freights`.

**Função:** `migrate_freight_requests_to_freights()`

**Tipos migrados:**
- `FRETE_MOTO`
- `CARGA`, `CARGA_GERAL`, `CARGA_AGRICOLA`
- `GUINCHO`, `MUDANCA`
- `TRANSPORTE_ANIMAIS`, `TRANSPORTE_MAQUINARIO`

---

## 🆕 Como Adicionar Novos Tipos

### Adicionar Novo Tipo de Frete

1. **Atualizar o enum:**
```sql
ALTER TYPE freight_service_type ADD VALUE 'NOVO_TIPO_FRETE';
```

2. **Atualizar constraint:**
```sql
ALTER TABLE freights DROP CONSTRAINT check_freight_service_type;
ALTER TABLE freights ADD CONSTRAINT check_freight_service_type 
CHECK (service_type::text = ANY(ARRAY[
  'FRETE_MOTO', ..., 'NOVO_TIPO_FRETE'
]::text[]));
```

3. **Atualizar RPCs e Edge Functions** (adicionar aos arrays de filtro)

### Adicionar Novo Tipo de Serviço

1. **Atualizar o enum:**
```sql
ALTER TYPE provider_service_type ADD VALUE 'NOVO_SERVICO';
```

2. **Atualizar constraint:**
```sql
ALTER TABLE service_requests DROP CONSTRAINT check_provider_service_type;
ALTER TABLE service_requests ADD CONSTRAINT check_provider_service_type 
CHECK (service_type::text = ANY(ARRAY[
  'AGRONOMO', ..., 'NOVO_SERVICO'
]::text[]));
```

3. **Atualizar RPCs e Edge Functions** (adicionar aos arrays de filtro)

---

## 🐛 Troubleshooting

### Frete não aparece no painel do motorista

**Possíveis causas:**
1. ✅ Verificar se `service_type` é um tipo de frete válido
2. ✅ Confirmar que está na tabela `freights` (não `service_requests`)
3. ✅ Status deve ser `OPEN` ou com vagas disponíveis
4. ✅ Motorista deve ter cidade/área compatível

### Serviço aparece no painel errado

**Solução:**
- Verificar constraints do banco
- Confirmar uso das RPCs corretas
- Checar filtros nas edge functions

### Erro ao criar frete/serviço

**Causa:** Tentativa de inserir tipo incompatível
**Solução:** Usar o tipo correto conforme a tabela

---

## 📊 Diagrama de Fluxo

```
┌─────────────────┐
│   PRODUTOR      │
│  cria solicitação│
└────────┬────────┘
         │
    ┌────▼────┐
    │ É FRETE?│
    └────┬────┘
         │
    ┌────▼──────────────┐
    │                   │
┌───▼──────┐    ┌──────▼─────┐
│ FRETE    │    │ SERVIÇO    │
│ (freights│    │(service_   │
│  table)  │    │ requests)  │
└────┬─────┘    └──────┬─────┘
     │                 │
     │                 │
┌────▼─────┐    ┌──────▼────┐
│MOTORISTA │    │PRESTADOR  │
│Dashboard │    │Dashboard  │
└──────────┘    └───────────┘
```

---

## 📚 Arquivos Relacionados

**Banco de Dados:**
- Migration: `supabase/migrations/[timestamp]_freight_vs_services.sql`
- Função migração: `migrate_freight_requests_to_freights()`
- RPCs: `get_freights_for_driver()`, `get_services_for_provider()`

**Edge Functions:**
- `supabase/functions/driver-spatial-matching/index.ts`
- `supabase/functions/service-provider-spatial-matching/index.ts`

**Frontend:**
- `src/components/SmartFreightMatcher.tsx`
- `src/components/ServiceProviderDashboard.tsx`

---

## 🔐 Segurança

- ✅ Constraints impedem dados incorretos no banco
- ✅ RPCs com security definer e set search_path
- ✅ Filtros em múltiplas camadas
- ✅ RLS policies aplicadas corretamente
- ✅ Validação de tipos em tempo de inserção

---

## ✨ Resultado Final

✅ **Separação Total**: Fretes em `freights`, serviços em `service_requests`
✅ **Constraints DB**: Impossível inserir tipo errado
✅ **RPCs Dedicadas**: Cada painel usa sua própria RPC exclusiva
✅ **Matching Isolado**: Drivers só veem fretes, providers só veem serviços
✅ **Zero Confusão**: Código claro e manutenível
✅ **Performance**: Queries otimizadas sem filtros manuais
✅ **Segurança**: Validações em múltiplas camadas
