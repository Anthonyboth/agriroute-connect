# Sistema de Múltiplas Carretas 🚛🚛🚛

## 📋 Visão Geral

O sistema de múltiplas carretas permite que um produtor solicite vários caminhões para transportar uma carga grande que não cabe em apenas um veículo. O sistema automaticamente gerencia as vagas disponíveis e mantém o frete visível para motoristas até que todas as carretas sejam preenchidas.

---

## 🎯 Como Funciona

### Para Produtores

1. **Criar Frete com Múltiplas Carretas**
   - Ao criar um frete, o produtor especifica quantas carretas são necessárias
   - Campo: `required_trucks` (ex: 12 carretas)
   - O frete é criado com status `OPEN`

2. **Motoristas Aceitam Individualmente**
   - Cada motorista aceita **uma vaga** por vez
   - O sistema atualiza automaticamente: `accepted_trucks++`
   - O frete continua `OPEN` enquanto houver vagas disponíveis

3. **Frete Totalmente Preenchido**
   - Quando `accepted_trucks >= required_trucks`
   - Status muda automaticamente para `ACCEPTED`
   - Frete some da lista de disponíveis
   - Todos os motoristas aceitos são notificados

### Para Motoristas

1. **Visualizar Fretes Disponíveis**
   - Motoristas veem fretes `OPEN` normalmente
   - **TAMBÉM** veem fretes `ACCEPTED`/`LOADING`/`LOADED`/`IN_TRANSIT` que ainda têm vagas
   - Badge mostra: `"1/12 carretas"` + `"11 vagas!"`

2. **Aceitar Uma Vaga**
   - Clicar em "Aceitar Frete" cria um `freight_assignment`
   - Motorista é adicionado ao array `drivers_assigned`
   - Se ainda houver vagas, frete continua aparecendo para outros motoristas

3. **Acompanhar Múltiplos Motoristas**
   - Todos os motoristas aceitos veem o mesmo frete em suas atribuições
   - Chat do frete inclui todos os participantes automaticamente
   - Cada motorista pode reportar sua própria entrega

---

## 🏗️ Arquitetura Técnica

### Estrutura do Banco de Dados

```sql
-- Tabela freights
CREATE TABLE freights (
  id UUID PRIMARY KEY,
  required_trucks INTEGER DEFAULT 1,     -- Quantas carretas necessárias
  accepted_trucks INTEGER DEFAULT 0,     -- Quantas já foram aceitas
  drivers_assigned UUID[] DEFAULT '{}',  -- Array com IDs dos motoristas
  is_full_booking BOOLEAN DEFAULT false, -- TRUE quando totalmente preenchido
  status freight_status,                 -- OPEN, ACCEPTED, etc.
  -- ... outros campos
);

-- Tabela freight_assignments (uma linha por motorista)
CREATE TABLE freight_assignments (
  id UUID PRIMARY KEY,
  freight_id UUID REFERENCES freights(id),
  driver_id UUID REFERENCES profiles(id),
  agreed_price NUMERIC,
  status TEXT,
  -- ... outros campos
);
```

### Fluxo de Status do Frete

```
CRIAÇÃO
   ↓
[OPEN] ← Estado inicial
   ↓ (motorista aceita)
[OPEN] ← Continua OPEN se ainda há vagas (accepted_trucks < required_trucks)
   ↓ (mais motoristas aceitam)
[OPEN] ← Ainda há vagas disponíveis
   ↓ (última vaga preenchida: accepted_trucks == required_trucks)
[ACCEPTED] ← Totalmente preenchido
   ↓
[LOADING] → [LOADED] → [IN_TRANSIT] → [DELIVERED]
```

### Triggers Críticos

#### 1. `sync_freight_accepted_trucks`
```sql
-- Executado após INSERT/DELETE em freight_assignments
-- Atualiza accepted_trucks e status do frete
-- REGRA: Status só muda para ACCEPTED quando totalmente preenchido
```

#### 2. `prevent_invalid_freight_status_changes`
```sql
-- IMPEDE mudanças de status inválidas
-- Exemplo: Não permite DELIVERED se accepted_trucks < required_trucks
```

#### 3. `log_freight_status_changes`
```sql
-- Registra todas as mudanças de status em audit_logs
-- Para rastreamento e debug
```

---

## 🔍 Funções RPC

### `get_compatible_freights_for_driver_v2(p_driver_id UUID)`

**Retorna fretes compatíveis incluindo parcialmente preenchidos:**

```sql
SELECT * FROM get_compatible_freights_for_driver_v2('uuid-do-motorista');
```

**Retorna:**
- Fretes com status `OPEN`
- Fretes com status `ACCEPTED`/`LOADING`/`LOADED`/`IN_TRANSIT` que ainda têm vagas
- Campos adicionais:
  - `available_slots`: Quantas vagas restam
  - `is_partial_booking`: TRUE se parcialmente preenchido

**Regras:**
- Não mostra fretes onde o motorista já aceitou
- Ordena por distância e data de criação

### `fix_freight_status_for_partial_bookings()`

**Corrige fretes com status errado:**

```sql
SELECT * FROM fix_freight_status_for_partial_bookings();
```

