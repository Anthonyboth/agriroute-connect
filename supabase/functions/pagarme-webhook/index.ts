/**
 * Edge Function: pagarme-webhook
 * 
 * Webhook dedicado para receber eventos do Pagar.me (Stone)
 * Objetivo: Confirmar pagamento, liberar emissão fiscal, registrar log
 * 
 * Suporta autenticação via:
 * 1. Basic Auth (PAGARME_WEBHOOK_USER + PAGARME_WEBHOOK_SECRET)
 * 2. HMAC Signature (x-hub-signature / x-pagarme-signature)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHmac, timingSafeEqual } from "https://deno.land/std@0.177.0/node/crypto.ts";

// Headers CORS padrão
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature, x-pagarme-signature, x-signature',
};

// Eventos suportados (apenas pagamento/cobrança/pedido)
const SUPPORTED_EVENTS = [
  // Cobranças (Charge)
  'charge.created',
  'charge.pending',
  'charge.paid',
  'charge.payment_failed',
  'charge.refunded',
  'charge.overpaid',
  'charge.underpaid',
  'charge.chargedback',
  'charge.chargeback_recovered',
  'charge.canceled',
  'charge.partial_canceled',
  
  // Pedidos (Order)
  'order.created',
  'order.paid',
  'order.payment_failed',
  'order.closed',
  'order.canceled',
  
  // Transações (se aplicável)
  'transaction.created',
  'transaction.paid',
  'transaction.refunded',
  'transaction.canceled',
  
  // PIX específicos
  'pix.paid',
  'pix.refunded',
  'pix.expired',
];

/**
 * Valida Basic Auth do webhook do Pagar.me
 * Formato: Authorization: Basic base64(user:password)
 */
function validateBasicAuth(
  authHeader: string | null,
  expectedUser: string,
  expectedPassword: string
): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6); // Remove 'Basic '
    const credentials = atob(base64Credentials);
    const [user, password] = credentials.split(':');
    
    return user === expectedUser && password === expectedPassword;
  } catch {
    return false;
  }
}

/**
 * Valida a assinatura HMAC do webhook do Pagar.me
 * O Pagar.me envia a assinatura no header x-hub-signature ou x-pagarme-signature
 */
function validateSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.log('[PAGARME-WEBHOOK] Assinatura ou secret ausente');
    return false;
  }

  try {
    // O Pagar.me usa HMAC-SHA256 ou HMAC-SHA1
    // Formato: sha256=xxxx ou sha1=xxxx
    const parts = signature.split('=');
    const algorithm = parts[0] || 'sha256';
    const providedHash = parts[1] || signature;

    const hmac = createHmac(algorithm, secret);
    hmac.update(payload);
    const computedHash = hmac.digest('hex');

    // Comparação segura contra timing attacks
    const providedBuffer = new TextEncoder().encode(providedHash);
    const computedBuffer = new TextEncoder().encode(computedHash);

    if (providedBuffer.length !== computedBuffer.length) {
      console.log('[PAGARME-WEBHOOK] Tamanho de hash diferente');
      return false;
    }

    const isValid = timingSafeEqual(providedBuffer, computedBuffer);
    
    if (!isValid) {
      console.log('[PAGARME-WEBHOOK] Hash não corresponde');
    }
    
    return isValid;
  } catch (error) {
    console.error('[PAGARME-WEBHOOK] Erro ao validar assinatura:', error);
    return false;
  }
}

/**
 * Trunca payload para log seguro
 */
function truncateForLog(data: unknown, maxLength = 5000): string {
  const str = JSON.stringify(data);
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '... [TRUNCADO]';
}

