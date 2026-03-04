

## Problema

Na tela de revisão do wizard de criação de frete (`FreightWizardStep5Review.tsx`), linhas 215-220, está sendo exibido um **"Total: R$ 36.000,00"** calculado como `R$/ton × toneladas`. Isso viola a regra do pipeline de preços: **nunca fazer cálculos derivados**. O produtor deve ver apenas a **taxa unitária** (R$ 120,00/ton) — sem multiplicações.

A função `calculateTotalPrice()` (linhas 58-77) faz exatamente o cálculo proibido.

## Plano

**Arquivo:** `src/components/freight-wizard/FreightWizardStep5Review.tsx`

1. **Remover** a função `calculateTotalPrice()` inteira (linhas 58-77)
2. **Remover** o bloco de "Total" da UI (linhas 215-220) — as 6 linhas que mostram "Total:" com `calculateTotalPrice()`
3. **Manter** apenas a exibição da taxa unitária que já existe (linhas 207-213): "Por tonelada: R$ 120,00/ton", "Por km: R$ X/km", ou "Valor fixo: R$ X"

O resultado será: na seção "Valor" do Step 5, aparece **somente** a linha com a taxa unitária (ex: "Por tonelada: R$ 120,00/ton") e o mínimo ANTT abaixo, sem nenhum cálculo de total.

