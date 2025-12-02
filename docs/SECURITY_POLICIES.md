# Políticas de Segurança — AgriRoute Connect

**Última atualização:** 02/12/2025  
**Versão:** 1.0.0

## 1. Visão Geral

Este documento estabelece as políticas de segurança implementadas no AgriRoute Connect, incluindo controles técnicos, procedimentos operacionais e diretrizes para resposta a incidentes.

## 2. Arquitetura de Segurança

### 2.1. Camadas de Proteção

```
┌─────────────────────────────────────────────┐
│            CAMADA DE APLICAÇÃO              │
│  - Input validation                         │
│  - Output encoding                          │
│  - Session management                       │
├─────────────────────────────────────────────┤
│            CAMADA DE AUTENTICAÇÃO           │
│  - JWT tokens (Supabase Auth)               │
│  - MFA (quando aplicável)                   │
│  - Rate limiting                            │
├─────────────────────────────────────────────┤
│            CAMADA DE AUTORIZAÇÃO            │
│  - Row Level Security (RLS)                 │
│  - Role-based access control                │
│  - Policy enforcement                       │
├─────────────────────────────────────────────┤
│            CAMADA DE DADOS                  │
│  - Encryption at rest                       │
│  - Encryption in transit (TLS 1.2+)         │
│  - Backup & recovery                        │
└─────────────────────────────────────────────┘
```

### 2.2. Componentes de Segurança

| Componente | Descrição | Status |
|------------|-----------|--------|
| RLS Policies | Controle de acesso a nível de linha | ✅ Ativo |
| JWT Authentication | Tokens com expiração de 1 hora | ✅ Ativo |
| Rate Limiting | Limitação de requisições por IP/usuário | ✅ Ativo |
| Audit Logging | Registro de todas as operações sensíveis | ✅ Ativo |
| Security Blacklist | Bloqueio de IPs maliciosos | ✅ Ativo |
| Telegram Alerts | Notificações em tempo real | ✅ Ativo |
| Auto-Response | Respostas automáticas a incidentes | ✅ Ativo |

## 3. Controle de Acesso

### 3.1. Roles do Sistema

#### Roles de Negócio (profiles.role)
- `PRODUTOR` - Produtores rurais
- `MOTORISTA` - Motoristas autônomos
- `PRESTADOR_SERVICOS` - Prestadores de serviço
- `TRANSPORTADORA` - Empresas de transporte
- `MOTORISTA_AFILIADO` - Motoristas vinculados a transportadoras

#### Roles Administrativas (user_roles.role)
- `admin` - Acesso total ao sistema
- `moderator` - Acesso moderado para suporte

### 3.2. Princípio do Menor Privilégio

Todos os usuários recebem apenas as permissões mínimas necessárias para realizar suas funções. As políticas RLS garantem que:

- Usuários só podem ver seus próprios dados
- Operações sensíveis requerem verificação de role
- Dados financeiros são isolados por usuário/empresa

## 4. Monitoramento e Alertas

### 4.1. Edge Functions de Segurança

| Função | Frequência | Descrição |
|--------|------------|-----------|
| `continuous-security-monitor` | Horária | Verificação de saúde do sistema |
| `monitor-suspicious-logins` | 30 min | Detecção de logins suspeitos |
| `monitor-suspicious-roles` | Horária | Verificação de roles inválidos |
| `security-health-check` | Diária | Health check completo |
| `daily-security-report` | 8h (Cuiabá) | Relatório diário consolidado |

### 4.2. Tipos de Alertas

#### 🔴 CRITICAL
- Leak de credenciais detectado
- Múltiplas tentativas de brute force
- Perfis com roles inválidos
- Falha em backup crítico

#### 🟠 HIGH
- Alta taxa de erros (>5%)
- Múltiplas violações de rate limit
- Acesso não autorizado detectado
- Sessões anômalas

#### 🟡 MEDIUM
- Tentativas de login falhas excessivas
- Atividade admin incomum
- Padrões de uso suspeitos

#### 🟢 LOW
- Informações de rotina
- Métricas de performance
- Relatórios periódicos

### 4.3. Canais de Notificação

- **Telegram**: Alertas CRITICAL e HIGH em tempo real
- **Dashboard**: Todos os alertas visíveis no painel admin
- **Logs**: Registro completo para auditoria

## 5. Resposta a Incidentes

### 5.1. Respostas Automáticas

| Incidente | Resposta Automática |
|-----------|---------------------|
| Brute Force | Bloqueio de IP (30 min) + Invalidação de sessões |
| Rate Limit Exceeded | Throttle progressivo → Bloqueio (60 min após 5 violações) |
| Sessão Suspeita | Forçar re-autenticação |
| Credential Leak | Invalidação imediata + Reset de senha obrigatório |
| Acesso Não Autorizado | Bloqueio de IP (60 min) |

### 5.2. Escalation

1. **Nível 1**: Resposta automática executada
2. **Nível 2**: Alerta enviado ao Telegram
3. **Nível 3**: Análise manual requerida
4. **Nível 4**: Escalation para CTO/DPO

## 6. Gestão de Segredos

### 6.1. Armazenamento

Todos os segredos são armazenados no Supabase Secrets:
- `TELEGRAM_BOT_TOKEN`
- `STRIPE_SECRET_KEY`
- `GOOGLE_MAPS_API_KEY`
- Outras chaves de API

### 6.2. Rotação

- **Frequência recomendada**: 90 dias
- **Procedimento**: Atualizar no painel Supabase → Deploy das funções
- **Logging**: Registrar rotação no audit_logs

## 7. Backup e Recuperação

### 7.1. Backups Automáticos

- **Frequência**: Diária (Supabase Pro)
- **Retenção**: 30 dias
- **Tipo**: Point-in-time recovery

### 7.2. Teste de Restore

- **Frequência**: Trimestral
- **Documentação**: Registrar resultados

## 8. Conformidade LGPD

### 8.1. Princípios Implementados

- ✅ Finalidade específica para cada dado coletado
- ✅ Necessidade mínima de dados
- ✅ Transparência sobre uso de dados
- ✅ Segurança técnica e administrativa
- ✅ Prevenção contra vazamentos

### 8.2. Direitos do Titular

O sistema suporta exercício dos direitos:
- Acesso aos dados
- Correção de informações
- Exclusão (quando permitido)
- Portabilidade
- Revogação de consentimento

### 8.3. DPO (Encarregado)

- **Responsável**: Equipe AgriRoute Connect
- **E-mail**: agrirouteconnect@gmail.com
- **WhatsApp**: +55 (66) 9 9273-4632

## 9. Auditoria

### 9.1. Logs Retidos

| Tipo | Retenção |
|------|----------|
| Audit Logs | 90 dias |
| Error Logs | 30 dias |
| Security Events | 180 dias |
| Access Logs | 30 dias |

### 9.2. Campos Auditados

- ID do usuário
- Operação realizada
- Dados antigos/novos
- IP de origem
- User agent
- Timestamp

## 10. Manutenção

### 10.1. Atualizações de Segurança

- Monitorar vulnerabilidades em dependências
- Aplicar patches críticos em 24h
- Patches não-críticos: dentro de 7 dias

### 10.2. Revisão de Políticas

- **Frequência**: Trimestral
- **Responsável**: Equipe de desenvolvimento

---

**Documento mantido por**: Equipe AgriRoute Connect  
**Próxima revisão**: Março/2026
