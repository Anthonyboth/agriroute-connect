# Playbook de Resposta a Incidentes — AgriRoute Connect

**Última atualização:** 02/12/2025  
**Versão:** 1.0.0

## 1. Visão Geral

Este documento descreve os procedimentos para resposta a incidentes de segurança no AgriRoute Connect.

## 2. Classificação de Incidentes

### Severidade

| Nível | Descrição | Tempo de Resposta |
|-------|-----------|-------------------|
| 🔴 CRITICAL | Impacto severo, dados comprometidos | Imediato (< 15 min) |
| 🟠 HIGH | Impacto significativo, risco elevado | < 1 hora |
| 🟡 MEDIUM | Impacto moderado, monitoramento | < 4 horas |
| 🟢 LOW | Baixo impacto, análise posterior | < 24 horas |

## 3. Playbooks por Tipo de Incidente

---

### 3.1. 🔐 LEAK DE CREDENCIAIS

**Severidade**: CRITICAL  
**Tempo de Resposta**: Imediato

#### Detecção
- Alerta do sistema de monitoramento
- Notificação de ferramenta externa (GitGuardian, etc.)
- Relato de usuário

#### Resposta Imediata (< 15 min)
1. **Confirmar** o vazamento
2. **Identificar** credenciais afetadas
3. **Revogar** tokens/sessões imediatamente
   ```sql
   -- Via Supabase Admin
   SELECT auth.admin.sign_out(user_id, 'global');
   ```
4. **Rotacionar** segredos comprometidos
5. **Notificar** Telegram + E-mail DPO

#### Ações de Contenção (< 1 hora)
1. Bloquear IP de origem (se identificado)
2. Forçar reset de senha para usuários afetados
3. Revisar logs de acesso
4. Documentar timeline do incidente

#### Ações de Recuperação
1. Gerar novas credenciais
2. Atualizar em todos os ambientes
3. Re-deploy de funções afetadas
4. Validar funcionamento

#### Pós-Incidente
1. Registrar incidente completo
2. Análise de causa raiz
3. Implementar prevenções
4. Comunicar stakeholders

---

### 3.2. 🔨 ATAQUE DE BRUTE FORCE

**Severidade**: HIGH  
**Tempo de Resposta**: < 1 hora

#### Detecção
- `monitor-suspicious-logins` detecta padrão
- Alta taxa de falhas de login
- Múltiplas tentativas do mesmo IP

#### Resposta Automática (Sistema)
```javascript
// Executado automaticamente
await blockIP(ip, 'Brute force detectado', 30);
await invalidateUserSessions(targetUserId);
```

#### Ações Manuais
1. Verificar se IP já foi bloqueado automaticamente
2. Analisar logs para identificar alvos
3. Estender bloqueio se necessário:
   ```sql
   UPDATE security_blacklist 
   SET expires_at = NOW() + INTERVAL '24 hours',
       reason = 'Ataque persistente'
   WHERE ip_address = 'x.x.x.x';
   ```
4. Notificar usuários-alvo sobre tentativas

#### Investigação
1. Identificar origem do ataque
2. Verificar se houve sucesso
3. Revisar políticas de senha
4. Considerar implementar CAPTCHA

---

### 3.3. ⚡ EXCESSO DE RATE LIMIT

**Severidade**: MEDIUM  
**Tempo de Resposta**: < 4 horas

#### Detecção
- Múltiplas entradas em `rate_limit_violations`
- Alerta do sistema

#### Resposta Automática
```javascript
// Aplicado progressivamente
1ª violação: Throttle para 10 req/min
5ª violação: Bloqueio de IP por 60 min
```

#### Análise
1. Verificar se é uso legítimo ou abuso
2. Identificar endpoints afetados
3. Ajustar limites se necessário

#### Ações
- **Se abuso**: Manter bloqueio, investigar origem
- **Se legítimo**: Ajustar rate limits, whitelist se necessário

---

### 3.4. 🚫 ACESSO NÃO AUTORIZADO

**Severidade**: HIGH  
**Tempo de Resposta**: < 1 hora

#### Detecção
- Tentativa de acessar rota sem permissão
- RLS bloqueou operação
- Log em `access_denied_logs`

