
# Plano: Atualizar Horário de Funcionamento do Suporte

## Resumo
Alterar o horário de funcionamento do suporte de **"Seg-Sex: 8h-18h"** para **"Seg-Seg: 07h-19h"** em todos os locais onde aparece.

---

## Arquivos a Modificar

### 1. Centralizar Constante de Horário (Recomendado)
Adicionar constante em `src/lib/support-contact.ts` para facilitar futuras atualizações:

```typescript
export const SUPPORT_HOURS = 'Seg-Seg: 07h-19h';
```

### 2. Arquivos que Precisam Atualização

| Arquivo | Texto Atual | Novo Texto |
|---------|-------------|------------|
| `src/components/contact/ContactSupportModal.tsx` (linha 214) | `Seg-Sex: 8h-18h` | `Seg-Seg: 07h-19h` |
| `src/components/OLD_ContactModal.tsx` (linha 84) | `Seg-Sex: 8h-18h` | `Seg-Seg: 07h-19h` |
| `src/components/ForgotPasswordModal.tsx` (linha 60) | `Seg-Sex: 8h-18h \| Sáb: 8h-12h` | `Seg-Seg: 07h-19h` |
| `src/pages/Help.tsx` (linha 134) | `Seg-Sex: 8h-18h` | `Seg-Seg: 07h-19h` |

---

## Detalhes Técnicos

### Passo 1: Atualizar `src/lib/support-contact.ts`
```typescript
// Adicionar nova constante
export const SUPPORT_HOURS = 'Seg-Seg: 07h-19h';
```

### Passo 2: Atualizar `ContactSupportModal.tsx`
Importar e usar a constante centralizada.

### Passo 3: Atualizar `ForgotPasswordModal.tsx`
Remover menção ao sábado e usar o novo horário unificado.

### Passo 4: Atualizar `Help.tsx`
Atualizar o campo `available` do card de WhatsApp.

### Passo 5: Atualizar `OLD_ContactModal.tsx`
Mesmo tratamento para manter consistência (arquivo legado).

---

## Resultado Esperado
Todos os locais que exibem horário de atendimento mostrarão: **Seg-Seg: 07h-19h**
