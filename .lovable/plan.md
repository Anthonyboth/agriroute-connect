

## Problema

O ícone atual tem fundo verde + quadrado branco, criando um visual "dupla moldura" feio no iOS. O iOS pega a imagem inteira e aplica a máscara arredondada por cima.

## Solução

1. **Gerar um novo ícone 1024x1024** com:
   - Fundo 100% branco preenchendo toda a imagem
   - Logo AgriRoute (folha verde) centralizado, ocupando ~60-70% do espaço
   - Sem bordas, sem fundo verde externo

2. **Substituir `public/app-icon.png`** com a nova imagem

3. **No Xcode**: arrastar novamente para o AppIcon slot

## Opções de implementação

**Opção A** — Usar a API de geração de imagem para criar automaticamente o ícone com fundo branco e o logo centralizado.

**Opção B** — Você edita manualmente a imagem em qualquer editor (Canva, Figma, Preview) colocando fundo branco e envia novamente.

Recomendo a **Opção A** — posso gerar o ícone correto automaticamente.

