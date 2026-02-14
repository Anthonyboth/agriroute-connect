
# Correcao do Layout do Card de Propostas

## Problemas Identificados (baseado no screenshot)

1. **Padding excessivo**: `p-6` no CardContent cria muito espaco em branco nas laterais
2. **Rota e Vagas empilhados**: `grid-cols-1 md:grid-cols-2` faz rota e vagas ocuparem linhas separadas no mobile, desperdicando espaco vertical
3. **Secao de valores com padding excessivo**: `p-4` no bloco de precos
4. **Botoes empilhados verticalmente**: `flex-wrap` faz os 3 botoes cairem em linhas separadas no mobile, ocupando muito espaco
5. **Separadores e margens grandes**: `my-4`, `mb-4` criam gaps visuais desnecessarios

## Correcoes no Arquivo

**Arquivo:** `src/components/proposal/ProposalCard.tsx`

| Linha | Antes | Depois |
|-------|-------|--------|
| 118 | `p-6` | `p-4` |
| 120-121 | `gap-4` no header | `gap-3` |
| 122 | Avatar `h-12 w-12` | `h-10 w-10` |
| 138 | Nome `text-lg` | `text-base` |
| 157 | Separator `my-4` | `my-3` |
| 159 | Grid `gap-4 mb-4` | `gap-2 mb-3` - rota e vagas lado a lado em mobile com `grid-cols-2` |
| 182 | Bloco de precos `p-4 mb-4` | `p-3 mb-3` |
| 247 | Aviso ANTT `mt-3 p-3` | `mt-2 p-2` |
| 291 | Botoes `mt-4 flex-wrap` | `mt-3` com layout em grid `grid-cols-3` para ficarem sempre lado a lado |

## Resumo

Reducao geral de padding, margens e gaps para eliminar o excesso de espaco em branco. Rota e Vagas sempre lado a lado. Botoes em grid de 3 colunas para nunca empilhar. Nenhum outro arquivo sera alterado.
