

## Plano: Gerar NF-e de Teste Imediatamente (Sem UI)

### Situação Atual

**Emissor Fiscal Encontrado:**
- **ID:** `d7ace860-210d-4cab-957e-2357023c9eeb`
- **CNPJ:** `62965243000111`
- **Razão Social:** ANTHONY BOTH
- **Ambiente:** `production` (⚠️ **PRODUÇÃO**)
- **Status:** `certificate_uploaded`
- **Localização:** Primavera do Leste, MT

**⚠️ ALERTA CRÍTICO:** O emissor está configurado em **PRODUÇÃO**. Emitir uma NF-e de teste em produção **gerará um documento fiscal real** com validade legal e custos reais. 

### Opção 1: Emitir NF-e de Teste em PRODUÇÃO (Não Recomendado)

Se você deseja prosseguir mesmo assim, execute o seguinte código **no console do navegador** (F12) enquanto estiver logado no app:

```javascript
// Emitir NF-e de teste em PRODUÇÃO
(async () => {
  const { data: { session } } = await window.supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ Não há sessão ativa');
    return;
  }

  const payload = {
    issuer_id: 'd7ace860-210d-4cab-957e-2357023c9eeb',
    freight_id: null,
    destinatario: {
      cnpj_cpf: '12345678909',
      razao_social: 'DESTINATARIO TESTE PRODUCAO',
      ie: '',
      email: 'teste@teste.com',
      telefone: '65999999999',
      endereco: {
        logradouro: 'RUA TESTE',
        numero: '123',
        bairro: 'CENTRO',
        municipio: 'CUIABA',
        uf: 'MT',
        cep: '78000000'
      }
    },
    itens: [{
      descricao: 'SERVICO TESTE AGRIROUTE - PRODUCAO',
      ncm: '',
      cfop: '5102',
      unidade: 'UN',
      quantidade: 1,
      valor_unitario: 10
    }],
    valores: {
      total: 10,
      frete: 0,
      desconto: 0
    },
    informacoes_adicionais: 'NF-e de teste - AgriRoute'
  };

  console.log('🚀 Enviando para nfe-emitir...', payload);

  const { data, error } = await window.supabase.functions.invoke('nfe-emitir', {
    body: payload,
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  if (!data?.success) {
    console.error('❌ Falha na emissão:', data);
    return;
  }

  console.log('✅ NF-e criada com sucesso!');
  console.log('📋 Status:', data.status);
  console.log('📋 Ref interna:', data.internal_ref);
  console.log('📋 Emission ID:', data.emission_id);
  if (data.numero) console.log('📋 Número NF-e:', data.numero);
  if (data.chave) console.log('🔑 Chave de acesso:', data.chave);
})();
```

**Consequências desta abordagem:**
- ✅ Gerará uma NF-e real no SEFAZ MT
- ⚠️ Consumirá 1 crédito real da carteira fiscal
- ⚠️ Documento terá validade legal
- ⚠️ Pode gerar obrigações fiscais (declaração de cancelamento se necessário)

---

### Opção 2: Configurar Emissor em Homologação (Recomendado)

Para testar **sem riscos fiscais**, você precisa criar/configurar um emissor em ambiente de homologação. Aqui está o plano:

#### Passo A: Criar Emissor de Homologação via SQL

Execute no **SQL Editor do Supabase** (https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/sql/new):

```sql
-- Inserir emissor de teste em homologação
INSERT INTO public.fiscal_issuers (
  profile_id,
  document_type,
  document_number,
  legal_name,
  trade_name,
  state_registration,
  uf,
  city,
  city_ibge_code,
  address_street,
  address_number,
  address_neighborhood,
  address_zip_code,
  tax_regime,
  fiscal_environment,
  status,
  onboarding_completed
) VALUES (
  '5968c470-b7a8-4c53-90cd-68a2b726f5bb', -- seu profile_id
  'CNPJ',
  '11222333000144', -- CNPJ fictício para homologação
  'EMPRESA TESTE HOMOLOGACAO LTDA',
  'TESTE HOMOLOG',
  '000000000',
  'MT',
  'CUIABA',
  '5103403',
  'RUA DOS TESTES',
  '999',
  'CENTRO',
  '78000000',
  'simples_nacional',
  'homologation', -- ✅ AMBIENTE DE TESTE
  'certificate_uploaded',
  true
)
RETURNING id, document_number, fiscal_environment;
```

Este comando retornará o **novo `id`** do emissor de homologação.

#### Passo B: Adicionar Créditos de Teste

