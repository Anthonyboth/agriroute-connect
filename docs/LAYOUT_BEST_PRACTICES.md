# Boas Práticas de Layout - Anti-Sobreposição

Este documento descreve as boas práticas e ferramentas disponíveis para evitar sobreposição de elementos na interface.

## Problema

Elementos posicionados absolutamente (como botões de fechar em Dialogs) podem sobrepor conteúdo importante, tornando-o ilegível ou não-clicável.

## Solução

Implementamos um sistema centralizado de z-index e utilitários de layout para prevenir sobreposições.

---

## 1. Sistema de Z-Index

### Usar Z-Index Centralizado

**❌ ERRADO:**
```tsx
<div className="absolute z-[100]">...</div>
<div className="absolute z-[110]">...</div>
```

**✅ CORRETO:**
```tsx
import { zIndexClasses } from '@/lib/z-index-manager';

<div className={zIndexClasses.dialog}>...</div>
<div className={zIndexClasses.dialogClose}>...</div>
```

### Hierarquia de Z-Index

```
Base (0) 
  ↓
Dropdown (1000)
  ↓
Modal (1050)
  ↓
Dialog (1060)
  ↓
Dialog Close Button (1065) ← Sempre acima do conteúdo
  ↓
Alert Dialog (1070)
  ↓
Sheet (1080)
  ↓
Toast (1090)
  ↓
Popover (1100)
  ↓
Notification (1110)
```

---

## 2. Posicionamento Seguro

### SafePositionedElement Component

Use o componente `SafePositionedElement` para elementos que precisam ser posicionados absolutamente:

```tsx
import { SafePositionedElement } from '@/components/ui/safe-positioned-element';

<SafePositionedElement position="top-right" zIndex="dialogClose">
  <Button onClick={onClose}>
    <X className="h-4 w-4" />
  </Button>
</SafePositionedElement>
```

### Posições Disponíveis
- `top-right`
- `top-left`
- `bottom-right`
- `bottom-left`
- `center-top`
- `center-bottom`

---

## 3. Layout Utilitários

### Headers com Botões de Fechar

**❌ ERRADO:**
```tsx
<DialogHeader>
  <DialogTitle>Título</DialogTitle>
</DialogHeader>
```

**✅ CORRETO:**
```tsx
import { layoutSafe } from '@/lib/layout-utils';

<DialogHeader className={layoutSafe.dialogHeader}>
  <DialogTitle>Título</DialogTitle>
</DialogHeader>
```

### Containers com Botões Absolutamente Posicionados

```tsx
import { containerPadding } from '@/lib/layout-utils';

<div className={containerPadding.withTopRightButton}>
  {/* Conteúdo não será sobreposto pelo botão */}
</div>
```

---

## 4. Checklist para Novos Componentes

Antes de criar um componente com posicionamento absoluto:

- [ ] Usei `SafePositionedElement` ou utilitários de `layout-utils.ts`?
- [ ] Usei valores de z-index do `z-index-manager.ts`?
- [ ] Adicionei padding adequado no container pai?
- [ ] O botão tem área clicável mínima de 2.5rem (40px)?
- [ ] Testei em diferentes tamanhos de tela?
- [ ] Testei com conteúdo longo (texto que pode quebrar)?

---

## 5. Componentes Críticos

### Dialog
```tsx
// O DialogContent já tem padding adequado
// O botão de fechar usa SafePositionedElement internamente
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título com espaço para botão de fechar</DialogTitle>
    </DialogHeader>
    <DialogDescription>
      Conteúdo não será sobreposto
    </DialogDescription>
  </DialogContent>
</Dialog>
```

### AlertDialog
```tsx
// Mesmo padrão do Dialog
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Título</AlertDialogTitle>
    </AlertDialogHeader>
  </AlertDialogContent>
</AlertDialog>
```

### Sheet
```tsx
// O SheetContent já tem padding adequado
<Sheet>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Título</SheetTitle>
    </SheetHeader>
  </SheetContent>
</Sheet>
```

---

## 6. Classes CSS Úteis

### Prevenir Overflow de Texto
```tsx
import { preventTextOverlap } from '@/lib/layout-utils';

<p className={preventTextOverlap}>
  Texto longo que não vai sobrepor outros elementos
</p>
```

### Área Clicável Segura para Botões
```tsx
import { buttonSafeArea } from '@/lib/layout-utils';

<button className={buttonSafeArea}>
  Botão com área clicável adequada
</button>
```

---

## 7. Debugging

### Como identificar sobreposições

1. **Inspecionar z-index:**
   - Abra DevTools
   - Inspecione o elemento
   - Verifique o valor de z-index
   - Compare com a hierarquia esperada

2. **Visualizar layers:**
   ```css
   /* Adicione temporariamente ao elemento */
   outline: 2px solid red;
   outline-offset: 2px;
   ```

3. **Testar responsividade:**
   - Redimensione a janela
   - Teste em dispositivos móveis
   - Verifique se o padding é mantido

---

## 8. Padrões Comuns

### Modal com Botão de Fechar
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    {/* Botão de fechar já está incluído e posicionado corretamente */}
    <DialogHeader>
      <DialogTitle>Meu Modal</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      {/* Conteúdo */}
    </div>
  </DialogContent>
</Dialog>
```

### Card com Ações Absolutamente Posicionadas
```tsx
import { Card } from '@/components/ui/card';
import { containerPadding } from '@/lib/layout-utils';
import { SafePositionedElement } from '@/components/ui/safe-positioned-element';

<Card className="relative">
  <SafePositionedElement position="top-right">
    <Button variant="ghost" size="sm">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </SafePositionedElement>
  
  <div className={containerPadding.withTopRightButton}>
    {/* Conteúdo com padding adequado */}
  </div>
</Card>
```

---

## 9. Migração de Código Existente

### Encontrar componentes com problemas
```bash
# Buscar posicionamento absoluto sem z-index gerenciado
grep -r "absolute.*top-.*right-" src/components/
```

### Padrão de migração
1. Identificar elemento com posicionamento absoluto
2. Envolver com `SafePositionedElement` ou usar utilitários
3. Adicionar padding adequado no container pai
4. Testar visualmente

---

## 10. Referência Rápida

| Situação | Solução |
|----------|---------|
| Botão de fechar em Dialog | Já corrigido no componente base |
| Botão de ação em Card | `SafePositionedElement` |
| Menu dropdown | `zIndexClasses.dropdown` |
| Tooltip | `zIndexClasses.tooltip` |
| Toast notification | `zIndexClasses.toast` |
| Overlay customizado | `zIndexClasses.overlay` |

---

## Dúvidas?

Se encontrar uma situação não coberta por este guia:
1. Verifique os componentes base em `src/components/ui/`
2. Consulte `src/lib/layout-utils.ts` para utilitários disponíveis
3. Consulte `src/lib/z-index-manager.ts` para z-index adequado

**Regra de ouro:** Sempre que usar `position: absolute`, pense em z-index e padding do container pai!
