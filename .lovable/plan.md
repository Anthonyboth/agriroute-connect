

# Correcao do Botao "Links Uteis" Escondido na Aba Fiscal

## Problema

Na tela do Guia Fiscal (`FiscalEducationHub.tsx`), a `TabsList` usa `grid-cols-2 lg:grid-cols-3`. Em telas mobile (menos de `lg`), as 3 abas sao dispostas em 2 colunas, fazendo a terceira aba ("Links Uteis") cair para uma segunda linha. Porem, o componente `TabsList` tem altura fixa `h-10`, cortando a segunda linha e escondendo o botao "Links Uteis" atras do conteudo.

## Correcao

Alterar **apenas** a linha 158 de `src/components/fiscal/education/FiscalEducationHub.tsx`:

- Mudar `grid-cols-2 lg:grid-cols-3` para `grid-cols-3` para que as 3 abas sempre caibam em uma unica linha
- Isso funciona porque os textos ja usam `hidden sm:inline` (so mostram icone em telas pequenas), entao 3 colunas com icones cabem perfeitamente em qualquer largura

## Arquivo Alterado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/fiscal/education/FiscalEducationHub.tsx` (linha 158) | `grid-cols-2 lg:grid-cols-3` para `grid-cols-3` |

Nenhum outro arquivo sera alterado. O botao do WhatsApp permanece como esta.

