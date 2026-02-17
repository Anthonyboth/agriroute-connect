

## Problema: Toasts duplicados ao desativar rastreamento durante frete ativo

### Causa raiz identificada

No arquivo `UnifiedTrackingControl.tsx`, a funcao `confirmStopWithPenalty()` chama `executeStopTracking()` na linha 175 e depois exibe seu proprio toast na linha 176. Porem, `executeStopTracking()` ja exibe um toast proprio (`toast.info('Rastreamento pausado')`) na linha 157.

Resultado: **dois toasts aparecem ao mesmo tempo**:
1. "Rastreamento pausado" (de `executeStopTracking`)
2. "Incidente registrado: rastreamento desativado durante frete ativo" (de `confirmStopWithPenalty`)

### Correcao

Modificar `executeStopTracking()` para aceitar um parametro opcional `silent` que suprime o toast quando chamado por `confirmStopWithPenalty`. Assim, apenas o toast de incidente (mais relevante) sera exibido.

### Detalhes tecnicos

**Arquivo: `src/components/UnifiedTrackingControl.tsx`**

1. Alterar a assinatura de `executeStopTracking` para `executeStopTracking(silent?: boolean)`
2. Condicionar o `toast.info('Rastreamento pausado')` a `!silent`
3. Em `confirmStopWithPenalty`, chamar `executeStopTracking(true)` para suprimir o toast redundante

Isso elimina a duplicidade sem alterar o comportamento quando o motorista pausa o rastreamento normalmente (sem frete ativo).

