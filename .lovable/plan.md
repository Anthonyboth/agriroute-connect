
# Plano: Melhorar Legibilidade do Badge "Motorista"

## Problema Identificado

O badge "Motorista" no header do painel está quase ilegível no modo escuro:

- **Fundo atual**: `bg-accent/15` (laranja muito fraco, 15% opacidade)
- **Texto atual**: `text-accent-foreground` (que no dark mode é azul-escuro!)
- **Borda atual**: `border-accent/20` (laranja 20% opacidade)

O resultado é texto escuro sobre fundo escuro, tornando impossível ler.

## Solucao

Alterar a cor do texto do badge para usar laranja claro (`text-orange-400`) que contrasta bem com o fundo escuro, mantendo a identidade visual laranja do motorista.

## Mudanca Tecnica

**Arquivo**: `src/components/Header.tsx`

**Linha 89** - Alterar de:
```typescript
if (role === 'MOTORISTA') return 'bg-accent/15 text-accent-foreground border border-accent/20';
```

Para:
```typescript
if (role === 'MOTORISTA') return 'bg-orange-500/20 text-orange-400 dark:text-orange-300 border border-orange-500/40';
```

## Resultado Visual

| Antes | Depois |
|-------|--------|
| Texto escuro, quase invisível | Texto laranja claro, alta visibilidade |
| Borda muito fraca | Borda mais definida (40% opacidade) |
| Contraste: ~1.5:1 | Contraste: >4.5:1 (WCAG AA) |

O badge continuara com a cor laranja caracteristica do perfil Motorista, mas agora sera legivel em ambos os modos (claro e escuro).
