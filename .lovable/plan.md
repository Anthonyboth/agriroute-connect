

## Plano: Restaurar e Adicionar Botões no Step 1 do Wizard de Frete

### Problema
Na tela do wizard, o usuário não vê os botões que deveriam estar visíveis (Corredor Agrícola, Mesma Cidade, GPS no destino). Verificando o código, os botões existem mas o GPS no destino está ausente. Os demais podem estar sendo "empurrados" para fora da área visível pela estrutura do modal.

### Alterações

**1. Adicionar botão GPS no Destino** (`FreightWizardStep1.tsx`)
- Adicionar um `GPSAddressButton` (ou reutilizar `GPSOriginButton` adaptado) na seção Destino, ao lado do botão "Mesma cidade", para permitir preenchimento via GPS igual ao da origem.

**2. Reorganizar layout dos botões para ficarem sempre visíveis**
- Mover o bloco "Corredor Rodoviário" para uma posição mais proeminente, logo acima dos cards de Origem/Destino (já está, mas garantir que o scroll do modal não esconda).
- Garantir que os botões GPS e "Mesma cidade" no destino fiquem na mesma linha, com layout responsivo (flex-wrap).
- Adicionar ícone visual no botão "Mesma cidade" para deixá-lo mais visível.

**3. Garantir que o conteúdo do modal seja scrollável**
- Verificar se o `DialogContent` do `CreateFreightWizardModal.tsx` permite scroll interno correto para que nenhum botão fique cortado em telas menores (mobile).

### Arquivos afetados
- `src/components/freight-wizard/FreightWizardStep1.tsx` — adicionar GPS no destino, reorganizar botões
- `src/components/freight-wizard/GPSAddressButton.tsx` — possivelmente criar componente reutilizável para GPS no destino (se `GPSOriginButton` não for genérico o suficiente)

