# Testes E2E - AGRIROUTE

Testes End-to-End usando Playwright para validar fluxos críticos da aplicação.

## 🎯 Objetivo

Garantir que funcionalidades críticas estejam funcionando corretamente em ambiente de produção-like, validando:
- Fluxos de usuário completos
- Integrações com Supabase
- Comportamento da UI
- Regras de negócio

## 📋 Testes Implementados

### 1. `company-smart-freights.spec.ts` - Fretes I.A para Transportadora

Valida que a aba "Fretes I.A" (CompanySmartFreightMatcher) exibe apenas fretes disponíveis e com status válido.

**Cenários testados:**
- ✅ Não exibe fretes com status `CANCELLED`
- ✅ Não exibe fretes com status `DELIVERED`, `IN_TRANSIT`, `LOADING`, `LOADED`
- ✅ Todos os fretes exibidos têm slots disponíveis (`accepted_trucks < required_trucks`)
- ✅ Filtro de busca funciona corretamente
- ✅ Filtro de tipo de carga funciona corretamente
- ✅ Botão de atualizar recarrega a lista
- ✅ Estatísticas são exibidas corretamente
- ✅ Toggle "Somente disponíveis" não existe mais (foi removido)
- ✅ Query Supabase não usa comparação de colunas inválida

**Pré-requisitos:**
- Usuário `transportadora@test.com` com senha `senha123` cadastrado
- Pelo menos um frete disponível no banco (status `OPEN`, `ACCEPTED` ou `IN_NEGOTIATION`)

### 2. `freight-proposals-flow.spec.ts` - Fluxo de Propostas

Testa o ciclo completo de propostas de frete:
- Motorista envia proposta
- Produtor visualiza proposta
- Produtor aceita/rejeita proposta

### 3. `freight-delivery-rating.spec.ts` - Avaliação de Entregas

Testa o sistema de avaliação após entrega de fretes.

## 🚀 Como Rodar os Testes

### Instalação

```bash
# Instalar dependências (se ainda não instalou)
npm install
```

### Rodar Todos os Testes

```bash
# Rodar todos os testes E2E
npm run test:e2e

# Ou usar o comando direto do Playwright
npx playwright test
```

### Rodar Teste Específico

```bash
# Rodar apenas testes de Fretes I.A
npx playwright test company-smart-freights

# Rodar apenas um teste específico
npx playwright test company-smart-freights -g "Não exibe fretes com status CANCELLED"
```

### Modo Debug (UI Mode)

```bash
# Abrir interface visual do Playwright
npx playwright test --ui

# Modo debug com pausas
npx playwright test --debug
```

### Rodar em um Navegador Específico

```bash
# Apenas Chrome
npx playwright test --project=chromium

# Apenas Firefox
npx playwright test --project=firefox

# Apenas Safari
npx playwright test --project=webkit
```

## 📊 Relatórios

Após rodar os testes, um relatório HTML é gerado automaticamente:

```bash
# Ver relatório do último teste
npx playwright show-report
```

O relatório inclui:
- Screenshots de falhas
- Vídeos das execuções
- Traces para debug
- Logs detalhados

## 🔧 Configuração

A configuração dos testes está em `playwright.config.ts`:

```typescript
- baseURL: http://localhost:5173
- Locale: pt-BR
- Timezone: America/Sao_Paulo
- Retries: 2 (em CI/CD)
- Screenshots: Apenas em falhas
- Vídeos: Apenas em falhas
```

## 🎭 Atributos de Teste (data-testid)

Os componentes usam `data-testid` para facilitar a localização em testes:

### CompanySmartFreightMatcher
- `search-freights-input` - Input de busca
- `cargo-type-filter` - Select de tipo de carga
- `refresh-freights-button` - Botão de atualizar
- `matching-stats` - Container de estatísticas
- `freight-card` - Card individual de frete

### FreightCard
- `freight-card` - Card principal
- `freight-status-badge` - Badge de status do frete
- `send-proposal-button` - Botão de enviar proposta
- `accept-freight-button` - Botão de aceitar frete

## 🐛 Debug de Testes

### Ver logs no console

```bash
# Rodar com logs detalhados
DEBUG=pw:api npx playwright test
```

### Pausar em uma linha específica

```typescript
await page.pause(); // Pausa o teste nesta linha
```

### Capturar screenshots manualmente

```typescript
await page.screenshot({ path: 'debug-screenshot.png' });
```

## 📝 Boas Práticas

1. **Sempre use `data-testid`** para localizar elementos críticos
2. **Evite depender de classes CSS** ou texto que pode mudar
3. **Use `waitForTimeout` com moderação** - prefira `waitForSelector`
4. **Teste em múltiplos navegadores** para garantir compatibilidade
5. **Mantenha testes independentes** - cada teste deve funcionar sozinho
6. **Use `beforeEach`** para setup comum entre testes
7. **Valide textos em português** conforme configuração do locale

## 🔄 CI/CD

Os testes rodam automaticamente em:
- Pull Requests
- Merges na branch main
- Deploys de produção

Configuração no `.github/workflows/playwright.yml`

## 📚 Recursos

- [Documentação Playwright](https://playwright.dev/)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)

## ⚠️ Troubleshooting

### Teste falha com "element not found"

```bash
# Aumentar timeout
await page.waitForSelector('[data-testid="element"]', { timeout: 10000 });
```

### Teste falha intermitentemente

```bash
# Adicionar retry
test.describe.configure({ retries: 2 });
```

### App não inicia no `webServer`

```bash
# Verificar se porta 5173 está livre
lsof -ti:5173 | xargs kill -9

# Rodar app manualmente em outro terminal
npm run dev
```

## 📞 Contato

Para dúvidas ou problemas com testes E2E, contate a equipe de QA.