/**
 * Remove dados sensíveis do payload para log
 */
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...payload };
  
  // Remover dados de cartão se presentes
  const sensitiveKeys = [
    'card_number', 'card_cvv', 'cvv', 'security_code',
    'holder_document', 'cpf', 'password', 'secret_key',
    'sk_', 'ak_'
  ];
  
  const sanitizeObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const shouldMask = sensitiveKeys.some(sk => keyLower.includes(sk));
      
      if (shouldMask) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = sanitizeObject(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'object' && item !== null 
            ? sanitizeObject(item as Record<string, unknown>) 
            : item
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  };
  
  return sanitizeObject(sanitized);
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  console.log(`[PAGARME-WEBHOOK][${requestId}] Requisição recebida: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[PAGARME-WEBHOOK][${requestId}] Preflight CORS OK`);
    return new Response('ok', { headers: corsHeaders });
  }

  // Apenas POST permitido
  if (req.method !== 'POST') {
    console.log(`[PAGARME-WEBHOOK][${requestId}] Método não permitido: ${req.method}`);
    return new Response(
      JSON.stringify({ success: false, code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Ler payload raw para validação de assinatura
    const rawPayload = await req.text();
    
    if (!rawPayload || rawPayload.length === 0) {
      console.log(`[PAGARME-WEBHOOK][${requestId}] Payload vazio`);
      return new Response(
        JSON.stringify({ success: false, code: 'EMPTY_PAYLOAD', message: 'Payload vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter credenciais de autenticação
    const webhookUser = Deno.env.get('PAGARME_WEBHOOK_USER');
    const webhookSecret = Deno.env.get('PAGARME_WEBHOOK_SECRET');
    const authHeader = req.headers.get('Authorization');

    // Validar autenticação (Basic Auth ou HMAC)
    let isAuthenticated = false;

    // Método 1: Basic Auth (preferido pelo Pagar.me)
    if (webhookUser && webhookSecret && authHeader) {
      isAuthenticated = validateBasicAuth(authHeader, webhookUser, webhookSecret);
      if (isAuthenticated) {
        console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Autenticação Basic Auth validada`);
      }
    }

    // Método 2: HMAC Signature (fallback)
    if (!isAuthenticated && webhookSecret) {
      const signature = 
        req.headers.get('x-hub-signature') || 
        req.headers.get('x-pagarme-signature') ||
        req.headers.get('x-signature') ||
        req.headers.get('x-webhook-signature');

      if (signature) {
        isAuthenticated = validateSignature(rawPayload, signature, webhookSecret);
        if (isAuthenticated) {
          console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Autenticação HMAC validada`);
        }
      }
    }

    // Se nenhum método de auth está configurado, aceitar (desenvolvimento)
    if (!webhookUser && !webhookSecret) {
      console.log(`[PAGARME-WEBHOOK][${requestId}] ⚠️ Nenhuma autenticação configurada - aceitando para desenvolvimento`);
      isAuthenticated = true;
    }

    if (!isAuthenticated) {
      console.log(`[PAGARME-WEBHOOK][${requestId}] ❌ Autenticação falhou`);
      return new Response(
        JSON.stringify({ success: false, code: 'UNAUTHORIZED', message: 'Webhook não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear JSON
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawPayload);
    } catch (parseError) {
      console.error(`[PAGARME-WEBHOOK][${requestId}] Erro ao parsear JSON:`, parseError);
      return new Response(
        JSON.stringify({ ok: false, erro: 'JSON malformado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair informações do evento
    const eventType = (payload.type || payload.event || payload.event_type || 'unknown') as string;
    const eventId = (payload.id || payload.event_id || requestId) as string;
    
    // Dados da cobrança/pedido (estrutura pode variar)
    const data = (payload.data || payload.object || payload) as Record<string, unknown>;
    const chargeId = data.id || data.charge_id || data.order_id || null;
    const amount = data.amount || data.paid_amount || null;
    const status = data.status || null;
    const paymentMethod = data.payment_method || data.method || null;
    const createdAt = data.created_at || payload.created_at || new Date().toISOString();

    console.log(`[PAGARME-WEBHOOK][${requestId}] Evento: ${eventType}`);
    console.log(`[PAGARME-WEBHOOK][${requestId}] ID da cobrança/pedido: ${chargeId}`);
    console.log(`[PAGARME-WEBHOOK][${requestId}] Valor: ${amount}`);
    console.log(`[PAGARME-WEBHOOK][${requestId}] Status: ${status}`);
    console.log(`[PAGARME-WEBHOOK][${requestId}] Método: ${paymentMethod}`);

    // Verificar se é um evento suportado
    const isSupported = SUPPORTED_EVENTS.some(e => eventType.includes(e.split('.')[0]));
    
    if (!isSupported) {
      console.log(`[PAGARME-WEBHOOK][${requestId}] Evento não suportado: ${eventType} (ignorando)`);
      // Retornamos 200 mesmo assim para não causar retries
      return new Response(
        JSON.stringify({ ok: true, mensagem: 'Evento ignorado (não suportado)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =================================================================
    // 🧠 REGRA DE OURO - Lógica de Emissão Fiscal baseada em pagamento
    // =================================================================
    let acaoFiscal: 'liberar' | 'bloquear' | 'nenhuma' = 'nenhuma';
    
    // Eventos de PAGAMENTO APROVADO -> Liberar emissão fiscal
    if (['charge.paid', 'order.paid', 'pix.paid', 'transaction.paid'].includes(eventType)) {
      acaoFiscal = 'liberar';
      console.log(`[PAGARME-WEBHOOK][${requestId}] 🟢 PAGAMENTO APROVADO - Liberando emissão fiscal`);
    }
    
    // Eventos de FALHA/CANCELAMENTO/ESTORNO -> Bloquear ou cancelar emissão
    if ([
      'charge.payment_failed', 
      'charge.refunded', 
      'charge.canceled',
      'charge.chargedback',
      'order.payment_failed',
      'order.canceled',
      'transaction.refunded',
      'transaction.canceled',
      'pix.refunded',
      'pix.expired'
    ].includes(eventType)) {
      acaoFiscal = 'bloquear';
      console.log(`[PAGARME-WEBHOOK][${requestId}] 🔴 PAGAMENTO FALHOU/CANCELADO - Bloqueando emissão fiscal`);
    }

    // Log da ação fiscal determinada
    console.log(`[PAGARME-WEBHOOK][${requestId}] Ação fiscal: ${acaoFiscal.toUpperCase()}`);
    // =================================================================

    // Sanitizar payload para log
    const sanitizedPayload = sanitizePayload(payload);
    const truncatedPayload = truncateForLog(sanitizedPayload);

    console.log(`[PAGARME-WEBHOOK][${requestId}] Payload (sanitizado): ${truncatedPayload}`);

    // ============================================================
    // PROCESSAMENTO DO PAGAMENTO E ATUALIZAÇÃO DO BANCO
    // ============================================================
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Extrair charge_id do payload (estrutura do Pagar.me)
        const chargeIdFromPayload = 
          (data.id as string) || 
          ((data as any).charges?.[0]?.id) ||
          (payload.data as any)?.id ||
          null;

        console.log(`[PAGARME-WEBHOOK][${requestId}] Charge ID extraído: ${chargeIdFromPayload}`);

        // ============================================================
        // IDEMPOTÊNCIA: Verificar se já processamos este evento
        // ============================================================
        const { data: existingLog } = await supabase
          .from('fiscal_compliance_logs')
          .select('id')
          .eq('action_type', `webhook_${eventType}`)
          .contains('metadata', { event_id: eventId })
          .limit(1)
          .maybeSingle();

        if (existingLog) {
          console.log(`[PAGARME-WEBHOOK][${requestId}] ⚠️ Evento já processado anteriormente (idempotência)`);
          const processingTime = Date.now() - startTime;
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Evento já processado anteriormente',
              evento: eventType,
              id: eventId,
              acao_fiscal: acaoFiscal,
              idempotent: true,
              processado_em_ms: processingTime,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ============================================================
        // ATUALIZAR fiscal_wallet_transactions se for evento de pagamento
        // ============================================================
        if (chargeIdFromPayload && acaoFiscal !== 'nenhuma') {
          console.log(`[PAGARME-WEBHOOK][${requestId}] Buscando transação para charge_id: ${chargeIdFromPayload}`);

          // Buscar transação pendente relacionada a esta cobrança
          const { data: transactions } = await supabase
            .from('fiscal_wallet_transactions')
            .select('*')
            .eq('reference_type', 'pix_payment')
            .contains('metadata', { charge_id: chargeIdFromPayload })
            .order('created_at', { ascending: false })
            .limit(1);

          const transaction = transactions?.[0];

          if (transaction) {
            const metadata = transaction.metadata as Record<string, unknown>;
            const documentRef = metadata?.document_ref as string;
            const documentType = metadata?.document_type as string;
            const issuerId = metadata?.issuer_id as string;

            console.log(`[PAGARME-WEBHOOK][${requestId}] Transação encontrada: ${transaction.id}`);
            console.log(`[PAGARME-WEBHOOK][${requestId}] Documento: ${documentType} / ${documentRef}`);

            if (acaoFiscal === 'liberar') {
              // PAGAMENTO APROVADO - Atualizar transação
              const { error: updateError } = await supabase
                .from('fiscal_wallet_transactions')
                .update({
                  transaction_type: 'pix_paid',
                  metadata: {
                    ...metadata,
                    payment_status: 'paid',
                    paid_at: new Date().toISOString(),
                    webhook_event_id: eventId,
                    webhook_event_type: eventType,
                  },
                })
                .eq('id', transaction.id);

              if (updateError) {
                console.error(`[PAGARME-WEBHOOK][${requestId}] Erro ao atualizar transação:`, updateError);
              } else {
                console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Transação marcada como PAGA`);
              }

              // Se for NF-e, atualizar o status da emissão para permitir emissão
              if (documentType === 'nfe' && documentRef) {
                // Tentar encontrar a emissão pelo internal_ref ou id
                const { data: emission } = await supabase
                  .from('nfe_emissions')
                  .select('id, status, emission_context')
                  .or(`internal_ref.eq.${documentRef},id.eq.${documentRef}`)
                  .maybeSingle();

                if (emission) {
                  // Atualizar emission_context para indicar que pagamento foi realizado
                  const currentContext = (emission.emission_context || {}) as Record<string, unknown>;
                  const { error: emissionUpdateError } = await supabase
                    .from('nfe_emissions')
                    .update({
                      emission_context: {
                        ...currentContext,
                        payment_status: 'paid',
                        payment_charge_id: chargeIdFromPayload,
                        payment_confirmed_at: new Date().toISOString(),
                      },
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', emission.id);

                  if (!emissionUpdateError) {
                    console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Emissão NF-e ${emission.id} liberada para emissão`);
                  }
                }
              }

            } else if (acaoFiscal === 'bloquear') {
              // PAGAMENTO FALHOU/CANCELADO/ESTORNADO
              const newStatus = eventType.includes('refund') ? 'pix_refunded' : 
                                eventType.includes('cancel') ? 'pix_canceled' : 'pix_failed';

              const { error: updateError } = await supabase
                .from('fiscal_wallet_transactions')
                .update({
                  transaction_type: newStatus,
                  metadata: {
                    ...metadata,
                    payment_status: newStatus.replace('pix_', ''),
                    failed_at: new Date().toISOString(),
                    webhook_event_id: eventId,
                    webhook_event_type: eventType,
                  },
                })
                .eq('id', transaction.id);

              if (!updateError) {
                console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Transação marcada como ${newStatus}`);
              }
            }
          } else {
            console.log(`[PAGARME-WEBHOOK][${requestId}] ⚠️ Nenhuma transação encontrada para charge_id: ${chargeIdFromPayload}`);
          }
        }

        // ============================================================
        // REGISTRAR LOG DE COMPLIANCE (para idempotência)
        // ============================================================
        const { error: logError } = await supabase
          .from('fiscal_compliance_logs')
          .insert({
            action_type: `webhook_${eventType}`,
            metadata: {
              event_id: eventId,
              charge_id: chargeIdFromPayload,
              amount: amount,
              status: status,
              payment_method: paymentMethod,
              acao_fiscal: acaoFiscal,
              processed_at: new Date().toISOString(),
              source: 'pagarme',
            },
          });

        if (logError) {
          console.log(`[PAGARME-WEBHOOK][${requestId}] Log de compliance não registrado: ${logError.message}`);
        } else {
          console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Log de compliance registrado`);
        }
      }
    } catch (dbError) {
      // Erro de banco não deve impedir o retorno 200
      console.error(`[PAGARME-WEBHOOK][${requestId}] Erro ao processar no banco:`, dbError);
    }

    // Tempo de processamento
    const processingTime = Date.now() - startTime;
    console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Processado em ${processingTime}ms`);

    // Retornar sucesso rapidamente
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook recebido e processado',
        evento: eventType,
        id: eventId,
        acao_fiscal: acaoFiscal,
        processado_em_ms: processingTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[PAGARME-WEBHOOK][${requestId}] ❌ Erro interno:`, errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, code: 'INTERNAL_ERROR', message: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