```sql
-- Criar carteira fiscal com créditos de teste
INSERT INTO public.fiscal_wallet (
  issuer_id,
  available_balance,
  reserved_balance,
  total_consumed
) VALUES (
  '<EMISSOR_ID_RETORNADO_ACIMA>', -- substituir pelo ID real
  100, -- 100 créditos de teste
  0,
  0
)
ON CONFLICT (issuer_id) DO UPDATE
SET available_balance = fiscal_wallet.available_balance + 100;
```

#### Passo C: Gerar NF-e de Teste em Homologação

Agora sim, execute no **console do navegador**:

```javascript
// Emitir NF-e de teste em HOMOLOGAÇÃO
(async () => {
  const { data: { session } } = await window.supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ Não há sessão ativa');
    return;
  }

  // ⚠️ SUBSTITUIR pelo ID do emissor de homologação criado no Passo A
  const ISSUER_ID_HOMOLOG = '<SUBSTITUIR_AQUI>'; 

  const payload = {
    issuer_id: ISSUER_ID_HOMOLOG,
    freight_id: null,
    destinatario: {
      cnpj_cpf: '12345678909',
      razao_social: 'DESTINATARIO TESTE HOMOLOGACAO',
      ie: '',
      email: 'teste@teste.com',
      telefone: '65999999999',
      endereco: {
        logradouro: 'RUA TESTE',
        numero: '123',
        bairro: 'CENTRO',
        municipio: 'CUIABA',
        uf: 'MT',
        cep: '78000000'
      }
    },
    itens: [{
      descricao: 'SERVICO TESTE AGRIROUTE - HOMOLOGACAO',
      ncm: '',
      cfop: '5102',
      unidade: 'UN',
      quantidade: 1,
      valor_unitario: 10
    }],
    valores: {
      total: 10,
      frete: 0,
      desconto: 0
    },
    informacoes_adicionais: 'NF-e de teste em HOMOLOGACAO - sem validade fiscal'
  };

  console.log('🚀 Enviando para nfe-emitir (HOMOLOGAÇÃO)...', payload);

  const { data, error } = await window.supabase.functions.invoke('nfe-emitir', {
    body: payload,
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  if (!data?.success) {
    console.error('❌ Falha na emissão:', data);
    return;
  }

  console.log('✅ NF-e de teste criada com sucesso!');
  console.log('📋 Status:', data.status);
  console.log('📋 Ref interna:', data.internal_ref);
  console.log('📋 Emission ID:', data.emission_id);
  console.log('🧪 Ambiente: HOMOLOGAÇÃO (sem validade fiscal)');
})();
```

---

### Opção 3: Usar a Ferramenta de Teste da Edge Function (Mais Seguro)

Como você tem acesso ao projeto, pode usar a ferramenta `supabase--curl_edge_functions` diretamente da sua conta Lovable (sem precisar do console do navegador):

1. Vá em **Tools** no painel Lovable
2. Selecione **Test Edge Function**
3. Configure:
   - **Function:** `nfe-emitir`
   - **Method:** `POST`
   - **Body:** (use o payload JSON da Opção 1 ou 2)
   - **Auth:** Marque "Use current user session"

---

### Checklist de Segurança

Antes de executar **qualquer** emissão, confirme:

- [ ] Você entende que emissão em **produção** gera documentos fiscais reais?
- [ ] Você verificou se o emissor está em **homologação** (ambiente de teste)?
- [ ] Você tem créditos disponíveis na carteira fiscal?
- [ ] Você revisou os dados do destinatário (CPF/CNPJ)?
- [ ] Você confirmou que o token Focus NFe está configurado? (verificar secrets da edge function)

---

### Arquivos Envolvidos (Nenhuma Mudança)

Este plano **NÃO modifica nenhum arquivo** do projeto. Apenas utiliza:
- Edge function existente: `supabase/functions/nfe-emitir/index.ts`
- Tabelas existentes: `fiscal_issuers`, `fiscal_wallet`, `nfe_emissions`

---

### Resultado Esperado

Após executar o código (Opção 1, 2 ou 3):

**Sucesso:**
```
✅ NF-e criada com sucesso!
📋 Status: authorized | processing | pending
📋 Ref interna: NFE-d7ace860-1737942784962
📋 Emission ID: <uuid>
🔑 Chave de acesso: <44 dígitos> (se autorizada)
```

**Erro Comum - Saldo Insuficiente:**
```
❌ Falha na emissão: {
  code: "INSUFFICIENT_BALANCE",
  message: "Saldo insuficiente de emissões..."
}
```
**Solução:** Execute o Passo B (adicionar créditos) antes de tentar novamente.

**Erro Comum - Token Focus Não Configurado:**
```
❌ Falha na emissão: {
  code: "CONFIG_MISSING",
  message: "Configuração fiscal indisponível..."
}
```
**Solução:** Configure o secret `FOCUS_NFE_TOKEN` nas configurações da edge function.

