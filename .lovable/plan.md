

## Diagnóstico

A causa raiz é a classe CSS `.freight-card-standard` em `src/index.css` (linha 388-396):

```css
.freight-card-standard {
  height: 460px;
  max-height: 460px;
  overflow: hidden;
  overflow-y: auto;
}
```

Isso força **todos os cards de frete a 460px fixos**. Quando o conteúdo do card (título + rota + specs + grid de datas + preço + botões Aceitar/Contraproposta) ultrapassa 460px, os botões ficam cortados. No iOS, o scroll interno de `overflow-y: auto` dentro de um card pequeno não funciona bem com `-webkit-overflow-scrolling: touch` — o usuário não consegue rolar até os botões.

## Plano de Correção

### 1. Remover altura fixa do `.freight-card-standard` (index.css)
- Trocar `height: 460px; max-height: 460px;` por `min-height: 0;` (ou remover completamente)
- Manter `display: flex; flex-direction: column;` para layout correto
- Remover `overflow: hidden; overflow-y: auto;` — o card deve crescer para acomodar todo o conteúdo incluindo botões
- Resultado: cards terão altura natural baseada no conteúdo, sem cortar botões

### 2. Remover `overflow-hidden` do FreightCard (FreightCard.tsx, linha 514)
- A classe `overflow-hidden` no Card component clippa o conteúdo no iOS
- Remover para garantir que botões fiquem sempre visíveis e clicáveis

### 3. Remover `overflow-hidden` do OptimizedFreightCard (OptimizedFreightCard.tsx, linha 190)
- Mesma correção para o card otimizado usado em outros contextos

### 4. Auditar outros cards (FreightInProgressCard, MyAssignmentCard, UnifiedServiceCard)
- Verificar se usam `.freight-card-standard` ou `overflow-hidden` e aplicar a mesma correção
- Garantir que nenhum card de frete/serviço corte conteúdo no iPhone

### Detalhes Técnicos
- A classe `.freight-card-standard` era provavelmente usada para uniformizar alturas no grid, mas sacrifica acessibilidade dos botões
- Sem altura fixa, os cards no grid terão alturas diferentes, mas todos os botões serão acessíveis — prioridade funcional sobre estética
- Se uniformização de altura for desejada no futuro, usar `auto-rows-[minmax(0,1fr)]` no grid pai ao invés de forçar altura no card