Volta para `OPEN` todos os fretes que:
- Têm status `ACCEPTED`/`LOADING`/`LOADED`/`IN_TRANSIT`
- Ainda têm vagas disponíveis (`accepted_trucks < required_trucks`)
- São de múltiplas carretas (`required_trucks > 1`)

---

## 🎨 Interface do Usuário

### FreightCard - Badge de Vagas

```tsx
{required_trucks > 1 && (
  <div className="flex items-center gap-2">
    {/* Badge principal */}
    <Badge variant="default" className="bg-green-500">
      <Truck /> 3/12 carretas
    </Badge>
    
    {/* Badge de vagas disponíveis (animado) */}
    <Badge variant="outline" className="text-green-600 animate-pulse">
      9 vagas!
    </Badge>
  </div>
)}
```

### SmartFreightMatcher

```tsx
const { data } = await supabase.rpc(
  'get_compatible_freights_for_driver_v2',
  { p_driver_id: profile.id }
);

// Data já vem com available_slots e is_partial_booking
freights.map(f => ({
  ...f,
  available_slots: f.available_slots,
  is_partial_booking: f.is_partial_booking
}));
```

---

## ⚠️ Regras Importantes

### 1. Status do Frete

- ✅ `OPEN`: Frete disponível, aceita motoristas
- ✅ `ACCEPTED`: Totalmente preenchido (accepted_trucks >= required_trucks)
- ❌ `LOADED`/`IN_TRANSIT` com vagas: **ERRO** - será corrigido automaticamente para `OPEN`

### 2. Aceitação de Motoristas

- ✅ Um motorista por assignment
- ✅ Motorista não pode aceitar o mesmo frete duas vezes
- ✅ Motorista pode cancelar e vaga volta a ficar disponível

### 3. Chat do Frete

- Produtor é sempre participante
- Cada motorista aceito é adicionado automaticamente
- Motorista vê apenas sua thread após aceitar

### 4. Pagamentos

- Cada motorista tem seu próprio `freight_assignment` com `agreed_price`
- Produtor pode negociar preços diferentes com cada motorista
- Pagamento é individual por assignment

---

## 🐛 Troubleshooting

### Problema: "Frete sumiu após 1 motorista aceitar"

**Causa:** Status mudou para `ACCEPTED` incorretamente

**Solução:**
```sql
SELECT * FROM fix_freight_status_for_partial_bookings();
```

### Problema: "Motorista não vê frete parcialmente preenchido"

**Causa:** Frontend usando RPC antiga

**Solução:** Verificar se está usando `get_compatible_freights_for_driver_v2`

### Problema: "Status não volta para OPEN quando motorista cancela"

**Causa:** Trigger não está funcionando

**Solução:** Verificar se trigger `sync_freight_accepted_trucks_trigger` existe

---

## 📊 Exemplos Práticos

### Exemplo 1: Frete de 12 Carretas

```
Produtor cria: required_trucks = 12
Status: OPEN

Motorista 1 aceita → accepted_trucks = 1, Status: OPEN (11 vagas)
Motorista 2 aceita → accepted_trucks = 2, Status: OPEN (10 vagas)
...
Motorista 11 aceita → accepted_trucks = 11, Status: OPEN (1 vaga)
Motorista 12 aceita → accepted_trucks = 12, Status: ACCEPTED (completo!)
```

### Exemplo 2: Motorista Desiste

```
Situação: 10/12 carretas aceitas, Status: OPEN

Motorista 5 cancela → accepted_trucks = 9, Status: OPEN (3 vagas)
Sistema mantém frete visível para novos motoristas
```

### Exemplo 3: Chat em Grupo

```
Frete com 5 carretas aceitas:
- Produtor (ID: A)
- Motorista 1 (ID: B)
- Motorista 2 (ID: C)
- Motorista 3 (ID: D)
- Motorista 4 (ID: E)
- Motorista 5 (ID: F)

Chat participants = [A, B, C, D, E, F]
Todos veem mensagens de todos
```

---

## 🔐 Segurança

### RLS Policies

- Motoristas só veem fretes compatíveis (via matches)
- Motoristas só aceitam fretes onde têm match
- Produtor vê todos os assignments do seu frete
- Admin vê tudo para suporte

### Auditoria

- Todas as mudanças de status são logadas em `audit_logs`
- Logs incluem: `required_trucks`, `accepted_trucks`, `old_status`, `new_status`
- Útil para debug e análise de problemas

---

## 🚀 Funcionalidades Futuras

- [ ] Notificação push quando frete está quase completo (11/12)
- [ ] Dashboard do produtor mostrando motoristas aceitos em tempo real
- [ ] Sistema de "reserva temporária" de vaga por 15 minutos
- [ ] Prioridade para motoristas com melhor rating
- [ ] Sugestão automática de preço por carreta baseado em ANTT

---

## 📞 Suporte

Se encontrar problemas:
1. Verificar logs em `audit_logs` tabela
2. Executar `fix_freight_status_for_partial_bookings()`
3. Verificar se triggers estão ativos
4. Contatar equipe de desenvolvimento

---

**Última atualização:** Janeiro 2025
**Versão do sistema:** 2.0
