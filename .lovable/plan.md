

## Corrigir numero de contato errado em 5 arquivos e remover caixa branca do tooltip

### Problema 1: Numero de WhatsApp errado
O numero `9942-6656` (errado) aparece em 5 arquivos. O numero correto do suporte e `(66) 9 9273-4632`.

**Arquivos com numero errado:**
1. `src/pages/Terms.tsx` (linha 234) - `015 66 9 9942-6656`
2. `src/pages/Privacy.tsx` (linha 290) - `+55 15 66 9 9942-6656`
3. `src/pages/Status.tsx` (linha 339) - `015 66 9 9942-6656`
4. `src/pages/Cookies.tsx` (linha 297) - `015 66 9 9942-6656`
5. `src/components/LegalDocumentDialog.tsx` (linha 155) - `+55 15 66 9 9942-6656`

**Correcao:** Substituir todos por `(66) 9 9273-4632`.

---

### Problema 2: Caixa branca com icone azul ao selecionar texto
O `FloatingSupportButton` envolve o botao com um Radix `Tooltip`. Em dispositivos touch (Android), tooltips podem ativar involuntariamente ao tocar na tela para selecionar texto, renderizando como uma caixa branca vazia.

**Correcao:** Remover o wrapper `TooltipProvider`/`Tooltip`/`TooltipTrigger`/`TooltipContent` do `FloatingSupportButton.tsx`. Em dispositivos moveis nao existe hover, entao tooltip nao tem utilidade. O botao continuara funcionando normalmente (abre WhatsApp ao clicar, pode ser arrastado).

---

### Detalhes tecnicos

**Arquivo 1 - `src/pages/Terms.tsx`:**
- Linha 234: trocar `015 66 9 9942-6656` por `(66) 9 9273-4632`

**Arquivo 2 - `src/pages/Privacy.tsx`:**
- Linha 290: trocar `+55 15 66 9 9942-6656` por `(66) 9 9273-4632`

**Arquivo 3 - `src/pages/Status.tsx`:**
- Linha 339: trocar `015 66 9 9942-6656` por `(66) 9 9273-4632`

**Arquivo 4 - `src/pages/Cookies.tsx`:**
- Linha 297: trocar `015 66 9 9942-6656` por `(66) 9 9273-4632`

**Arquivo 5 - `src/components/LegalDocumentDialog.tsx`:**
- Linha 155: trocar `+55 15 66 9 9942-6656` por `(66) 9 9273-4632`

**Arquivo 6 - `src/components/FloatingSupportButton.tsx`:**
- Remover imports de Tooltip (TooltipProvider, Tooltip, TooltipTrigger, TooltipContent)
- Remover wrapper Tooltip ao redor do botao `<a>`
- Manter toda a logica de drag, click e posicionamento intacta

