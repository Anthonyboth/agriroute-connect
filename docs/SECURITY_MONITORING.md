# Sistema de Monitoramento Automático de Segurança

## Visão Geral

Sistema automatizado de monitoramento que verifica periodicamente a integridade das roles de usuários e detecta potenciais problemas de segurança, enviando alertas em tempo real ao grupo de monitoramento no Telegram.

## Funcionalidades Implementadas

### 1. Edge Function: `monitor-suspicious-roles`

**Localização:** `supabase/functions/monitor-suspicious-roles/index.ts`

**Responsabilidades:**
- ✅ Verificar profiles com roles inválidas (fora do conjunto permitido)
- ✅ Detectar discrepâncias entre `profiles.role` e `user_roles`
- ✅ Gerar estatísticas de auditoria
- ✅ Enviar alertas detalhados ao Telegram
- ✅ Notificar erros críticos do próprio sistema de monitoramento

**Roles Válidas:**
```typescript
const VALID_ROLES = [
  'PRODUTOR',
  'MOTORISTA', 
  'PRESTADOR_SERVICOS',
  'TRANSPORTADORA',
  'MOTORISTA_AFILIADO'
];
```

**Importante:** `'ADMIN'` foi **removido** das roles válidas na Fase 1 do hardening de segurança.

### 2. Cron Job Automático

**Configuração:**
- **Nome:** `monitor-suspicious-roles-hourly`
- **Frequência:** A cada hora (no minuto 0)
- **Cron Expression:** `0 * * * *`
- **Função Executada:** `monitor-suspicious-roles`

**SQL de Configuração:**
```sql
SELECT cron.schedule(
  'monitor-suspicious-roles-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/monitor-suspicious-roles',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
```

## Tipos de Alertas

### 🚨 Alerta Crítico: Roles Suspeitas

**Quando é disparado:**
- Quando são detectados profiles com roles que não estão na lista de roles válidas

**Informações incluídas:**
- Email do usuário
- User ID (primeiros 12 caracteres)
- Role inválida detectada
- Data de criação do perfil
- Telefone (se disponível)

**Ações requeridas:**
- Investigar perfis listados
- Verificar logs de auditoria
- Corrigir ou remover perfis suspeitos

### ⚠️ Alerta Informativo: Conflitos Administrativos

**Quando é disparado:**
- Quando usuários possuem roles em `user_roles` (permissões administrativas)

**Informações incluídas:**
- Email do usuário
- User ID
- Role no perfil (`profiles.role`)
- Role administrativa (`user_roles.role`)

**Propósito:**
- Auditoria de permissões administrativas
- Verificação de consistência
- Rastreamento de usuários com privilégios elevados

**Nota:** Este alerta é **informativo**, não necessariamente indica um problema, mas permite auditoria constante.

### ✅ Relatório Regular: Resumo de Monitoramento

**Quando é disparado:**
- Sempre, a cada execução do cron job (mesmo que não haja problemas)

**Informações incluídas:**
- Total de perfis verificados
- Quantidade de perfis suspeitos
- Quantidade de conflitos detectados
- Quantidade de usuários com admin roles

**Propósito:**
- Confirmar que o sistema de monitoramento está ativo
- Prover visibilidade contínua do status de segurança
- Alertar caso o sistema pare de funcionar

## Integração com Telegram

### Configuração Necessária

**Variáveis de ambiente:**
```
TELEGRAM_BOT_TOKEN=<token-do-bot>
```

**Chat ID hardcoded:**
```typescript
const TELEGRAM_CHAT_ID = '-1003009756749'; // Grupo de monitoramento
```

### Formato das Mensagens

Todas as mensagens usam:
- **Parse Mode:** HTML
- **Disable Web Page Preview:** true
- **Emojis:** Para facilitar identificação visual rápida
- **Timestamp:** Timezone America/Cuiaba (Brasília)

## Testando o Sistema

### Teste Manual da Edge Function

