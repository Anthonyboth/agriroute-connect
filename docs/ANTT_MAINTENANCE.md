# Manutenção de Preços ANTT - Guia do Administrador

## 📋 Visão Geral

Este documento detalha o processo de manutenção e recálculo em lote dos preços mínimos ANTT (Agência Nacional de Transportes Terrestres) para fretes cadastrados no sistema.

## 🎯 Objetivo

O sistema de recálculo ANTT permite atualizar automaticamente o `minimum_antt_price` de fretes antigos que não possuem este valor calculado, garantindo conformidade com a Lei 13.703/2018.

## 🔧 Como Usar a Interface de Manutenção

### Acesso

1. Faça login como **ADMIN**
2. Acesse o **Painel Administrativo** (`/admin`)
3. No menu lateral, vá em **Sistema > Manutenção de Dados**
4. Localize o card **"Recálculo de Preços ANTT"**

### Interface

A interface exibe:

- **Badge de Contagem**: Número de fretes sem ANTT calculado
- **Estatísticas Atuais**:
  - Fretes sem ANTT
  - Tamanho do lote (até 500)
  - Rate limit (1x por hora)
- **Última Execução**:
  - Data/hora da última execução
  - Fretes atualizados com sucesso
  - Falhas ocorridas
  - Tempo de execução
- **Botão de Ação**: "Recalcular Todos os Fretes"

### Executando o Recálculo

1. Clique no botão **"Recalcular Todos os Fretes"**
2. O sistema irá:
   - Processar até 500 fretes por vez
   - Calcular o ANTT para cada frete tipo CARGA
   - Atualizar automaticamente o banco de dados
   - Registrar a execução no histórico
3. Aguarde a notificação de conclusão
4. Verifique o resultado na notificação (sucesso, erros, ignorados)

## 📊 Logs e Histórico

### Tabela de Histórico (`antt_recalculation_history`)

Toda execução é registrada com:

- **executed_by**: UUID do admin que executou
- **executed_at**: Timestamp da execução
- **freights_processed**: Total de fretes processados
- **freights_updated**: Fretes atualizados com sucesso
- **freights_failed**: Fretes que falharam
- **freights_skipped**: Fretes ignorados (já tinham ANTT)
- **execution_time_ms**: Tempo total de execução
- **details**: Detalhes adicionais (JSON)
- **error_messages**: Lista de erros encontrados (JSON)

### Consultando o Histórico

```sql
SELECT 
  executed_at,
  freights_processed,
  freights_updated,
  freights_failed,
  execution_time_ms / 1000.0 as execution_time_seconds
FROM antt_recalculation_history
ORDER BY executed_at DESC
LIMIT 10;
```

## ⚙️ Como Funciona

### Edge Function: `recalculate-all-antt-freights`

**Endpoint**: `POST /functions/v1/recalculate-all-antt-freights`

**Processo**:
1. Verifica autenticação e role ADMIN
2. Aplica rate limit (1x por hora)
3. Busca até 500 fretes tipo CARGA sem ANTT
4. Para cada frete:
   - Determina categoria ANTT do cargo
   - Calcula table_type (A/B/C/D) baseado em:
     - `high_performance`
     - `vehicle_ownership`
   - Busca taxas na tabela `antt_rates`
   - Calcula: `(rate_per_km × distance) + fixed_charge`
   - Atualiza `minimum_antt_price` no frete
5. Registra resultado no histórico
6. Retorna estatísticas

**Resposta de Sucesso**:
```json
{
  "success": true,
  "total": 120,
  "updated": 115,
  "failed": 2,
  "skipped": 3,
  "execution_time_ms": 4532,
  "errors": [
    {
      "freight_id": "uuid...",
      "error": "Taxa ANTT não encontrada"
    }
  ]
}
```

## 🚨 Rate Limits e Restrições

### Rate Limit

- **Limite**: 1 execução por hora
- **Por usuário**: Não (global para o endpoint)
- **Controle**: Via RPC `check_rate_limit`

Se exceder:
```
❌ Limite de taxa excedido
Você pode executar esta operação apenas 1x por hora. 
Aguarde e tente novamente.
```

### Restrições de Acesso

- Apenas usuários com role **ADMIN** podem executar
- Autenticação via JWT obrigatória
- Logs de auditoria são gerados automaticamente

## 🔄 Processo de Recálculo em Massa

### Se tiver > 500 fretes sem ANTT:

1. **1ª Execução**: Processa 500 fretes
2. **Aguardar 1 hora**
3. **2ª Execução**: Processa próximos 500
4. Repetir até zerar

### Exemplo com 1.200 fretes:

- **Execução 1** (t=0h): 500 fretes ✅
- **Execução 2** (t=1h): 500 fretes ✅
- **Execução 3** (t=2h): 200 fretes ✅
- **Total**: 3 horas

## 🛡️ Segurança

### Validações Implementadas

1. ✅ Autenticação JWT obrigatória
2. ✅ Verificação de role ADMIN
3. ✅ Rate limiting por hora
4. ✅ Auditoria de todas execuções
5. ✅ Logs detalhados de erros
6. ✅ Retry logic (até 3 tentativas por frete)

### Políticas RLS

```sql
-- Admins podem ver histórico
CREATE POLICY "Admins can view recalculation history"
ON antt_recalculation_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE user_id = auth.uid() AND role = 'ADMIN'
));

-- Sistema pode inserir histórico
CREATE POLICY "System can insert recalculation history"
ON antt_recalculation_history FOR INSERT
WITH CHECK (true);
```

## 📈 Monitoramento

### Métricas Importantes

1. **Taxa de Sucesso**: `freights_updated / freights_processed`
2. **Taxa de Falha**: `freights_failed / freights_processed`
3. **Tempo Médio**: `execution_time_ms / freights_processed`

### Query de Monitoramento

```sql
SELECT 
  DATE(executed_at) as date,
  COUNT(*) as executions,
  SUM(freights_processed) as total_processed,
  SUM(freights_updated) as total_updated,
  SUM(freights_failed) as total_failed,
  AVG(execution_time_ms / 1000.0) as avg_time_seconds
FROM antt_recalculation_history
WHERE executed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(executed_at)
ORDER BY date DESC;
```

## 🐛 Troubleshooting

### Erro: "Taxa ANTT não encontrada"

**Causa**: Combinação de cargo_category + table_type + axles não existe em `antt_rates`

**Solução**:
1. Verificar se tabela `antt_rates` está atualizada
2. Verificar se todos os tipos de carga mapeados existem
3. Fallback para 'Carga Geral' está implementado

### Erro: "Rate limit exceeded"

**Causa**: Tentativa de executar antes de 1 hora desde última execução

**Solução**: Aguardar até completar 1 hora

### Erro: "Unauthorized"

**Causa**: Usuário não é ADMIN ou JWT inválido

**Solução**: 
1. Verificar role do usuário
2. Fazer logout e login novamente

### Erro: "Timeout"

**Causa**: Muitos fretes para processar (edge function timeout)

**Solução**: Aumentar timeout da edge function ou reduzir batch size

## 📚 Referências

- [Lei 13.703/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13703.htm)
- [Resolução ANTT nº 5.867/2021](https://www.antt.gov.br/resolucoes/2021/Resolucao5867_2021.html)
- [Documentação ANTT](./ANTT_CALCULATION.md)

## 💬 Suporte

Para problemas ou dúvidas:

- **Email**: suporte@agriroute.com.br
- **Telefone**: (65) 3322-1234
- **Horário**: Segunda a Sexta, 8h às 18h

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0  
**Autor**: Equipe Agriroute
