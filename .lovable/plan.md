
# Reduzir botoes do Hero e mostrar mais a imagem de fundo

## Problema

Na tela mobile, os botoes do Hero ocupam `w-full` (largura total), empilhando verticalmente como blocos brancos enormes que cobrem quase toda a imagem de fundo. O resultado e que a foto (que sera enviada por usuarios) fica praticamente invisivel.

## Solucao

Duas alteracoes simples e coordenadas:

### 1. `src/components/ui/hero-action-button.tsx`
- Trocar `w-full sm:w-auto` por `w-auto` -- os botoes ficam compactos (tamanho do texto) em todas as telas
- Reduzir altura de `h-9` para `h-8` e padding de `px-4` para `px-3`
- Manter `text-xs`, icone `h-4 w-4`, `rounded-full` e todos os efeitos visuais

### 2. `src/pages/driver/DriverDashboardHero.tsx`
- Trocar o layout dos botoes de `flex flex-wrap gap-3` para `flex flex-wrap gap-2` (menos espaco entre eles)
- Adicionar `py-4` ao container dos botoes para dar respiro vertical sem desperdicar espaco
- Manter `min-h-[160px]` na section e o overlay verde (`bg-gradient-to-b from-primary/40 via-primary/20 to-primary/40`) intacto

### Resultado esperado
- Botoes compactos lado a lado (2 por linha no mobile), sem esticar na largura total
- Texto nunca vaza para fora do botao (font-size e padding proporcionais)
- Imagem de fundo fica muito mais visivel entre e ao redor dos botoes
- Overlay verde preservado exatamente como esta
- Funciona em todos os dashboards que usam `HeroActionButton`
