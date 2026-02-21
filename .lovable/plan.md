

## Problema Identificado

Existem **dois problemas** interligados:

### 1. Transporte Pet aparecendo na aba errada do historico

A aba "Fretes Urbanos" no historico do motorista usa o componente `ServiceHistoryFromDB`, que **exclui explicitamente** os tipos `TRANSPORTE_PET` e `ENTREGA_PACOTES` da consulta. Esses tipos deveriam aparecer justamente nessa aba, mas estao sendo filtrados. Quando o motorista executa um transporte de Pet, o registro pode acabar aparecendo na aba "Fretes Rurais" por estar vinculado ao `freight_history`.

### 2. Relatorios nao contam fretes urbanos executados pelo motorista

A RPC `get_reports_dashboard` (painel MOTORISTA) calcula KPIs como viagens concluidas, km total, ticket medio, etc. **apenas a partir da tabela `freight_assignment_history`** (fretes rurais). Os fretes urbanos (PET, Pacotes, Guincho) que o motorista executou, registrados em `service_request_history`, sao contabilizados **somente na receita total** (`v_servicos_receita`), mas **nao contam** como viagens, nao aparecem nos graficos de receita por mes, nem nas top rotas.

---

## Plano de Correcao

### Etapa 1 — Historico: Mostrar fretes urbanos na aba correta

**Arquivo:** `src/hooks/useServiceHistory.ts`

- Criar uma logica condicional: quando o motorista esta na aba "Fretes Urbanos", incluir os tipos `TRANSPORTE_PET` e `ENTREGA_PACOTES` (em vez de excluir).
- Adicionar um parametro `includeTransportTypes` ao hook para controlar o filtro.

**Arquivo:** `src/pages/driver/DriverHistoryTab.tsx`

- A aba "Fretes Urbanos" deve usar `ServiceHistoryFromDB` com um prop que inclua os tipos de transporte urbano.
- Opcionalmente, criar uma query dedicada para fretes urbanos executados pelo motorista (onde `provider_id = profile.id` e `service_type IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')`).

**Arquivo:** `src/hooks/useFreightHistory.ts`

- Remover os registros de transporte (PET/Pacotes) da aba "Fretes Rurais" para evitar duplicacao. O `transportHistoryQuery` filtra por `client_id`, entao so aparece quando o motorista SOLICITOU o servico — verificar se ha registros em `freight_history` para esses tipos e filtra-los.

### Etapa 2 — Relatorios: Contar TODOS os fretes executados

**Migracao SQL:** Nova versao da RPC `get_reports_dashboard` (painel MOTORISTA)

Alteracoes na RPC:
- **Viagens concluidas**: somar os fretes urbanos concluidos de `service_request_history` (onde `provider_id = p_profile_id` e `service_type IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')`) ao total de `v_viagens_concluidas`.
- **Receita por mes**: unir dados de `freight_assignment_history` com `service_request_history` para que os graficos mostrem a receita consolidada (rural + urbano).
- **Top rotas**: incluir rotas de fretes urbanos (origem/destino de `service_request_history`) quando disponiveis.
- **Cancelamentos**: incluir cancelamentos de fretes urbanos no calculo de `v_cancelamentos` e `v_total_assignments`.

### Etapa 3 — Ajustes visuais no Historico

**Arquivo:** `src/components/history/ServiceHistoryFromDB.tsx`

- Quando exibir fretes urbanos (PET, Pacotes), usar icone de `Truck` (conforme regra de nomenclatura) em vez de `Wrench`.
- Garantir que o titulo do card use o nome correto do tipo (ex: "Transporte Pet", "Entrega de Pacotes").

---

## Detalhes Tecnicos

### Arquivos modificados:
1. `src/hooks/useServiceHistory.ts` — adicionar modo "urban transport" que inclui PET/Pacotes/Guincho
2. `src/pages/driver/DriverHistoryTab.tsx` — passar props corretos para aba "Fretes Urbanos"
3. `src/hooks/useFreightHistory.ts` — evitar duplicacao de transportes na aba rural
4. `src/components/history/ServiceHistoryFromDB.tsx` — ajustar icones para fretes urbanos
5. Nova migracao SQL — atualizar RPC `get_reports_dashboard` para contar fretes urbanos

### Regras de negocio respeitadas:
- Nomenclatura: "Frete Urbano" (nunca "Servico") nos paineis de motorista
- Icone de Truck para fretes, Wrench para servicos tecnicos
- PET e Pacotes sao tratados como fretes nos relatorios (conforme memoria do sistema)

