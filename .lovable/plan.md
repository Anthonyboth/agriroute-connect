
# Plano: Implementar PIX para CT-e / MDF-e / GT-A + Padronizar Fluxo

## Resumo Executivo

Implementação do fluxo de pagamento PIX Pagar.me para CT-e, MDF-e e GT-A (R$10,00 fixo cada), seguindo o padrão já existente para NF-e. Também será corrigida a integração do PixPaymentModal em todos os wizards.

## Estado Atual

### Backend
- **cte-emitir**: Existe, mas NÃO tem verificação de pagamento PIX
- **mdfe-emitir**: Existe, mas NÃO tem verificação de pagamento PIX
- **GTA**: Não há edge function de emissão (é upload de documento externo)
- **nfe-emitir**: Já implementado com verificação de pagamento PIX (retorna 402)

### Frontend
- **NfeEmissionWizard**: Já tem PixPaymentModal integrado e tratamento do 402
- **CteEmissionWizard**: NÃO tem integração PIX
- **MdfeEmissionWizard**: NÃO tem integração PIX
- **GtaUploadDialog**: É apenas upload de documento externo (não emissão SEFAZ)

## Arquitetura do Fluxo

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE EMISSÃO FISCAL                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Usuário clica "Emitir"                                       │
│  2. Pré-validação fiscal (certificado, SEFAZ, etc.)              │
│  3. Chama edge function (cte-emitir, mdfe-emitir, nfe-emitir)   │
│  4. Backend verifica pagamento em fiscal_wallet_transactions     │
│     ├─ Se PAGO: continua emissão                                 │
│     └─ Se NÃO PAGO: retorna 402 PAYMENT_REQUIRED                │
│  5. Frontend abre PixPaymentModal                                │
│  6. Usuário paga PIX                                             │
│  7. Webhook atualiza fiscal_wallet_transactions (status: paid)   │
│  8. Frontend detecta pagamento e chama emissão novamente         │
│  9. Backend emite documento normalmente                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### 1. Backend - Atualizar cte-emitir

**Arquivo**: `supabase/functions/cte-emitir/index.ts`

Adicionar verificação de pagamento PIX antes da emissão (mesma lógica do nfe-emitir):

```typescript
// Após validações iniciais, ANTES de enviar para Focus NFe:

// VERIFICAÇÃO DE PAGAMENTO PIX (OBRIGATÓRIO)
const taxaCentavos = 1000; // CT-e: sempre R$ 10,00

console.log(`[CT-e Emitir] Verificando pagamento - Taxa: ${taxaCentavos} centavos`);

// Verificar pagamento na tabela fiscal_wallet_transactions
const { data: paidTransactions } = await supabaseClient
  .from('fiscal_wallet_transactions')
  .select('id, metadata')
  .eq('reference_type', 'pix_payment')
  .eq('transaction_type', 'pix_paid')
  .order('created_at', { ascending: false })
  .limit(10);

let pagamentoValido = false;
if (paidTransactions?.length > 0) {
  for (const tx of paidTransactions) {
    const meta = tx.metadata as Record<string, unknown>;
    if (meta?.issuer_id === empresa_id && 
        meta?.document_type === 'cte' && 
        !meta?.used_for_emission) {
      pagamentoValido = true;
      break;
    }
  }
}

if (!pagamentoValido) {
  return new Response(JSON.stringify({
    success: false,
    code: 'PAYMENT_REQUIRED',
    message: 'Pagamento via PIX obrigatório antes de emitir.',
    amount_centavos: taxaCentavos,
    document_type: 'cte',
    issuer_id: empresa_id,
    document_ref: `CTE-${frete_id.substring(0, 8)}-${Date.now()}`,
  }), { 
    headers: corsHeaders, 
    status: 402 
  });
}
```

### 2. Backend - Atualizar mdfe-emitir

**Arquivo**: `supabase/functions/mdfe-emitir/index.ts`

Mesma lógica, mas com `document_type: 'mdfe'`:

```typescript
// VERIFICAÇÃO DE PAGAMENTO PIX (OBRIGATÓRIO)
const taxaCentavos = 1000; // MDF-e: sempre R$ 10,00

// (mesma verificação do cte-emitir, ajustando document_type para 'mdfe')

if (!pagamentoValido) {
  return new Response(JSON.stringify({
    success: false,
    code: 'PAYMENT_REQUIRED',
    message: 'Pagamento via PIX obrigatório antes de emitir.',
    amount_centavos: taxaCentavos,
    document_type: 'mdfe',
    issuer_id: config.id || freight_id, // usar ID apropriado
    document_ref: `MDFE-${freight_id.substring(0, 8)}-${Date.now()}`,
  }), { 
    headers: corsHeaders, 
    status: 402 
  });
}
```

### 3. Frontend - Atualizar CteEmissionWizard

**Arquivo**: `src/components/fiscal/cte/CteEmissionWizard.tsx`

Mudanças:
- Importar `PixPaymentModal` e `usePixPayment`
- Adicionar estados para controle do modal PIX
- Tratar resposta 402 no `handleSubmit`
- Renderizar o modal no final

