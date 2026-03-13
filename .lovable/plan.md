

## Plano: Unificar Fluxo de Aceite de Cadastro para os 5 Tipos de Usuário

### Diagnóstico

Após análise completa do código, identifiquei que:

1. **Todos os 5 tipos já usam `CompleteProfile.tsx`** — o fluxo de UI é unificado
2. **O gate de retorno já funciona** — `routeAfterAuth` força `/complete-profile` se selfie ou documento estão ausentes
3. **Pinch-to-zoom já está configurado** — viewport meta tag com `user-scalable=yes, maximum-scale=3.0`

**O problema real está no `AutomaticApprovalService`**: PRODUTOR e TRANSPORTADORA têm um bypass que os aprova instantaneamente (sem passar por "documentos em análise"), enquanto PRESTADOR, MOTORISTA e MOTORISTA_AFILIADO passam pela validação completa.

### Mudanças necessárias

| Arquivo | Mudança |
|---|---|
| `src/components/AutomaticApproval.tsx` | Remover o bypass `isAutoApproveRole` para PRODUTOR e TRANSPORTADORA. Todos os 5 tipos passam pela mesma pipeline de validação (selfie + documento obrigatórios, score >= 0.5 para aprovação, senão "documentos em análise") |
| `src/pages/CompleteProfile.tsx` | Ajustar a mensagem de sucesso pós-finalização para ser uniforme: sempre mostrar "Seus documentos estão em análise" quando não aprovado automaticamente, e redirecionar para `/awaiting-approval` para TODOS os tipos (não apenas motoristas) |
| `src/lib/route-after-auth.ts` | Expandir o Gate 2: atualmente só motoristas autônomos não-aprovados vão para `/awaiting-approval`. Agora TODOS os tipos com status != APPROVED e documentos completos devem ir para `/awaiting-approval` |
| `src/pages/AwaitingApproval.tsx` | Ajustar textos para serem genéricos (não apenas "motorista"), já que agora todos os tipos podem ver essa tela |

### Detalhamento técnico

**1. AutomaticApproval.tsx — Remover bypass de auto-aprovação**

Eliminar o bloco `isAutoApproveRole` (linhas 82-155). PRODUTOR e TRANSPORTADORA passam pela mesma validação que PRESTADOR: verificar documentos obrigatórios (selfie + documento), calcular score, aprovar se >= 0.5 ou enviar para análise manual.

A aprovação automática continua funcionando para TODOS os tipos quando os documentos são válidos — a diferença é que não há mais "passe livre" sem validação.

**2. route-after-auth.ts — Gate universal para `/awaiting-approval`**

Alterar Gate 2 de:
```
if (role === 'MOTORISTA' && status !== 'APPROVED') → /awaiting-approval
```
Para:
```
if (status !== 'APPROVED' && documentos completos) → /awaiting-approval
```

Isso garante que qualquer usuário que completou o upload mas ainda não foi aprovado será direcionado à tela de espera.

**3. AwaitingApproval.tsx — Textos genéricos**

Remover a distinção `isDriver` nos textos. Usar mensagem genérica: "Seu cadastro está sendo analisado pela equipe AgriRoute."

**4. Pinch-to-zoom**

Já está configurado corretamente:
- `index.html`: `user-scalable=yes, maximum-scale=3.0`
- `AppDelegate.swift`: `maximumZoomScale = 3.0`
- `useDoubleTapResetZoom.ts`: reset de zoom por duplo toque

Não há mudança necessária aqui — o zoom por pinça já funciona em todas as telas.

### Resultado esperado

Após as mudanças, TODOS os 5 tipos de cadastro (PRODUTOR, TRANSPORTADORA, MOTORISTA_AUTONOMO, MOTORISTA_AFILIADO, PRESTADOR) terão exatamente o mesmo comportamento:

1. Preencher dados básicos → Enviar selfie + documento
2. Se validação OK → "Conta aprovada!" → Dashboard
3. Se validação falhar → "Documentos em análise" → Tela de aguardando aprovação
4. Se sair sem enviar fotos → Ao retornar, volta ao ponto exato do upload

