# Sistema de Painéis e Capacidades

## Visão Geral

O sistema de painéis e capacidades é o **núcleo centralizado** que define permissões e restrições de acesso em todo o aplicativo. Ele garante consistência entre os 5 painéis principais e elimina lógica duplicada.

## Os 5 Painéis

### 1. ADMIN
- **Rota**: `/admin`
- **Role**: `ADMIN`
- **Capacidades**: Todas permitidas (acesso irrestrito)

### 2. PRODUTOR
- **Rota**: `/dashboard/producer`
- **Role**: `PRODUTOR`
- **Capacidades**:
  - ✅ Criar fretes
  - ✅ Editar/cancelar próprios fretes
  - ✅ Aceitar propostas de motoristas
  - ✅ Avaliar motoristas
  - ✅ Chat

### 3. DRIVER (Motorista)
- **Rota**: `/dashboard/driver`
- **Roles**: `MOTORISTA`, `MOTORISTA_AFILIADO`
- **Capacidades** (depende de vínculo):
  
  **Motorista Autônomo** (sem vínculo com empresa):
  - ✅ Ver fretes da plataforma
  - ✅ Enviar propostas para fretes
  - ✅ Gerenciar veículos próprios
  - ✅ Check-in/Saque (com frete ativo)
  - ✅ Chat

  **Motorista de Empresa COM permissão** (`can_accept_freights = true`):
  - ✅ Ver fretes da plataforma
  - ✅ Ver fretes da empresa
  - ❌ Enviar propostas (deve compartilhar com transportadora)
  - ✅ Gerenciar veículos (se `can_manage_vehicles = true`)
  - ✅ Check-in/Saque (com frete ativo)
  - ✅ Chat

  **Motorista de Empresa SEM permissão** (`can_accept_freights = false`):
  - ❌ Ver fretes da plataforma
  - ✅ Ver fretes da empresa
  - ❌ Enviar propostas
  - ❌ Gerenciar veículos próprios (afiliado)
  - ✅ Check-in/Saque (com frete ativo)
  - ✅ Chat

### 4. SERVICE_PROVIDER (Prestador de Serviços)
- **Rota**: `/dashboard/service-provider`
- **Role**: `PRESTADOR_SERVICOS`
- **Capacidades**:
  - ✅ Ver solicitações de serviços
  - ✅ Enviar propostas de serviços
  - ✅ Concluir serviços (com solicitação ativa)
  - ✅ Chat

### 5. COMPANY (Transportadora)
- **Rota**: `/dashboard/company`
- **Role**: `TRANSPORTADORA` ou `active_mode = 'TRANSPORTADORA'`
- **Capacidades**:
  - ✅ Gerenciar fretes da empresa
  - ✅ Atribuir motoristas
  - ✅ Ver/aprovar motoristas da empresa
  - ✅ Gerenciar frota de veículos
  - ✅ Aprovar afiliações
  - ✅ Avaliar motoristas
  - ✅ Chat

## Arquitetura

### Arquivos Núcleo

1. **`src/lib/permission-messages.ts`**
   - Única fonte de verdade para mensagens de restrição
   - Todas as mensagens em PT-BR padronizadas

2. **`src/lib/panel-capabilities.ts`**
   - Tipos: `PanelKey`, `ActionKey`, `CapabilityDecision`
   - Funções:
     - `resolvePanelFromRoute()`: Identifica painel pela rota
     - `getDefaultDashboardForRole()`: Rota padrão por role
     - `computePanelCapabilities()`: Calcula todas as permissões
     - `hasCapability()`: Verifica se tem permissão
     - `getRestrictionReason()`: Obtém motivo da restrição

3. **`src/hooks/usePanelCapabilities.ts`**
   - Hook React para uso em componentes
   - Retorna: `panel`, `capabilities`, `can()`, `reason()`

### Fluxo de Decisão

```
┌─────────────────────┐
│ Rota atual + Profile│
│ + CompanyDriver     │
│ + DriverPermissions │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────┐
│ resolvePanelFromRoute│
└──────────┬───────────┘
           │
           ▼
┌────────────────────────┐
│ computePanelCapabilities│
└──────────┬─────────────┘
           │
           ▼
┌────────────────┐
│ Componente/Modal│
└────┬───────────┘
     │
     ├─► can('action') = true  ──► ✅ Executa ação
     │
     └─► can('action') = false ──► ❌ Exibe reason()
```

## Uso em Componentes

### Exemplo Básico

