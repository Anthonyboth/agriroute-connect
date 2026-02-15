

# Unificar Campos de Cidade e CEP em Todo o App

## Problema Identificado

Existem **3 componentes separados** que fazem busca de cidade/CEP:

1. **`CitySelector`** -- Busca APENAS por nome de cidade (sem CEP). Usado em:
   - `Step3Location.tsx` (Service Wizard) -- o que aparece na sua screenshot
   - `SmartLocationManager.tsx`

2. **`AddressLocationInput`** -- Busca por CEP OU cidade (ja unificado). Usado em:
   - `CompleteProfile.tsx`

3. **`UnifiedLocationInput`** -- Busca por CEP OU cidade (ja unificado). Usado em:
   - 14 arquivos (FreightWizard, filtros, managers, etc.)

Na screenshot, o **Service Wizard (Step3Location)** mostra o campo "Cidade" separado do campo "CEP (opcional)" -- exatamente o problema.

## Solucao

Substituir o `CitySelector` pelo `AddressLocationInput` nos 2 locais que ainda usam o componente antigo, e remover o campo CEP separado.

O `AddressLocationInput` ja possui toda a logica necessaria:
- Detecta automaticamente se o usuario digita CEP ou nome de cidade
- Formata CEP automaticamente (00000-000)
- Busca via ViaCEP/BrasilAPI com cache
- Mostra dropdown de cidades com deduplicacao
- Retorna city_id, lat, lng, neighborhood

## Arquivos a Modificar

### 1. `src/components/service-wizard/steps/Step3Location.tsx`
- Trocar import de `CitySelector` para `AddressLocationInput`
- Remover o bloco do campo CEP separado (linhas 102-113)
- Substituir o `<CitySelector>` pelo `<AddressLocationInput>` com as mesmas props de onChange
- Quando CEP for digitado, preencher automaticamente o campo `address.cep` via callback

### 2. `src/components/SmartLocationManager.tsx`
- Trocar import de `CitySelector` para `AddressLocationInput`
- Substituir o `<CitySelector>` pelo `<AddressLocationInput>` mantendo a mesma interface de onChange

### O que NAO sera alterado
- `UnifiedLocationInput` e seus 14 consumidores (ja funcionam corretamente)
- `AddressLocationInput` em si (ja esta pronto)
- Nenhuma tabela ou RPC do banco de dados
- Nenhum outro componente ou pagina

## Detalhes Tecnicos

No `Step3Location.tsx`, o `AddressForm` interno sera atualizado:

```text
ANTES:
  [CitySelector] --> preenche city, state, city_id, lat, lng
  [Input CEP]    --> preenche apenas address.cep (texto)

DEPOIS:
  [AddressLocationInput] --> preenche city, state, city_id, lat, lng, neighborhood, E cep (quando digitado CEP)
```

O onChange do `AddressLocationInput` retorna `{ city, state, id, lat, lng, neighborhood }`. Quando o usuario digita um CEP, o componente ja resolve a cidade automaticamente. Adicionaremos logica para tambem preencher o campo `cep` do endereco quando o CEP e identificado.

Total: **2 arquivos modificados**, mudancas cirurgicas sem afetar nenhuma outra parte do app.
