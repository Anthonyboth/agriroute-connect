
# Corrigir Nomenclatura: "Serviço" para "Frete Urbano" nos Painéis de Motorista e Transportadora

## Problema

No painel do motorista e transportadora, os cards de fretes urbanos (PET, Pacotes, Guincho, Mudanca, etc.) estao exibindo:
- Titulo: **"Servico"** (fallback generico errado)
- Subtitulo: **"Solicitacao #..."** (deveria ser "Frete #...")

A regra e clara: no painel do motorista/transportadora = **FRETE**. "Servico" so deve aparecer no painel do prestador de servicos.

## Arquivos a Corrigir

### 1. `src/components/SmartFreightMatcher.tsx` (Painel do Motorista)
- **Linha 868**: Trocar fallback `"Servico"` para `"Frete Urbano"`
- **Linha 870**: Trocar `"Solicitacao #"` para `"Frete #"`
- Garantir que cada tipo exiba seu nome correto como titulo do card (Guincho, Frete Moto, Mudanca, Transporte de Pet, Entrega de Pacotes, Frete Urbano)

### 2. `src/components/CompanySmartFreightMatcher.tsx` (Painel da Transportadora)
- **Linha 325**: Trocar fallback `"Servico"` para `"Frete Urbano"`
- **Linha 587**: Trocar `"Solicitacao #"` para `"Frete #"`

### 3. `src/components/driver-details/DriverFreightsTab.tsx` (Detalhes do Motorista)
- **Linha 91**: Trocar fallback `"Servico"` para `"Frete Urbano"` (ou usar o `serviceType` formatado)
- **Linhas 356, 440**: Trocar `"Solicitacao #"` para `"Frete #"`

### 4. `src/components/ServiceRequestInProgressCard.tsx` (Card em Andamento)
- Verificar se e usado no contexto de motorista/transportadora e garantir que nao exiba "Servico"

## O que NAO sera alterado
- Painel do Prestador de Servicos (la SIM e "Servico")
- `MyRequestsTab.tsx` (solicitacoes do cliente - usa "Solicitacao" corretamente)
- Banco de dados, Edge Functions, nenhuma tabela

## Resumo das Trocas

| Local | Antes | Depois |
|-------|-------|--------|
| Titulo fallback (motorista/transportadora) | "Servico" | "Frete Urbano" |
| Subtitulo (motorista/transportadora) | "Solicitacao #xxx" | "Frete #xxx" |
| Painel prestador | "Servico" (mantido) | Sem alteracao |

Total: **3 arquivos**, mudancas cirurgicas apenas em labels de texto.
