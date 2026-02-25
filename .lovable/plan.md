

## Plano: Remover chips de tipo e seletor de prazo do MarketplaceFilters

O usuário quer remover dois elementos marcados na imagem:
1. **Chips de tipo de serviço** (Pacotes, Moto, Mudança, Pet, Guincho, Carga) — redundantes pois o usuário já configura seus tipos no perfil
2. **Seletor de prazo/expiração** (📋 Todos dropdown) — desnecessário

Manter apenas o **seletor de ordenação** ("Vencimento mais próximo").

### Arquivos a alterar

1. **`src/components/MarketplaceFilters.tsx`**
   - Remover todo o bloco de chips de tipo (linhas 138-165)
   - Remover o `Select` de expiryBucket (linhas 169-184)
   - Remover props `availableTypes` da interface
   - Remover `toggleType` function
   - Remover `TYPE_LABELS`, `EXPIRY_OPTIONS` constants
   - Remover imports não utilizados (`Badge`, `Package`, `Truck`, `Wrench`, `Bike`, `PawPrint`, `Clock`)
   - Manter apenas o seletor de ordenação com `ArrowUpDown`

2. **`src/components/SmartFreightMatcher.tsx`**
   - Remover prop `availableTypes` da chamada `<MarketplaceFilters>`

3. **`src/components/CompanySmartFreightMatcher.tsx`**
   - Remover prop `availableTypes` da chamada `<MarketplaceFilters>`

4. Qualquer outro arquivo que passe `availableTypes` ao componente (verificar 4º arquivo encontrado na busca)

### O que NÃO muda
- O estado `selectedTypes` e `expiryBucket` continuam no type/state (para manter compatibilidade com a RPC), mas ficam sempre nos valores default (vazio / "ALL")
- O seletor de ordenação permanece intacto
- Nenhuma alteração de backend/RPC

