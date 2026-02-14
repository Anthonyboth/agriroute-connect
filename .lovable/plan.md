

## Remover dica nao autorizada e otimizar espaco do header

### Problema
No wizard de solicitacao de servicos (ServiceWizard), existe uma caixa de "Dica" azul que foi adicionada sem autorizacao. Ela ocupa espaco precioso no topo do card, especialmente em mobile com teclado aberto, fazendo com que os campos de preenchimento fiquem muito pequenos e dificeis de usar.

### Solucao

**Arquivo**: `src/components/service-wizard/ServiceWizard.tsx`

1. **Remover completamente o bloco de dica** (linhas 707-714) - a div com "Crie uma conta para acompanhar suas solicitacoes e ter acesso ao historico"

2. **Compactar o header** para ganhar mais espaco vertical:
   - Reduzir o padding do header de `p-4` para `px-4 py-2`
   - Reduzir margem inferior do titulo de `mb-2` para `mb-1`

Isso vai liberar espaco significativo para a area de conteudo scrollavel onde o usuario preenche os campos.

### Detalhes tecnicos

Alteracao unica no arquivo `src/components/service-wizard/ServiceWizard.tsx`:
- Remover linhas 707-714 (bloco condicional `!profile?.id` com a dica)
- Ajustar padding do header container (linha 700)
- Nenhum outro arquivo sera modificado

