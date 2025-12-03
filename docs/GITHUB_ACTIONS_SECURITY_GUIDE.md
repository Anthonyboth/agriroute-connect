# Guia: GitHub Actions com SAST/SCA para AgriRoute

**Data:** 02/12/2025  
**AgriRoute Connect**

Este guia detalha como configurar pipelines de segurança automatizados usando GitHub Actions para detectar vulnerabilidades de código (SAST) e dependências (SCA).

---

## 1. Visão Geral

### Ferramentas Utilizadas
- **Semgrep** - SAST (Static Application Security Testing)
- **Snyk** - SCA (Software Composition Analysis) + SAST
- **TruffleHog** - Secret Scanning

### Benefícios
- Detecção automática de vulnerabilidades em PRs
- Bloqueio de merge para issues críticas
- Alertas para a equipe via Telegram
- Histórico de segurança no GitHub Security tab

---

## 2. Configuração de Secrets no GitHub

Navegue para: **Settings → Secrets and variables → Actions**

Adicione os seguintes secrets:

| Secret | Descrição | Obtenção |
|--------|-----------|----------|
| `SNYK_TOKEN` | Token da API Snyk | https://app.snyk.io/account |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram | @BotFather |
| `TELEGRAM_CHAT_ID` | ID do chat para alertas | @userinfobot |

---

## 3. Workflow Completo

Crie o arquivo `.github/workflows/security-ci.yml`:

```yaml
name: Security CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    # Scan diário às 6h UTC (3h Brasília)
    - cron: '0 6 * * *'

permissions:
  contents: read
  security-events: write
  pull-requests: write

jobs:
  # ==========================================
  # JOB 1: Semgrep SAST
  # ==========================================
  semgrep:
    name: Semgrep SAST Scan
    runs-on: ubuntu-latest
    container:
      image: returntocorp/semgrep
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run Semgrep
        run: |
          semgrep ci \
            --config=auto \
            --config=p/security-audit \
            --config=p/secrets \
            --config=p/typescript \
            --config=p/react \
            --sarif --output=semgrep-results.sarif \
            --json --output=semgrep-results.json
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
      
      - name: Upload SARIF to GitHub
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: semgrep-results.sarif
        if: always()
      
      - name: Check for critical findings
        run: |
          CRITICAL=$(cat semgrep-results.json | jq '[.results[] | select(.extra.severity == "ERROR")] | length')
          if [ "$CRITICAL" -gt 0 ]; then
            echo "::error::Found $CRITICAL critical security issues!"
            exit 1
          fi

  # ==========================================
  # JOB 2: Snyk Dependency Scan
  # ==========================================
  snyk:
    name: Snyk SCA Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --sarif-file-output=snyk.sarif
      
      - name: Upload Snyk SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: snyk.sarif
        if: always()
      
      - name: Run Snyk Code (SAST)
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: code test
          args: --severity-threshold=high

  # ==========================================
  # JOB 3: TruffleHog Secret Scanning
  # ==========================================
  trufflehog:
    name: TruffleHog Secret Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified --json
      
      - name: Check for secrets
        run: |
          if [ -f "trufflehog-results.json" ]; then
            SECRETS=$(cat trufflehog-results.json | jq '. | length')
            if [ "$SECRETS" -gt 0 ]; then
              echo "::error::Found $SECRETS verified secrets in code!"
              exit 1
            fi
          fi

  # ==========================================
  # JOB 4: Notify on Failure
  # ==========================================
  notify:
    name: Notify Security Team
    runs-on: ubuntu-latest
    needs: [semgrep, snyk, trufflehog]
    if: failure()
    
    steps:
      - name: Send Telegram Alert
        run: |
          curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
            -d chat_id="${{ secrets.TELEGRAM_CHAT_ID }}" \
            -d parse_mode="HTML" \
            -d text="🚨 <b>ALERTA DE SEGURANÇA</b>

          <b>Repositório:</b> ${{ github.repository }}
          <b>Branch:</b> ${{ github.ref_name }}
          <b>Commit:</b> ${{ github.sha }}
          <b>Autor:</b> ${{ github.actor }}

          ❌ Pipeline de segurança falhou!

          Verifique: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"

  # ==========================================
  # JOB 5: Weekly Full Scan
  # ==========================================
  weekly-report:
    name: Weekly Security Report
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    needs: [semgrep, snyk, trufflehog]
    
    steps:
      - name: Generate Report
        run: |
          echo "# Weekly Security Report" > report.md
          echo "Date: $(date)" >> report.md
          echo "" >> report.md
          echo "## Summary" >> report.md
          echo "- Semgrep: ${{ needs.semgrep.result }}" >> report.md
          echo "- Snyk: ${{ needs.snyk.result }}" >> report.md
          echo "- TruffleHog: ${{ needs.trufflehog.result }}" >> report.md
      
      - name: Send Weekly Report
        run: |
          curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
            -d chat_id="${{ secrets.TELEGRAM_CHAT_ID }}" \
            -d parse_mode="HTML" \
            -d text="📊 <b>Relatório Semanal de Segurança</b>

          <b>Repositório:</b> ${{ github.repository }}
          <b>Data:</b> $(date +'%d/%m/%Y')

          ✅ Semgrep: ${{ needs.semgrep.result }}
          ✅ Snyk: ${{ needs.snyk.result }}
          ✅ TruffleHog: ${{ needs.trufflehog.result }}

          Dashboard: ${{ github.server_url }}/${{ github.repository }}/security"
```

---

## 4. Configuração do Semgrep

### 4.1 Criar arquivo de configuração

Crie `.semgrep.yml` na raiz do projeto:

