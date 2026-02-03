/**
 * Edge Function: pagarme-payment-status
 * 
 * Consulta o status de um pagamento PIX
 * Pode ser consultado por charge_id ou (issuer_id + document_ref)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[PAGARME-PAYMENT-STATUS][${requestId}] Requisição recebida: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse(405, {
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Método não permitido.',
    });
  }

  try {
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
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse(404, {
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Perfil não encontrado.',
      });
    }

    // Parsear parâmetros
    let charge_id: string | null = null;
    let issuer_id: string | null = null;
    let document_ref: string | null = null;
    let document_type: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        charge_id = body.charge_id || null;
        issuer_id = body.issuer_id || null;
        document_ref = body.document_ref || null;
        document_type = body.document_type || null;
      } catch {
        return jsonResponse(400, {
          success: false,
          code: 'INVALID_PAYLOAD',
          message: 'Dados inválidos.',
        });
      }
    } else {
      // GET - parâmetros na URL
      const url = new URL(req.url);
      charge_id = url.searchParams.get('charge_id');
      issuer_id = url.searchParams.get('issuer_id');
      document_ref = url.searchParams.get('document_ref');
      document_type = url.searchParams.get('document_type');
    }

    if (!charge_id && (!issuer_id || !document_ref)) {
      return jsonResponse(400, {
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Informe charge_id ou (issuer_id + document_ref).',
      });
    }

    console.log(`[PAGARME-PAYMENT-STATUS][${requestId}] Buscando: charge_id=${charge_id}, issuer_id=${issuer_id}, document_ref=${document_ref}`);

    // Buscar transação no banco
    let query = supabase
      .from('fiscal_wallet_transactions')
      .select('*')
      .eq('reference_type', 'pix_payment');

    if (charge_id) {
      query = query.contains('metadata', { charge_id });
    } else {
      query = query.contains('metadata', { issuer_id, document_ref });
      if (document_type) {
        query = query.contains('metadata', { document_type });
      }
    }

    const { data: transactions, error: queryError } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error(`[PAGARME-PAYMENT-STATUS][${requestId}] Erro na consulta:`, queryError);
      return jsonResponse(500, {
        success: false,
        code: 'DATABASE_ERROR',
        message: 'Erro ao consultar pagamento.',
      });
    }

    if (!transactions || transactions.length === 0) {
      return jsonResponse(404, {
        success: false,
        code: 'PAYMENT_NOT_FOUND',
        message: 'Pagamento não encontrado.',
      });
    }

    const transaction = transactions[0];
    const metadata = transaction.metadata as Record<string, unknown>;

    // Verificar se o pagamento pertence ao usuário
    if (metadata?.issuer_id) {
      const { data: issuer } = await supabase
        .from('fiscal_issuers')
        .select('profile_id')
        .eq('id', metadata.issuer_id)
        .single();

      if (issuer?.profile_id !== profile.id) {
        return jsonResponse(403, {
          success: false,
          code: 'FORBIDDEN',
          message: 'Sem permissão para consultar este pagamento.',
        });
      }
    }

    // Mapear status
    const paymentStatus = metadata?.payment_status || 
      (transaction.transaction_type === 'pix_paid' ? 'paid' : 
       transaction.transaction_type === 'pix_pending' ? 'pending' :
       transaction.transaction_type === 'pix_failed' ? 'failed' :
       transaction.transaction_type === 'pix_refunded' ? 'refunded' :
       transaction.transaction_type === 'pix_canceled' ? 'canceled' : 'unknown');

    // Se ainda está pendente, verificar no Pagar.me
    let liveStatus = paymentStatus;
    const PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY');
    
    if (paymentStatus === 'pending' && metadata?.charge_id && PAGARME_API_KEY) {
      try {
        console.log(`[PAGARME-PAYMENT-STATUS][${requestId}] Consultando status no Pagar.me...`);
        
        const pagarmeResponse = await fetch(
          `https://api.pagar.me/core/v5/charges/${metadata.charge_id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
              'Accept': 'application/json',
            },
          }
        );

        if (pagarmeResponse.ok) {
          const pagarmeData = await pagarmeResponse.json();
          const pagarmeStatus = pagarmeData.status?.toLowerCase() || '';

          console.log(`[PAGARME-PAYMENT-STATUS][${requestId}] Status Pagar.me: ${pagarmeStatus}`);

          // Mapear status do Pagar.me
          if (pagarmeStatus === 'paid') {
            liveStatus = 'paid';
            
            // Atualizar no banco
            await supabase
              .from('fiscal_wallet_transactions')
              .update({
                transaction_type: 'pix_paid',
                metadata: {
                  ...metadata,
                  payment_status: 'paid',
                  paid_at: new Date().toISOString(),
                },
              })
              .eq('id', transaction.id);

            console.log(`[PAGARME-PAYMENT-STATUS][${requestId}] ✅ Status atualizado para PAID`);
          } else if (['failed', 'canceled', 'voided'].includes(pagarmeStatus)) {
            liveStatus = 'failed';
            
            await supabase
              .from('fiscal_wallet_transactions')
              .update({
                transaction_type: 'pix_failed',
                metadata: {
                  ...metadata,
                  payment_status: 'failed',
                  failed_at: new Date().toISOString(),
                },
              })
              .eq('id', transaction.id);
          } else if (pagarmeStatus === 'refunded') {
            liveStatus = 'refunded';
          }
        }
      } catch (pagarmeError) {
        console.error(`[PAGARME-PAYMENT-STATUS][${requestId}] Erro ao consultar Pagar.me:`, pagarmeError);
        // Continua com o status do banco
      }
    }

    return jsonResponse(200, {
      success: true,
      message: 'Status do pagamento consultado.',
      status: liveStatus,
      charge_id: metadata?.charge_id || null,
      order_id: metadata?.pagarme_order_id || null,
      amount_centavos: metadata?.amount_centavos || transaction.amount,
      document_type: metadata?.document_type || null,
      document_ref: metadata?.document_ref || null,
      expires_at: metadata?.expires_at || null,
      paid_at: metadata?.paid_at || null,
      created_at: transaction.created_at,
      qr_code: liveStatus === 'pending' ? metadata?.qr_code : null,
      qr_code_url: liveStatus === 'pending' ? metadata?.qr_code_url : null,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[PAGARME-PAYMENT-STATUS][${requestId}] ❌ Erro interno:`, errorMessage);
    
    return jsonResponse(500, {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao consultar pagamento. Tente novamente.',
    });
  }
});