#### Resposta Imediata
1. Bloquear IP de origem
2. Invalidar sessão do usuário
3. Revisar últimas ações do usuário

#### Investigação
1. Verificar se foi erro de configuração ou ataque
2. Revisar políticas RLS
3. Analisar padrão de tentativas

---

### 3.5. 💾 FALHA DE BACKUP

**Severidade**: HIGH  
**Tempo de Resposta**: < 1 hora

#### Detecção
- Alerta do sistema de monitoramento
- Verificação manual falhou

#### Ações Imediatas
1. Identificar causa da falha
2. Executar backup manual
3. Verificar integridade do último backup válido

#### Recuperação
1. Resolver problema de infraestrutura
2. Reativar backups automáticos
3. Testar restore em ambiente de staging

---

### 3.6. 📈 ALTA TAXA DE ERROS

**Severidade**: MEDIUM → HIGH (se persistir)  
**Tempo de Resposta**: < 4 horas

#### Detecção
- `continuous-security-monitor` detecta >10 erros/hora
- Dashboard mostra spike

#### Investigação
1. Identificar tipo de erro predominante
2. Verificar se há deploy recente
3. Analisar logs de erro

#### Ações
- **Se deploy recente**: Considerar rollback
- **Se problema externo**: Verificar APIs de terceiros
- **Se ataque**: Escalar para resposta de segurança

---

## 4. Comunicação

### Canais por Severidade

| Severidade | Telegram | Email DPO | Email Usuários |
|------------|----------|-----------|----------------|
| CRITICAL | ✅ Imediato | ✅ Imediato | Se dados comprometidos |
| HIGH | ✅ Imediato | ✅ 1 hora | Se afetados |
| MEDIUM | ✅ Relatório | ❌ | ❌ |
| LOW | ❌ | ❌ | ❌ |

### Templates de Comunicação

#### Para Telegram (CRITICAL)
```
🚨 INCIDENTE CRÍTICO - AgriRoute

📌 Tipo: [TIPO DO INCIDENTE]
⏰ Detectado: [TIMESTAMP]
📍 Origem: [IP/USUÁRIO]

🔧 Ações em andamento:
• [Ação 1]
• [Ação 2]

👤 Responsável: [NOME]
📞 Contato: [TELEFONE]
```

#### Para Usuários Afetados
```
Prezado(a) [NOME],

Identificamos uma atividade de segurança incomum em sua conta no AgriRoute.

Por precaução, invalidamos sua sessão atual. Por favor:
1. Faça login novamente
2. Redefina sua senha
3. Verifique suas últimas atividades

Se você não reconhecer alguma atividade, entre em contato conosco imediatamente.

Atenciosamente,
Equipe AgriRoute Connect
```

## 5. Documentação de Incidente

### Template de Registro

```markdown
# Incidente #[NÚMERO]

## Resumo
- **Data/Hora**: [TIMESTAMP]
- **Severidade**: [CRITICAL/HIGH/MEDIUM/LOW]
- **Tipo**: [TIPO]
- **Status**: [ABERTO/EM ANÁLISE/RESOLVIDO]

## Timeline
| Hora | Evento |
|------|--------|
| HH:MM | Incidente detectado |
| HH:MM | Resposta iniciada |
| HH:MM | Contenção aplicada |
| HH:MM | Resolvido |

## Impacto
- Usuários afetados: [NÚMERO]
- Dados comprometidos: [SIM/NÃO]
- Tempo de indisponibilidade: [DURAÇÃO]

## Ações Tomadas
1. [Ação 1]
2. [Ação 2]

## Causa Raiz
[Descrição]

## Prevenção Futura
- [Medida 1]
- [Medida 2]

## Lições Aprendidas
[Descrição]
```

## 6. Contatos de Emergência

| Função | Nome | Contato |
|--------|------|---------|
| DPO | Equipe AgriRoute | agrirouteconnect@gmail.com |
| Suporte | WhatsApp | +55 (66) 9 9273-4632 |
| Telegram Admin | Grupo de Monitoramento | [Link do grupo] |

---

**Documento mantido por**: Equipe AgriRoute Connect  
**Próxima revisão**: Março/2026