```tsx
import { usePanelCapabilities } from '@/hooks/usePanelCapabilities';

const MyComponent = () => {
  const { can, reason } = usePanelCapabilities();

  const handleAction = () => {
    if (!can('submit_freight_proposal')) {
      toast.error(reason('submit_freight_proposal'));
      return;
    }
    
    // Executar ação...
  };

  return (
    <Button 
      onClick={handleAction}
      disabled={!can('submit_freight_proposal')}
    >
      Enviar Proposta
    </Button>
  );
};
```

### Com Contexto Adicional

```tsx
const { can, reason } = usePanelCapabilities({
  context: {
    hasActiveAssignment: !!activeFreight,
    freightStatus: freight?.status,
    hasANTTPrice: freight?.minimum_antt_price > 0,
  }
});
```

## Actions Disponíveis

### Driver Actions
- `view_platform_freights` - Ver fretes da plataforma
- `view_company_freights` - Ver fretes da empresa
- `submit_freight_proposal` - Enviar proposta de frete
- `submit_service_proposal` - Enviar proposta de serviço
- `manage_own_vehicles` - Gerenciar veículos próprios
- `checkin` - Fazer check-in
- `withdraw` - Fazer saque
- `chat` - Usar chat

### Producer Actions
- `create_freight` - Criar frete
- `edit_own_freight` - Editar próprio frete
- `cancel_own_freight` - Cancelar frete
- `accept_driver_proposal` - Aceitar proposta
- `rate_driver` - Avaliar motorista

### Company Actions
- `manage_company_freights` - Gerenciar fretes da empresa
- `assign_driver` - Atribuir motorista
- `see_company_drivers` - Ver motoristas
- `manage_company_vehicles` - Gerenciar frota
- `approve_affiliation` - Aprovar afiliação
- `rate_company_driver` - Avaliar motorista

### Service Provider Actions
- `view_service_requests` - Ver solicitações
- `submit_service_proposal_sp` - Enviar proposta
- `complete_service` - Concluir serviço
- `service_chat` - Chat de serviços

### Common Actions
- `view_antt_breakdown` - Ver breakdown ANTT
- `receive_notifications` - Receber notificações

## Regra Crítica: Propostas de Motoristas

**ÚNICA REGRA:**
- ✅ **Motorista autônomo** (sem vínculo com empresa): PODE enviar propostas
- ❌ **Motorista afiliado/empregado** (com vínculo): NÃO PODE enviar propostas

**Mensagem padronizada:**
> "Apenas motorista autônomo pode enviar proposta. Se você é filiado/empregado, compartilhe com sua transportadora."

## Segurança

⚠️ **IMPORTANTE**: Este sistema padroniza a **UX** (experiência do usuário). A segurança real vem de:
- **RLS (Row Level Security)** no Supabase
- **RPCs autenticados** com validações backend
- Este sistema apenas garante consistência de mensagens e UX

## Testes

Executar testes automatizados:
```bash
npm run test tests/panel-capabilities.test.ts
```

Casos cobertos:
- ✅ Motorista autônomo vs afiliado (propostas)
- ✅ Motorista com/sem `can_accept_freights`
- ✅ Permissões de veículos
- ✅ Permissões de empresa
- ✅ Permissões de produtor
- ✅ Mensagens de restrição corretas

## Manutenção

### Adicionar Nova Ação

1. Adicionar em `ActionKey` (panel-capabilities.ts)
2. Adicionar mensagem em `PERMISSION_MESSAGES` (se bloqueável)
3. Adicionar lógica em `computePanelCapabilities()`
4. Atualizar documentação
5. Adicionar teste

### Adicionar Nova Mensagem

1. Adicionar em `permission-messages.ts`
2. Usar na lógica de `computePanelCapabilities()`
3. Documentar uso

## Componentes Refatorados

Componentes que já usam o sistema centralizado:
- ✅ `ProposalModal.tsx`
- ✅ `ServiceProposalModal.tsx`
- ✅ `VehicleManager.tsx`
- 🔄 `DriverDashboard.tsx` (em andamento)
- 🔄 `CompanyDashboard.tsx` (em andamento)
- 🔄 `ProducerDashboard.tsx` (em andamento)
- 🔄 `ServiceProviderDashboard.tsx` (em andamento)

## Próximos Passos

1. Refatorar dashboards principais para usar `usePanelCapabilities`
2. Adicionar Tooltips em botões desabilitados
3. Padronizar redirecionamentos em `App.tsx`
4. Expandir testes de integração