```typescript
// Novos imports
import { PixPaymentModal } from '@/components/fiscal/PixPaymentModal';
import { usePixPayment } from '@/hooks/usePixPayment';

// Novos estados
const [showPixModal, setShowPixModal] = useState(false);
const [paymentDocumentRef, setPaymentDocumentRef] = useState('');
const { calculateFee } = usePixPayment();

// No handleSubmit, após chamar cte-emitir:
if (data?.code === 'PAYMENT_REQUIRED') {
  const docRef = data?.document_ref || `cte_${Date.now()}`;
  setPaymentDocumentRef(docRef);
  setShowPixModal(true);
  return;
}

// Callback quando pagamento confirmado
const handlePaymentConfirmed = useCallback(() => {
  setShowPixModal(false);
  handleSubmit(); // Tentar emitir novamente
}, []);

// No return, adicionar modal:
{showPixModal && fiscalIssuer?.id && (
  <PixPaymentModal
    open={showPixModal}
    onClose={() => setShowPixModal(false)}
    issuerId={fiscalIssuer.id}
    documentType="cte"
    documentRef={paymentDocumentRef}
    amountCentavos={1000} // R$ 10,00 fixo
    description="Emissão de CT-e"
    freightId={freightId}
    onPaymentConfirmed={handlePaymentConfirmed}
  />
)}
```

### 4. Frontend - Atualizar MdfeEmissionWizard

**Arquivo**: `src/components/fiscal/mdfe/MdfeEmissionWizard.tsx`

Mesmas mudanças do CteEmissionWizard, ajustando:
- `documentType="mdfe"`
- `description="Emissão de MDF-e"`

### 5. Frontend - Atualizar GtaUploadDialog (Opcional - Taxa de Registro)

**Arquivo**: `src/components/fiscal/gta/GtaUploadDialog.tsx`

A GTA é um documento externo (não emitido via SEFAZ). Há duas opções:

**Opção A (Recomendada)**: Não cobrar taxa para upload de GTA (documento externo)
- Manter código atual sem modificações

**Opção B**: Cobrar R$ 10,00 por registro de GTA no sistema
- Antes do upload, verificar pagamento
- Se não pago, abrir PixPaymentModal
- Após pagamento, continuar com upload

Seguirei a **Opção A** (não cobrar) pois GTA não é emissão fiscal via API.

---

## Detalhes Técnicos

### Regra de Preços

| Documento | Condição | Valor |
|-----------|----------|-------|
| NF-e | Total ≤ R$ 1.000 | R$ 10,00 |
| NF-e | Total > R$ 1.000 | R$ 25,00 |
| CT-e | Sempre | R$ 10,00 |
| MDF-e | Sempre | R$ 10,00 |
| GT-A | Upload (não cobra) | R$ 0,00 |

### Verificação de Pagamento no Backend

Query para verificar pagamento válido:

```sql
SELECT id, metadata 
FROM fiscal_wallet_transactions 
WHERE reference_type = 'pix_payment'
  AND transaction_type = 'pix_paid'
  AND metadata->>'issuer_id' = :issuer_id
  AND metadata->>'document_type' = :document_type
  AND (metadata->>'used_for_emission') IS NULL
ORDER BY created_at DESC
LIMIT 1
```

### Estrutura do Erro 402

```json
{
  "success": false,
  "code": "PAYMENT_REQUIRED",
  "message": "Pagamento via PIX obrigatório antes de emitir.",
  "amount_centavos": 1000,
  "document_type": "cte",
  "issuer_id": "uuid",
  "document_ref": "CTE-abc12345-1234567890"
}
```

---

## Arquivos a Serem Modificados

### Backend (Edge Functions)
1. `supabase/functions/cte-emitir/index.ts` - Adicionar verificação de pagamento
2. `supabase/functions/mdfe-emitir/index.ts` - Adicionar verificação de pagamento

### Frontend (React)
3. `src/components/fiscal/cte/CteEmissionWizard.tsx` - Integrar PixPaymentModal
4. `src/components/fiscal/mdfe/MdfeEmissionWizard.tsx` - Integrar PixPaymentModal

---

## Fluxo Passo a Passo (8 linhas)

1. Usuário preenche dados e clica "Emitir CT-e/MDF-e"
2. Frontend chama edge function correspondente (cte-emitir ou mdfe-emitir)
3. Backend verifica se existe pagamento PIX válido em fiscal_wallet_transactions
4. Se não pago: retorna 402 PAYMENT_REQUIRED com amount_centavos=1000
5. Frontend abre PixPaymentModal com QR Code para R$ 10,00
6. Usuário paga PIX; webhook atualiza fiscal_wallet_transactions com status paid
7. Usuário clica "Verificar pagamento" ou aguarda polling automático
8. Frontend detecta pagamento e chama emissão novamente; backend emite normalmente

---

## Confirmações ao Concluir

Ao finalizar a implementação:

- CT-e/MDF-e agora cobram R$10 fixo via PIX antes de emitir
- NF-e wizard já abre PixPaymentModal no 402 e continua emissão após pagamento
- Nenhuma alteração de schema foi feita
- Nenhuma navegação/aba foi alterada
- Todas mensagens em pt-BR
