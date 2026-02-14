

# Corrigir prefill automatico e erro de envio de solicitacoes

## Problema Identificado

Existem dois problemas conectados pela mesma causa raiz:

1. **Erro "Nao foi possivel enviar sua solicitacao"** -- A edge function `create-guest-service-request` rejeita a solicitacao porque o campo `contact_phone` esta vazio. O Zod exige minimo 10 caracteres.

2. **Campos "Nao informado" na tela de revisao** -- Nome aparece correto, mas Telefone e Documento mostram "Nao informado" mesmo com o usuario logado e cadastrado.

## Causa Raiz

O hook `useAuth` busca o perfil da tabela `profiles` com um SELECT limitado que **NAO inclui** as colunas `phone`, `contact_phone`, `cpf_cnpj`, `document` e `email`. Alem disso, o CLS (Column-Level Security) bloqueia essas colunas na tabela base.

O hook `usePrefilledUserData` tenta ler esses campos do objeto `profile` retornado pelo `useAuth`, mas eles estao sempre vazios/undefined. Resultado: o prefill nao funciona e os dados nao sao preenchidos automaticamente.

## Solucao

Modificar o `usePrefilledUserData` para buscar dados pessoais diretamente da view `profiles_secure` (que contorna o CLS e permite acesso seguro). Assim o hook nao depende mais do objeto `profile` do `useAuth` para campos sensiveis.

## Arquivos a Modificar

### 1. `src/hooks/usePrefilledUserData.ts`
- Adicionar uma query direta a `profiles_secure` filtrando pelo `user_id` do usuario autenticado
- Buscar campos: `full_name`, `phone`, `contact_phone`, `cpf_cnpj`, `document`, `email`, `base_city_name`, `base_state`, `base_lat`, `base_lng`, `base_city_id`
- Usar esses dados no lugar dos campos do `profile` para montar o objeto `personal` e `address`
- Manter fallback para o `profile` do `useAuth` caso a query falhe

### 2. `src/components/service-wizard/ServiceWizard.tsx`
- Melhorar a mensagem de erro no catch do `handleSubmit`: quando o erro vier da validacao (campos vazios), mostrar mensagem especifica ao inves de "Verifique sua conexao com a internet"
- Adicionar verificacao antes do submit: se `contact_phone` estiver vazio, mostrar erro claro pedindo para preencher o telefone

## O que NAO sera alterado
- Nenhum outro componente fora dos dois listados
- A logica do `useAuth` permanece intacta
- A edge function permanece como esta
- Nenhum fluxo existente sera quebrado
- O freight wizard nao sera tocado (ja trata dados de contato apenas para guests)