```yaml
rules:
  # Detectar SQL Injection em queries Supabase
  - id: supabase-sql-injection
    patterns:
      - pattern: supabase.rpc($FUNC, { query: $USER_INPUT })
    message: "Possível SQL injection via RPC"
    severity: ERROR
    languages: [typescript, javascript]
  
  # Detectar secrets hardcoded
  - id: hardcoded-api-key
    patterns:
      - pattern-regex: "(api_key|apikey|secret|password)\s*[:=]\s*['\"][^'\"]{20,}['\"]"
    message: "Possível API key ou secret hardcoded"
    severity: ERROR
    languages: [typescript, javascript]
  
  # Detectar uso inseguro de localStorage
  - id: insecure-localstorage
    patterns:
      - pattern: localStorage.setItem("token", ...)
      - pattern: localStorage.setItem("jwt", ...)
      - pattern: localStorage.setItem("session", ...)
    message: "Armazenamento inseguro de tokens em localStorage"
    severity: WARNING
    languages: [typescript, javascript]
  
  # Detectar console.log em produção
  - id: no-console-in-production
    patterns:
      - pattern: console.log(...)
    paths:
      exclude:
        - "**/test/**"
        - "**/*.test.*"
    message: "console.log deve ser removido em produção"
    severity: WARNING
    languages: [typescript, javascript]
```

---

## 5. Configuração do Snyk

### 5.1 Criar arquivo de política

Crie `.snyk` na raiz do projeto:

```yaml
# Snyk policy file
version: v1.25.0

# Ignorar vulnerabilidades específicas (com justificativa)
ignore:
  # Exemplo: ignorar CVE específica por 30 dias
  # SNYK-JS-EXAMPLE-12345:
  #   - '*':
  #       reason: "Não aplicável ao nosso uso"
  #       expires: 2025-01-01T00:00:00.000Z

# Configurações de severidade
patch: {}

# Excluir diretórios
exclude:
  global:
    - node_modules
    - dist
    - build
    - .next
```

### 5.2 Obter Token Snyk

1. Acesse https://app.snyk.io/
2. Faça login com GitHub
3. Vá em **Account Settings**
4. Copie o **Auth Token**
5. Adicione como secret `SNYK_TOKEN` no GitHub

---

## 6. Configuração do TruffleHog

### 6.1 Criar arquivo de configuração

Crie `.trufflehog.yml`:

```yaml
# TruffleHog config
detectors:
  - AWS
  - Azure
  - GCP
  - Stripe
  - GitHub
  - Slack
  - Twilio
  - SendGrid
  - Telegram

# Excluir falsos positivos
exclude_paths:
  - node_modules/
  - .git/
  - "*.test.ts"
  - "*.spec.ts"
  - "__mocks__/"
  - "docs/"

# Apenas verificar segredos ativos
only_verified: true
```

---

## 7. Badges de Status

Adicione ao `README.md`:

```markdown
## Security Status

[![Semgrep](https://github.com/seu-usuario/agriroute-connect/actions/workflows/security-ci.yml/badge.svg)](https://github.com/seu-usuario/agriroute-connect/actions/workflows/security-ci.yml)

[![Known Vulnerabilities](https://snyk.io/test/github/seu-usuario/agriroute-connect/badge.svg)](https://snyk.io/test/github/seu-usuario/agriroute-connect)
```

---

## 8. Integração com PRs

### Branch Protection Rules

Configure em **Settings → Branches → Branch protection rules**:

1. **Require status checks to pass:**
   - `Semgrep SAST Scan`
   - `Snyk SCA Scan`
   - `TruffleHog Secret Scan`

2. **Require branches to be up to date**

3. **Require review from code owners**

---

## 9. Alertas Personalizados

### Níveis de Severidade

| Nível | Ação | Notificação |
|-------|------|-------------|
| Critical | Bloqueia PR | Telegram + Email |
| High | Bloqueia PR | Telegram |
| Medium | Warning | GitHub only |
| Low | Info | Log only |

### Exemplo de Alerta Telegram

```
🚨 ALERTA DE SEGURANÇA

Repositório: AgriRoute/agriroute-connect
Branch: feature/new-feature
Commit: abc1234

❌ Encontrados 2 problemas críticos:

1. SQL Injection em src/api/users.ts:45
2. Secret exposto em src/config.ts:12

Ação: PR bloqueado até correção

🔗 Ver detalhes: [link]
```

---

## 10. Manutenção

### Tarefas Semanais
- [ ] Revisar alertas do GitHub Security tab
- [ ] Atualizar dependências com vulnerabilidades
- [ ] Verificar falsos positivos e ajustar regras

### Tarefas Mensais
- [ ] Atualizar regras do Semgrep
- [ ] Revisar políticas do Snyk
- [ ] Auditar secrets ignorados
- [ ] Gerar relatório de tendências

---

## 11. Troubleshooting

### Semgrep muito lento
```yaml
# Adicionar ao workflow
env:
  SEMGREP_TIMEOUT: 300
  SEMGREP_MAX_MEMORY: 4096
```

### Snyk não encontra package.json
```yaml
# Especificar caminho
with:
  args: --file=./package.json
```

### TruffleHog falsos positivos
```yaml
# Adicionar ao .trufflehog.yml
exclude_patterns:
  - "test_api_key_example"
```

---

## 12. Recursos Adicionais

- [Semgrep Rules Registry](https://semgrep.dev/explore)
- [Snyk Vulnerability DB](https://snyk.io/vuln)
- [TruffleHog Detectors](https://github.com/trufflesecurity/trufflehog)
- [OWASP Top 10](https://owasp.org/Top10/)

---

*Guia mantido pela equipe de segurança AgriRoute Connect*
