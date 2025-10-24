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
- **🆕 Aplica filtros de visibilidade** (ALL, TRANSPORTADORAS, AUTONOMOS, AVALIACAO_3, AVALIACAO_4)
- Exclui fretes já aceitos pelo motorista
- Inclui fretes parcialmente preenchidos (multi-truck)

**Uso:**
```typescript
const { data } = await supabase.rpc('get_freights_for_driver', {
  p_driver_id: profile.id
});
```

**Lógica de Filtragem:**
```sql
-- ALL: Todos motoristas veem o frete
-- TRANSPORTADORAS: Apenas motoristas com company_id
-- AUTONOMOS: Apenas motoristas sem company_id
-- AVALIACAO_3: Rating médio >= 3.0
-- AVALIACAO_4: Rating médio >= 4.0
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

## 🎛️ Filtros de Visibilidade

### Visão Geral

Permite que produtores **controlem quais motoristas** podem visualizar seus fretes de carga, aplicando critérios como tipo de motorista e avaliação.

### Campo `visibility_filter`

**Tabela:** `freights`  
**Tipo:** `text`  
**Padrão:** `'ALL'`  
**Valores permitidos:**

| Filtro | Descrição | Quem Vê |
|--------|-----------|---------|
| `ALL` | Todos motoristas | Motoristas autônomos + Transportadoras |
| `TRANSPORTADORAS` | Apenas empresas | Motoristas com `company_id` |
| `AUTONOMOS` | Apenas autônomos | Motoristas sem `company_id` |
| `AVALIACAO_3` | Avaliação ≥ 3 estrelas | Rating médio >= 3.0 |
| `AVALIACAO_4` | Avaliação ≥ 4 estrelas | Rating médio >= 4.0 |

### Constraint de Banco

```sql
ALTER TABLE freights ADD CONSTRAINT check_visibility_filter 
CHECK (visibility_filter IN ('ALL', 'TRANSPORTADORAS', 'AUTONOMOS', 'AVALIACAO_3', 'AVALIACAO_4'));
```

### Aplicação na RPC

A RPC `get_freights_for_driver` aplica automaticamente os filtros:

```sql
WHERE 
  (f.visibility_filter = 'ALL' OR
   (f.visibility_filter = 'TRANSPORTADORAS' AND p.company_id IS NOT NULL) OR
   (f.visibility_filter = 'AUTONOMOS' AND p.company_id IS NULL) OR
   (f.visibility_filter = 'AVALIACAO_3' AND avg_rating >= 3.0) OR
   (f.visibility_filter = 'AVALIACAO_4' AND avg_rating >= 4.0))
```

### Interface do Usuário

**Arquivo:** `src/components/CreateFreightModal.tsx`

```tsx
{formData.service_type === 'CARGA' && (
  <RadioGroup value={formData.visibility_filter || 'ALL'}>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="ALL" id="ALL" />
      <Label htmlFor="ALL">Todos motoristas</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="TRANSPORTADORAS" id="TRANSPORTADORAS" />
      <Label htmlFor="TRANSPORTADORAS">Apenas transportadoras</Label>
    </div>
    {/* ... outros filtros */}
  </RadioGroup>
)}
```

### Casos de Uso

**Caso 1:** Produtor precisa de transporte certificado
```
Frete de Carga Refrigerada → visibility_filter = 'TRANSPORTADORAS'
Resultado: Apenas transportadoras veem o frete
```

**Caso 2:** Produtor quer motoristas experientes
```
Frete de Carga Frágil → visibility_filter = 'AVALIACAO_4'
Resultado: Apenas motoristas com rating ≥ 4.0
```

**Caso 3:** Frete urgente sem restrições
```
Frete de Carga Geral → visibility_filter = 'ALL'
Resultado: Todos motoristas disponíveis
```

---

## 🔄 Reabrir Frete

### Visão Geral

Permite que **produtores** reabram fretes concluídos ou cancelados, criando uma **cópia completa** do frete original com status `OPEN`.

### RPC: `reopen_freight(p_freight_id uuid)`

**Funcionalidade:**
- Duplica todos os dados do frete original
- Define status como `OPEN`
- Mantém `producer_id` do frete original
- Adiciona metadata sobre a reabertura

**Código SQL:**
```sql
CREATE OR REPLACE FUNCTION public.reopen_freight(p_freight_id uuid)
RETURNS uuid AS $$
DECLARE
  v_new_freight_id uuid;
  v_original_freight record;