Você pode testar manualmente a função fazendo uma requisição HTTP:

```bash
curl -X POST \
  https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/monitor-suspicious-roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -d '{"time": "2025-11-10T12:00:00Z"}'
```

### Verificar Execução do Cron Job

Para verificar se o cron job está funcionando, consulte os logs:

```sql
-- Ver jobs agendados
SELECT * FROM cron.job WHERE jobname = 'monitor-suspicious-roles-hourly';

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'monitor-suspicious-roles-hourly')
ORDER BY start_time DESC
LIMIT 10;
```

### Simular Profile Suspeito (Ambiente de Teste)

**⚠️ NÃO FAZER EM PRODUÇÃO!**

```sql
-- Criar profile com role inválida para teste
INSERT INTO profiles (user_id, email, role, phone)
VALUES (
  auth.uid(),
  'teste-suspeito@example.com',
  'INVALID_ROLE',
  '61999999999'
);

-- Executar monitoramento manualmente
-- Ou aguardar próxima execução do cron
```

## Segurança do Sistema de Monitoramento

### Proteções Implementadas

1. **Função usa Service Role Key** para acesso completo aos dados
2. **Sem autenticação na edge function** (executada via cron apenas)
3. **Logs detalhados** de todas as operações
4. **Tratamento robusto de erros** com notificação ao Telegram
5. **Rate limiting** implícito (máximo 1x por hora)

### Pontos de Atenção

- ⚠️ O sistema **não corrige automaticamente** roles suspeitas
- ⚠️ Alertas são informativos, ação manual é necessária
- ⚠️ Se o Telegram Bot Token estiver inválido, alertas serão perdidos
- ⚠️ Chat ID está hardcoded - mudanças requerem redeploy

## Manutenção

### Modificar Frequência do Cron

Para alterar a frequência de execução:

```sql
-- Remover job existente
SELECT cron.unschedule('monitor-suspicious-roles-hourly');

-- Criar novo job com frequência diferente
-- Exemplo: A cada 4 horas
SELECT cron.schedule(
  'monitor-suspicious-roles-4hours',
  '0 */4 * * *',
  $$ [mesmo conteúdo do SELECT net.http_post...] $$
);
```

### Desabilitar Temporariamente

```sql
SELECT cron.unschedule('monitor-suspicious-roles-hourly');
```

### Reabilitar

```sql
-- Re-executar o SQL de criação do cron job
```

## Logs e Troubleshooting

### Ver Logs da Edge Function

No Supabase Dashboard:
1. Ir em **Edge Functions**
2. Selecionar `monitor-suspicious-roles`
3. Visualizar **Logs**

### Problemas Comuns

**1. Mensagens não chegam no Telegram**
- Verificar se `TELEGRAM_BOT_TOKEN` está configurado
- Verificar se o bot está no grupo com Chat ID correto
- Verificar logs da edge function para erros de API

**2. Cron job não está executando**
- Verificar se `pg_cron` está habilitado
- Verificar se `pg_net` está habilitado
- Consultar `cron.job_run_details` para ver erros

**3. Muitos alertas falsos**
- Revisar a lista de `VALID_ROLES`
- Verificar se há dados legados com roles antigas
- Ajustar lógica de detecção se necessário

## Próximos Passos Sugeridos

1. **Dashboard de Monitoramento** - Criar interface web para visualizar histórico
2. **Correção Automática** - Implementar ações automáticas para roles inválidas comuns
3. **Notificações por Severidade** - Diferentes grupos Telegram para diferentes níveis
4. **Métricas Históricas** - Salvar estatísticas em tabela para análise temporal
5. **Alertas de Inatividade** - Notificar se o sistema não executar por 2+ horas

## Referências

- [Documentação Supabase Cron Jobs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Segurança de Roles - Fase 1](./SECURITY_DOCUMENTATION.md)
- [Sistema de Monitoramento de Erros](./ERROR_MONITORING_SETUP.md)
