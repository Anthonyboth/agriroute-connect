/**
 * Edge Function: pagarme-create-pix
 * 
 * Cria uma cobrança PIX no Pagar.me para pagamento de emissão fiscal
 * Retorna QR Code e dados para pagamento
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreatePixPayload {
  issuer_id: string;
  document_type: 'nfe' | 'cte' | 'mdfe' | 'gta';
  document_ref: string; // emission_id ou internal_ref
  amount_centavos: number;
  description: string;
  freight_id?: string;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[PAGARME-CREATE-PIX][${requestId}] Requisição recebida: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, {
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Método não permitido.',
    });
  }

  try {
    // Verificar API Key do Pagar.me
    const PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY');
    if (!PAGARME_API_KEY) {
      console.error(`[PAGARME-CREATE-PIX][${requestId}] PAGARME_API_KEY não configurada`);
      return jsonResponse(500, {
        success: false,
        code: 'CONFIG_MISSING',
        message: 'Configuração de pagamento indisponível. Contate o suporte.',
      });
    }

    // Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(401, {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Não autorizado.',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return jsonResponse(401, {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Token inválido.',
      });
    }

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('user_id', userData.user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse(404, {
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Perfil não encontrado.',
      });
    }

    // Parsear payload
    let payload: CreatePixPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, {
        success: false,
        code: 'INVALID_PAYLOAD',
        message: 'Dados inválidos.',
      });
    }

    const { issuer_id, document_type, document_ref, amount_centavos, description, freight_id } = payload;

    // Validações
    if (!issuer_id || !document_type || !document_ref || !amount_centavos) {
      return jsonResponse(400, {
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Campos obrigatórios: issuer_id, document_type, document_ref, amount_centavos.',
      });
    }

    if (!['nfe', 'cte', 'mdfe', 'gta'].includes(document_type)) {
      return jsonResponse(400, {
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Tipo de documento inválido. Use: nfe, cte, mdfe ou gta.',
      });
    }

    if (amount_centavos < 100) {
      return jsonResponse(400, {
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Valor mínimo para cobrança é R$ 1,00 (100 centavos).',
      });
    }

    // Verificar se o issuer pertence ao usuário
    const { data: issuer, error: issuerError } = await supabase
      .from('fiscal_issuers')
      .select('id, profile_id, legal_name, document_number')
      .eq('id', issuer_id)
      .single();

    if (issuerError || !issuer) {
      return jsonResponse(404, {
        success: false,
        code: 'ISSUER_NOT_FOUND',
        message: 'Emissor fiscal não encontrado.',
      });
    }

    if (issuer.profile_id !== profile.id) {
      return jsonResponse(403, {
        success: false,
        code: 'FORBIDDEN',
        message: 'Sem permissão para este emissor.',
      });
    }

    // Verificar se já existe cobrança pendente ou paga para este documento
    const { data: existingTransaction } = await supabase
      .from('fiscal_wallet_transactions')
      .select('id, metadata')
      .eq('reference_type', 'pix_payment')
      .contains('metadata', { document_ref, document_type })
      .in('transaction_type', ['pix_pending', 'pix_paid'])
      .limit(1)
      .maybeSingle();

    if (existingTransaction) {
      const meta = existingTransaction.metadata as Record<string, unknown>;
      if (meta?.payment_status === 'paid') {
        return jsonResponse(400, {
          success: false,
          code: 'ALREADY_PAID',
          message: 'Este documento já foi pago.',
        });
      }
      // Retornar dados da cobrança existente se ainda estiver pendente
      if (meta?.charge_id && meta?.qr_code) {
        console.log(`[PAGARME-CREATE-PIX][${requestId}] Retornando cobrança existente: ${meta.charge_id}`);
        return jsonResponse(200, {
          success: true,
          message: 'Cobrança PIX já existe.',
          charge_id: meta.charge_id,
          qr_code: meta.qr_code,
          qr_code_url: meta.qr_code_url || null,
          expires_at: meta.expires_at,
          amount_centavos: meta.amount_centavos || amount_centavos,
          description: description,
          existing: true,
        });
      }
    }

    // Buscar wallet_id do issuer
    const { data: wallet } = await supabase
      .from('fiscal_wallet')
      .select('id')
      .eq('issuer_id', issuer_id)
      .maybeSingle();

    if (!wallet) {
      console.error(`[PAGARME-CREATE-PIX][${requestId}] Wallet não encontrada para issuer ${issuer_id}`);
      return jsonResponse(400, {
        success: false,
        code: 'WALLET_NOT_FOUND',
        message: 'Carteira fiscal não encontrada. Complete o cadastro do emissor.',
      });
    }

    // Criar cobrança PIX no Pagar.me
    console.log(`[PAGARME-CREATE-PIX][${requestId}] Criando cobrança PIX no Pagar.me`);
    console.log(`[PAGARME-CREATE-PIX][${requestId}] Valor: ${amount_centavos} centavos`);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    const pagarmePayload = {
      items: [
        {
          amount: amount_centavos,
          description: description || `Emissão de ${document_type.toUpperCase()}`,
          quantity: 1,
          code: `${document_type.toUpperCase()}-${document_ref.substring(0, 20)}`,
        },
      ],
      customer: {
        name: issuer.legal_name || profile.full_name || 'Cliente AgriRoute',
        email: profile.email || userData.user.email || 'cliente@agriroute.com.br',
        document: issuer.document_number?.replace(/\D/g, '') || '00000000000',
        type: (issuer.document_number?.replace(/\D/g, '').length === 14) ? 'company' : 'individual',
      },
      payments: [
        {
          payment_method: 'pix',
          pix: {
            expires_at: expiresAt.toISOString(),
          },
        },
      ],
      metadata: {
        issuer_id,
        document_type,
        document_ref,
        profile_id: profile.id,
        freight_id: freight_id || null,
        source: 'agriroute_fiscal',
      },
    };

    let pagarmeResponse: Response;
    let pagarmeData: Record<string, unknown>;

    try {
      pagarmeResponse = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pagarmePayload),
      });

      const responseText = await pagarmeResponse.text();
      console.log(`[PAGARME-CREATE-PIX][${requestId}] Pagar.me status: ${pagarmeResponse.status}`);
      
      try {
        pagarmeData = JSON.parse(responseText);
      } catch {
        console.error(`[PAGARME-CREATE-PIX][${requestId}] Resposta não é JSON:`, responseText.substring(0, 500));
        return jsonResponse(502, {
          success: false,
          code: 'PROVIDER_ERROR',
          message: 'Erro ao comunicar com provedor de pagamento.',
        });
      }
    } catch (fetchError) {
      console.error(`[PAGARME-CREATE-PIX][${requestId}] Erro de comunicação:`, fetchError);
      return jsonResponse(502, {
        success: false,
        code: 'PROVIDER_COMMUNICATION_FAILED',
        message: 'Falha na comunicação com provedor de pagamento. Tente novamente.',
      });
    }

    if (!pagarmeResponse.ok) {
      console.error(`[PAGARME-CREATE-PIX][${requestId}] Erro Pagar.me:`, JSON.stringify(pagarmeData).substring(0, 1000));
      const errorMessage = (pagarmeData as any)?.message || (pagarmeData as any)?.errors?.[0]?.message || 'Erro ao criar cobrança PIX.';
      return jsonResponse(422, {
        success: false,
        code: 'PROVIDER_ERROR',
        message: `Erro do provedor: ${errorMessage}`,
      });
    }

    // Extrair dados do PIX da resposta
    const orderId = (pagarmeData as any).id;
    const charges = (pagarmeData as any).charges || [];
    const charge = charges[0] || {};
    const chargeId = charge.id;
    const lastTransaction = charge.last_transaction || {};
    const qrCode = lastTransaction.qr_code || '';
    const qrCodeUrl = lastTransaction.qr_code_url || '';
    const pixExpiresAt = lastTransaction.expires_at || expiresAt.toISOString();

    console.log(`[PAGARME-CREATE-PIX][${requestId}] ✅ Cobrança criada: ${chargeId}`);
    console.log(`[PAGARME-CREATE-PIX][${requestId}] Order ID: ${orderId}`);

    // Registrar a cobrança na tabela fiscal_wallet_transactions
    const transactionData = {
      wallet_id: wallet.id,
      transaction_type: 'pix_pending',
      amount: amount_centavos,
      balance_before: 0,
      balance_after: 0,
      reference_type: 'pix_payment',
      reference_id: null,
      description: description || `Cobrança PIX - ${document_type.toUpperCase()}`,
      payment_method: 'pix',
      metadata: {
        pagarme_order_id: orderId,
        charge_id: chargeId,
        document_type,
        document_ref,
        issuer_id,
        freight_id: freight_id || null,
        qr_code: qrCode,
        qr_code_url: qrCodeUrl,
        expires_at: pixExpiresAt,
        amount_centavos,
        payment_status: 'pending',
        created_at: new Date().toISOString(),
      },
      created_by: profile.id,
    };

    const { data: transaction, error: transactionError } = await supabase
      .from('fiscal_wallet_transactions')
      .insert(transactionData)
      .select('id')
      .single();

    if (transactionError) {
      console.error(`[PAGARME-CREATE-PIX][${requestId}] Erro ao registrar transação:`, transactionError);
      // Não falha, apenas loga
    } else {
      console.log(`[PAGARME-CREATE-PIX][${requestId}] ✅ Transação registrada: ${transaction?.id}`);
    }

    return jsonResponse(200, {
      success: true,
      message: 'Cobrança PIX criada com sucesso.',
      charge_id: chargeId,
      order_id: orderId,
      qr_code: qrCode,
      qr_code_url: qrCodeUrl,
      expires_at: pixExpiresAt,
      amount_centavos,
      description: description || `Emissão de ${document_type.toUpperCase()}`,
      transaction_id: transaction?.id || null,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[PAGARME-CREATE-PIX][${requestId}] ❌ Erro interno:`, errorMessage);
    
    return jsonResponse(500, {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao criar cobrança PIX. Tente novamente.',
    });
  }
});