BEGIN
  SELECT * INTO v_original_freight FROM freights WHERE id = p_freight_id;
  
  IF v_original_freight.status NOT IN ('DELIVERED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Apenas fretes entregues ou cancelados podem ser reabertos';
  END IF;

  INSERT INTO freights (
    producer_id, service_type, cargo_type, cargo_description,
    weight, origin_city, origin_state, destination_city, destination_state,
    pickup_date, price, urgency, status, visibility_filter
  ) VALUES (
    v_original_freight.producer_id,
    v_original_freight.service_type,
    v_original_freight.cargo_type,
    v_original_freight.cargo_description || ' (Reaberto)',
    v_original_freight.weight,
    v_original_freight.origin_city,
    v_original_freight.origin_state,
    v_original_freight.destination_city,
    v_original_freight.destination_state,
    CURRENT_DATE + INTERVAL '1 day',
    v_original_freight.price,
    v_original_freight.urgency,
    'OPEN',
    v_original_freight.visibility_filter
  ) RETURNING id INTO v_new_freight_id;

  RETURN v_new_freight_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Interface do Usuário

**Arquivo:** `src/components/FreightHistory.tsx`

```tsx
{freight.status === 'DELIVERED' && freight.producer_id === session?.user?.id && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => handleReopenFreight(freight.id)}
    disabled={reopening}
  >
    <RefreshCw className="h-4 w-4 mr-2" />
    Reabrir Frete
  </Button>
)}
```

**Função de Reabertura:**
```typescript
const handleReopenFreight = async (freightId: string) => {
  const { data, error } = await supabase.rpc('reopen_freight', {
    p_freight_id: freightId
  });

  if (!error) {
    toast.success("Frete reaberto com sucesso!");
    fetchFreights();
  }
};
```

### Fluxo de Reabertura

```
┌──────────────────────────────────────┐
│  1. Produtor visualiza histórico    │
│     Status: DELIVERED ou CANCELLED   │
└────────────────┬─────────────────────┘
                 │
     ┌───────────▼──────────────┐
     │  2. Clica "Reabrir Frete" │
     └───────────┬──────────────┘
                 │
     ┌───────────▼──────────────┐
     │  3. RPC reopen_freight()  │
     │     - Valida status       │
     │     - Duplica dados       │
     │     - Status = OPEN       │
     └───────────┬──────────────┘
                 │
     ┌───────────▼──────────────┐
     │  4. Novo frete criado    │
     │     - Editável           │
     │     - Republicável       │
     └───────────┬──────────────┘
                 │
     ┌───────────▼──────────────┐
     │  5. Matching espacial     │
     │     - Notifica motoristas │
     └──────────────────────────┘
```

### Casos de Uso

**Caso 1:** Transporte recorrente
```
Produtor tem frete semanal de leite → Reabre frete anterior
Resultado: Economiza tempo, mantém mesmos dados (cidades, peso, etc.)
```

**Caso 2:** Frete cancelado por engano
```
Produtor cancelou por erro → Reabre imediatamente
Resultado: Republica sem precisar preencher tudo novamente
```

**Caso 3:** Demanda sazonal
```
Colheita em várias etapas → Reabre frete após cada entrega
Resultado: Mantém histórico e facilita repetição
```

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
5. 🆕 **Verificar `visibility_filter`** - Motorista pode estar filtrado

**Exemplo:**
```
Frete com visibility_filter = 'TRANSPORTADORAS'
Motorista autônomo (company_id = null) → NÃO vê o frete ✅
```

### 🆕 Frete só aparece para alguns motoristas

**Causa:** Filtro de visibilidade aplicado

**Verificações:**
1. Consultar `visibility_filter` do frete
2. Verificar se motorista atende aos critérios:
   - `TRANSPORTADORAS`: Tem `company_id`?
   - `AUTONOMOS`: Não tem `company_id`?
   - `AVALIACAO_3`: Rating médio >= 3.0?
   - `AVALIACAO_4`: Rating médio >= 4.0?

**Solução para produtor:** Editar frete e mudar para `ALL`

### 🆕 Não consigo reabrir frete

**Possíveis causas:**
1. ✅ Status não é `DELIVERED` ou `CANCELLED`
2. ✅ Usuário não é o produtor original do frete
3. ✅ Erro de permissão na RPC

**Solução:**
```sql
-- Verificar status do frete
SELECT id, status, producer_id FROM freights WHERE id = 'freight-id';

-- Deve retornar status = 'DELIVERED' ou 'CANCELLED'
-- E producer_id = id do usuário logado
```

### 🆕 Frete reaberto não mantém dados corretos

**Verificações:**
1. Checar se RPC `reopen_freight` está copiando todos os campos
2. Verificar se `visibility_filter` foi preservado
3. Conferir se `pickup_date` foi ajustado para data futura

**SQL de diagnóstico:**
```sql
SELECT 
  original.id as original_id,
  original.cargo_description as original_desc,
  reopened.id as reopened_id,
  reopened.cargo_description as reopened_desc,
  reopened.visibility_filter
FROM freights original
JOIN freights reopened ON reopened.cargo_description LIKE original.cargo_description || '%'
WHERE original.status = 'DELIVERED';
```

### Serviço aparece no painel errado

**Solução:**
- Verificar constraints do banco
- Confirmar uso das RPCs corretas
- Checar filtros nas edge functions

### Erro ao criar frete/serviço

**Causa:** Tentativa de inserir tipo incompatível
**Solução:** Usar o tipo correto conforme a tabela

---

## 📊 Diagrama de Fluxo Completo

```
┌──────────────────────────────────────────────────────────┐
│              PRODUTOR cria FRETE DE CARGA                │
└───────────────────────┬──────────────────────────────────┘
                        │
         ┌──────────────▼───────────────┐
         │ 🆕 Escolhe Filtro de         │
         │ Visibilidade? (OPCIONAL)     │
         └──────────────┬───────────────┘
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
┌─────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│    ALL     │  │TRANSPORTA-  │  │ AVALIACAO   │
│  (padrão)  │  │DORAS/AUTÔN. │  │   ≥3/≥4     │
└─────┬──────┘  └──────┬──────┘  └──────┬──────┘
      │                 │                 │
      └─────────────────┼─────────────────┘
                        │
         ┌──────────────▼───────────────┐
         │  Frete publicado em          │
         │  tabela FREIGHTS             │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │  Matching Espacial           │
         │  (respeita visibility_filter)│
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │  Motoristas/Transport.       │
         │  veem frete (FILTRADO)       │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │  Frete executado             │
         │  Status = DELIVERED          │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │ 🆕 Botão "Reabrir Frete"     │
         │  (Apenas para produtor)      │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │ RPC reopen_freight()         │
         │ - Duplica todos os dados     │
         │ - Status = OPEN              │
         │ - Mantém visibility_filter   │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │  Novo frete criado           │
         │  (Editável antes de publicar)│
         └──────────────────────────────┘


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
- 🆕 Migration: `supabase/migrations/20251024052508_*_visibility_reopen.sql`
- Função migração: `migrate_freight_requests_to_freights()`
- RPCs: `get_freights_for_driver()`, `get_services_for_provider()`
- 🆕 RPC: `reopen_freight(p_freight_id uuid)`

**Edge Functions:**
- `supabase/functions/driver-spatial-matching/index.ts`
- `supabase/functions/service-provider-spatial-matching/index.ts`

**Frontend:**
- `src/components/SmartFreightMatcher.tsx`
- `src/components/ServiceProviderDashboard.tsx`
- 🆕 `src/components/CreateFreightModal.tsx` (campo visibility_filter)
- 🆕 `src/components/FreightHistory.tsx` (botão reabrir)

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
🆕 **Filtros de Visibilidade**: Produtores controlam quem vê seus fretes
🆕 **Reabrir Fretes**: Reutilização de fretes concluídos com um clique
🆕 **Flexibilidade**: Sistema adaptável a diferentes necessidades de transporte
