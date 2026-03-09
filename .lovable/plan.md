

## Diagnóstico

Dois falsos positivos do Monitor Bot — ambos são **validações de formulário**, não erros reais:

1. **Auth.tsx linha 210**: Usa `toast.error()` para validação de senha → capturado pelo patch de `toast.error` no `usePanelErrorTelegramReporter.ts`
2. **CompleteProfile.tsx linha 342**: Usa `toast()` corretamente, mas o stack mostra que ainda está sendo reportado — provavelmente via outro mecanismo de captura (console.error ou similar)

**Resposta à pergunta: SIM, precisa de novo build** — estas correções são no código frontend (React), não no banco de dados.

---

## Plano de Correção

### 1. `src/pages/Auth.tsx` (linha 210)
Trocar `toast.error()` por `toast()` com `id` único (regra FRT-042):
```typescript
toast(`Erro de validação: ${validation.errors.join(', ')}`, { id: 'signup-validation' });
```

### 2. `src/hooks/useFormState.ts` (linhas 257-261)
Trocar `variant: 'destructive'` por toast neutro:
```typescript
toast('Erro de validação: Por favor, corrija os erros no formulário', { id: 'form-validation' });
```

### 3. `src/hooks/usePanelErrorTelegramReporter.ts` (IGNORED_PATTERNS)
Adicionar padrões de validação comuns para evitar futuros falsos positivos:
- `'Erro de validação'`
- `'Por favor, envie'`
- `'Por favor, corrija'`

### 4. `src/hooks/useRegressionShield.ts`
Registrar como **FRT-045**: toast.error e variant destructive usados para validação de formulário gerando falso positivo no Monitor Bot.

