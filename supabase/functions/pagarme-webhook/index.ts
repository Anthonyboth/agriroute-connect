/**
 * Edge Function: pagarme-webhook
 * 
 * Webhook dedicado para receber eventos do Pagar.me (Stone)
 * Objetivo: Confirmar pagamento e registrar log
 * 
 * NÃO processa saldo/carteira - apenas registra eventos
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
 * Valida a assinatura do webhook do Pagar.me
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
      JSON.stringify({ ok: false, erro: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Ler payload raw para validação de assinatura
    const rawPayload = await req.text();
    
    if (!rawPayload || rawPayload.length === 0) {
      console.log(`[PAGARME-WEBHOOK][${requestId}] Payload vazio`);
      return new Response(
        JSON.stringify({ ok: false, erro: 'Payload vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter assinatura do header
    const signature = 
      req.headers.get('x-hub-signature') || 
      req.headers.get('x-pagarme-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('x-webhook-signature');

    // Obter secret
    const webhookSecret = Deno.env.get('PAGARME_WEBHOOK_SECRET');

    // Validar assinatura (se configurada)
    if (webhookSecret && webhookSecret.length > 0) {
      const isValidSignature = validateSignature(rawPayload, signature, webhookSecret);
      
      if (!isValidSignature) {
        console.log(`[PAGARME-WEBHOOK][${requestId}] ⚠️ Assinatura inválida - Tentativa de acesso não autorizado`);
        console.log(`[PAGARME-WEBHOOK][${requestId}] Header recebido: ${signature ? signature.substring(0, 20) + '...' : 'AUSENTE'}`);
        
        return new Response(
          JSON.stringify({ ok: false, erro: 'Assinatura inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Assinatura validada com sucesso`);
    } else {
      console.log(`[PAGARME-WEBHOOK][${requestId}] ⚠️ PAGARME_WEBHOOK_SECRET não configurado - aceitando sem validação`);
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

    // Sanitizar payload para log
    const sanitizedPayload = sanitizePayload(payload);
    const truncatedPayload = truncateForLog(sanitizedPayload);

    console.log(`[PAGARME-WEBHOOK][${requestId}] Payload (sanitizado): ${truncatedPayload}`);

    // Tentar registrar no banco (opcional - não falha se não conseguir)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verificar se existe tabela de logs de pagamento
        // Tentamos inserir em uma tabela genérica de logs se existir
        const logEntry = {
          event_type: eventType,
          event_id: eventId,
          charge_id: chargeId,
          amount: amount,
          status: status,
          payment_method: paymentMethod,
          payload: sanitizedPayload,
          created_at: createdAt,
          processed_at: new Date().toISOString(),
          source: 'pagarme',
        };

        // Tentar inserir em payment_webhook_logs se existir
        const { error: logError } = await supabase
          .from('payment_webhook_logs')
          .insert([logEntry]);

        if (logError) {
          // Tabela pode não existir, apenas logamos
          console.log(`[PAGARME-WEBHOOK][${requestId}] Tabela payment_webhook_logs não disponível: ${logError.message}`);
          console.log(`[PAGARME-WEBHOOK][${requestId}] Log apenas no console por enquanto`);
        } else {
          console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Log registrado no banco com sucesso`);
        }
      }
    } catch (dbError) {
      // Erro de banco não deve impedir o retorno 200
      console.error(`[PAGARME-WEBHOOK][${requestId}] Erro ao registrar log no banco:`, dbError);
    }

    // Tempo de processamento
    const processingTime = Date.now() - startTime;
    console.log(`[PAGARME-WEBHOOK][${requestId}] ✅ Processado em ${processingTime}ms`);

    // Retornar sucesso rapidamente
    return new Response(
      JSON.stringify({
        ok: true,
        mensagem: 'Webhook recebido e registrado',
        evento: eventType,
        id: eventId,
        processado_em_ms: processingTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[PAGARME-WEBHOOK][${requestId}] ❌ Erro interno:`, errorMessage);
    
    return new Response(
      JSON.stringify({ ok: false, erro: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
