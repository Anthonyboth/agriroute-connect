import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Rate Limit Config ───
const RATE_LIMIT_IP_WINDOW_MIN = 30;
const RATE_LIMIT_IP_MAX = 3;
const RATE_LIMIT_PHONE_WINDOW_HOURS = 24;
const RATE_LIMIT_PHONE_MAX = 2;

// ─── Logging ───
const log = (step: string, details?: unknown) => {
  const ts = new Date().toISOString();
  const d = details ? ` — ${JSON.stringify(details)}` : '';
  console.log(`[${ts}] [CREATE-GUEST-RURAL-FREIGHT] ${step}${d}`);
};

// ─── Helpers ───
function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown';
}

function buildFingerprint(req: Request): string {
  const ua = req.headers.get('user-agent') || '';
  const lang = req.headers.get('accept-language') || '';
  const enc = req.headers.get('accept-encoding') || '';
  return simpleHash(`${ua}|${lang}|${enc}`);
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function hashPII(value: string): string {
  // Simple deterministic hash for PII - not crypto-grade but good for rate limiting
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

// ─── Phone validation BR ───
function validateBRPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // DDD (2 dígitos) + 9 dígitos (celular) ou 8 dígitos (fixo)
  return /^[1-9]{2}9?\d{8}$/.test(digits) && (digits.length === 10 || digits.length === 11);
}

// ─── CPF Validation ───
function validateCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let r = sum % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(cpf.charAt(9)) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  r = sum % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(cpf.charAt(10)) === d2;
}

// ─── CNPJ Validation ───
function validateCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  let sum = 0, w = 2;
  for (let i = 11; i >= 0; i--) { sum += parseInt(cnpj.charAt(i)) * w; w = w === 9 ? 2 : w + 1; }
  let r = sum % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(cnpj.charAt(12)) !== d1) return false;
  sum = 0; w = 2;
  for (let i = 12; i >= 0; i--) { sum += parseInt(cnpj.charAt(i)) * w; w = w === 9 ? 2 : w + 1; }
  r = sum % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(cnpj.charAt(13)) === d2;
}

function isValidDocument(doc: string): boolean {
  const n = doc.replace(/\D/g, '');
  if (n.length === 11) return validateCPF(n);
  if (n.length === 14) return validateCNPJ(n);
  return false;
}

// ─── HTML/XSS Sanitization ───
function stripHtml(input: string): string {
  // Remove HTML tags, script content, and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>') // decode then re-strip
    .replace(/<[^>]*>/g, '')
    .trim();
}

function sanitizeTextField(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = stripHtml(value);
  return cleaned.length > 0 ? cleaned : null;
}

// ─── CAPTCHA ───
async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = Deno.env.get('HCAPTCHA_SECRET_KEY');
  if (!secret) { log('HCAPTCHA_SECRET_KEY não configurada — CAPTCHA desabilitado'); return true; }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `response=${token}&secret=${secret}`,
      signal: ctrl.signal
    });
    clearTimeout(tid);
    const data = await res.json();
    log('CAPTCHA resultado', { success: data.success });
    return data.success === true;
  } catch (e) {
    clearTimeout(tid);
    log('CAPTCHA erro', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

// ─── Schema ───
const GuestRuralFreightSchema = z.object({
  // Guest contact
  guest_name: z.string().trim().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome muito longo'),
  guest_phone: z.string().trim().min(10, 'Telefone inválido').max(20, 'Telefone muito longo'),
  guest_email: z.string().trim().max(255).optional().transform(v => v === '' ? undefined : v).pipe(z.string().email('E-mail inválido').optional()),
  guest_document: z.string().trim().min(11, 'Documento inválido').max(20, 'Documento muito longo'),
  captcha_token: z.string().min(1).max(2000).optional(),
  // Freight data
  cargo_type: z.string().min(1, 'Tipo de carga obrigatório').max(100),
  service_type: z.string().max(50).default('CARGA'),
  weight: z.number().min(1, 'Peso deve ser > 0').max(500000, 'Peso inválido'),
  origin_address: z.string().max(500).optional(),
  origin_city: z.string().min(1, 'Cidade de origem obrigatória').max(200),
  origin_state: z.string().min(2).max(50),
  origin_city_id: z.string().uuid().optional().nullable(),
  origin_lat: z.number().min(-90).max(90).optional().nullable(),
  origin_lng: z.number().min(-180).max(180).optional().nullable(),
  origin_neighborhood: z.string().max(200).optional().nullable(),
  origin_street: z.string().max(200).optional().nullable(),
  origin_number: z.string().max(20).optional().nullable(),
  origin_complement: z.string().max(200).optional().nullable(),
  destination_address: z.string().max(500).optional(),
  destination_city: z.string().min(1, 'Cidade de destino obrigatória').max(200),
  destination_state: z.string().min(2).max(50),
  destination_city_id: z.string().uuid().optional().nullable(),
  destination_lat: z.number().min(-90).max(90).optional().nullable(),
  destination_lng: z.number().min(-180).max(180).optional().nullable(),
  destination_neighborhood: z.string().max(200).optional().nullable(),
  destination_street: z.string().max(200).optional().nullable(),
  destination_number: z.string().max(20).optional().nullable(),
  destination_complement: z.string().max(200).optional().nullable(),
  distance_km: z.number().min(0).max(50000).optional().default(0),
  minimum_antt_price: z.number().min(0).optional().nullable(),
  price: z.number().min(1, 'Valor do frete deve ser > 0').max(10000000),
  price_per_km: z.number().min(0).optional().nullable(),
  pricing_type: z.enum(['FIXED', 'PER_KM', 'PER_TON']).default('PER_KM'),
  required_trucks: z.number().int().min(1).max(100).default(1),
  pickup_date: z.string().min(1, 'Data de coleta obrigatória'),
  delivery_date: z.string().min(1, 'Data de entrega obrigatória'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  description: z.string().max(2000).optional().nullable(),
  vehicle_type_required: z.string().max(50).optional().nullable(),
  vehicle_axles_required: z.number().int().min(2).max(9).optional().nullable(),
  high_performance: z.boolean().default(false),
  visibility_type: z.enum(['ALL', 'TRANSPORTADORAS_ONLY', 'RATING_MINIMUM']).default('ALL'),
  min_driver_rating: z.number().min(0).max(5).optional().nullable(),
});

// ─── Error response helper ───
function errorResponse(message: string, code: string, status: number, details?: unknown) {
  return new Response(
    JSON.stringify({ error: message, code, ...(details ? { details } : {}) }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const fingerprint = buildFingerprint(req);
  const userAgent = req.headers.get('user-agent') || '';

  try {
    log('Início', { ip: clientIP, fingerprint });

    // ─── Parse body ───
    const rawBody = await req.json();

    // ─── Validate schema ───
    const parseResult = GuestRuralFreightSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      log('Validação falhou', { errors: fieldErrors });
      return errorResponse('Dados inválidos. Verifique os campos e tente novamente.', 'VALIDATION_FAILED', 400, fieldErrors);
    }
    const data = parseResult.data;

    // ─── Validate phone BR ───
    if (!validateBRPhone(data.guest_phone)) {
      log('Telefone inválido', { phone: data.guest_phone.slice(0, 4) + '****' });
      return errorResponse('Telefone inválido. Informe um número brasileiro com DDD.', 'INVALID_PHONE', 400);
    }

    // ─── Validate document ───
    if (!isValidDocument(data.guest_document)) {
      log('Documento inválido');
      return errorResponse('CPF ou CNPJ inválido. Verifique o número informado.', 'INVALID_DOCUMENT', 400);
    }

    // ─── Validate pickup_date >= today ───
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pickupDate = new Date(data.pickup_date);
    if (pickupDate < today) {
      return errorResponse('A data de coleta não pode ser no passado.', 'INVALID_PICKUP_DATE', 400);
    }

    // ─── Validate pricing coherence ───
    if (data.pricing_type === 'PER_KM' && (!data.distance_km || data.distance_km <= 0)) {
      log('Distância obrigatória para PER_KM mas ausente');
      // Allow but mark as pending - distance can be calculated later
    }
    if (data.pricing_type === 'PER_TON' && (!data.weight || data.weight <= 0)) {
      return errorResponse('Peso obrigatório para precificação por tonelada.', 'MISSING_WEIGHT', 400);
    }

    // ─── CAPTCHA ───
    if (data.captcha_token) {
      const captchaOk = await verifyCaptcha(data.captcha_token);
      if (!captchaOk) {
        return errorResponse('Verificação de segurança falhou. Tente novamente.', 'CAPTCHA_FAILED', 403);
      }
    }

    // ─── Supabase admin client ───
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // ─── Rate limit: IP + fingerprint ───
    const windowIP = new Date(Date.now() - RATE_LIMIT_IP_WINDOW_MIN * 60 * 1000).toISOString();
    const { count: ipCount } = await supabaseAdmin
      .from('guest_freight_security_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', clientIP)
      .eq('result', 'ALLOWED')
      .gte('created_at', windowIP);

    if ((ipCount ?? 0) >= RATE_LIMIT_IP_MAX) {
      log('Rate limit IP excedido', { ip: clientIP, count: ipCount });
      // Log blocked attempt
      await supabaseAdmin.from('guest_freight_security_log').insert({
        ip: clientIP, user_agent: userAgent, fingerprint_hash: fingerprint,
        phone_hash: hashPII(data.guest_phone), document_hash: hashPII(data.guest_document),
        result: 'BLOCKED', reason_code: 'RATE_LIMIT_IP',
        metadata: { limit: RATE_LIMIT_IP_MAX, window_min: RATE_LIMIT_IP_WINDOW_MIN }
      });
      return errorResponse(
        `Limite de solicitações atingido. Aguarde ${RATE_LIMIT_IP_WINDOW_MIN} minutos e tente novamente.`,
        'RATE_LIMITED', 429
      );
    }

    // ─── Rate limit: phone/document (24h) ───
    const phoneHash = hashPII(data.guest_phone);
    const docHash = hashPII(data.guest_document);
    const window24h = new Date(Date.now() - RATE_LIMIT_PHONE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const { count: phoneCount } = await supabaseAdmin
      .from('guest_freight_security_log')
      .select('id', { count: 'exact', head: true })
      .eq('phone_hash', phoneHash)
      .eq('result', 'ALLOWED')
      .gte('created_at', window24h);

    if ((phoneCount ?? 0) >= RATE_LIMIT_PHONE_MAX) {
      log('Rate limit telefone excedido', { phoneHash, count: phoneCount });
      await supabaseAdmin.from('guest_freight_security_log').insert({
        ip: clientIP, user_agent: userAgent, fingerprint_hash: fingerprint,
        phone_hash: phoneHash, document_hash: docHash,
        result: 'BLOCKED', reason_code: 'RATE_LIMIT_PHONE',
        metadata: { limit: RATE_LIMIT_PHONE_MAX, window_hours: RATE_LIMIT_PHONE_WINDOW_HOURS }
      });
      return errorResponse(
        'Este telefone já atingiu o limite de solicitações nas últimas 24 horas. Tente novamente amanhã.',
        'RATE_LIMITED_PHONE', 429
      );
    }

    // ─── Anti-fraud score (simple) ───
    let fraudScore = 0;
    let fraudReasons: string[] = [];

    // Check fingerprint velocity (same fingerprint, multiple IPs)
    const { count: fpCount } = await supabaseAdmin
      .from('guest_freight_security_log')
      .select('id', { count: 'exact', head: true })
      .eq('fingerprint_hash', fingerprint)
      .eq('result', 'ALLOWED')
      .gte('created_at', windowIP);

    if ((fpCount ?? 0) >= 2) {
      fraudScore += 30;
      fraudReasons.push('FINGERPRINT_VELOCITY');
    }

    // Check document reuse across different phones
    const { count: docReuse } = await supabaseAdmin
      .from('guest_freight_security_log')
      .select('id', { count: 'exact', head: true })
      .eq('document_hash', docHash)
      .neq('phone_hash', phoneHash)
      .gte('created_at', window24h);

    if ((docReuse ?? 0) >= 1) {
      fraudScore += 20;
      fraudReasons.push('DOC_PHONE_MISMATCH');
    }

    const result = fraudScore >= 50 ? 'REVIEW' : 'ALLOWED';
    log('Antifraude', { score: fraudScore, result, reasons: fraudReasons });

    // ─── Prospect user (create or find) ───
    const normalizedDoc = data.guest_document.replace(/\D/g, '');
    let prospectId: string | null = null;

    const { data: existingProspect } = await supabaseAdmin
      .from('prospect_users')
      .select('id, total_requests')
      .eq('document', normalizedDoc)
      .maybeSingle();

    if (existingProspect) {
      await supabaseAdmin.from('prospect_users').update({
        full_name: data.guest_name,
        email: data.guest_email || null,
        phone: data.guest_phone,
        last_request_date: new Date().toISOString(),
        total_requests: (existingProspect.total_requests || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', existingProspect.id);
      prospectId = existingProspect.id;
      log('Prospect atualizado', { id: prospectId });
    } else {
      const documentType = normalizedDoc.length === 11 ? 'CPF' : 'CNPJ';
      const { data: newProspect } = await supabaseAdmin.from('prospect_users').insert({
        full_name: data.guest_name,
        email: data.guest_email || null,
        phone: data.guest_phone,
        document: normalizedDoc,
        document_type: documentType,
        total_requests: 1,
        metadata: { source: 'guest_rural_freight', created_via: 'edge_function' }
      }).select('id').single();
      prospectId = newProspect?.id || null;
      log('Prospect criado', { id: prospectId });
    }

    // ─── If REVIEW, don't create freight ───
    if (result === 'REVIEW') {
      await supabaseAdmin.from('guest_freight_security_log').insert({
        ip: clientIP, user_agent: userAgent, fingerprint_hash: fingerprint,
        phone_hash: phoneHash, document_hash: docHash,
        result: 'REVIEW', reason_code: fraudReasons.join(','),
        metadata: { score: fraudScore, prospect_id: prospectId }
      });
      log('Frete em revisão — NÃO criado', { score: fraudScore });
      // Return success to not reveal moderation to potential abuser
      return new Response(
        JSON.stringify({
          success: true,
          freight_id: null,
          status: 'REVIEW',
          requester_type: 'GUEST',
          message: 'Solicitação recebida! Estamos processando e você será notificado em breve.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ─── Sanitize text fields before insertion ───
    const safeName = stripHtml(data.guest_name);
    const safeCargoType = stripHtml(data.cargo_type);
    const safeDescription = sanitizeTextField(data.description);
    const safeOriginAddress = sanitizeTextField(data.origin_address);
    const safeDestAddress = sanitizeTextField(data.destination_address);
    const safeOriginNeighborhood = sanitizeTextField(data.origin_neighborhood);
    const safeOriginStreet = sanitizeTextField(data.origin_street);
    const safeOriginNumber = sanitizeTextField(data.origin_number);
    const safeOriginComplement = sanitizeTextField(data.origin_complement);
    const safeDestNeighborhood = sanitizeTextField(data.destination_neighborhood);
    const safeDestStreet = sanitizeTextField(data.destination_street);
    const safeDestNumber = sanitizeTextField(data.destination_number);
    const safeDestComplement = sanitizeTextField(data.destination_complement);

    // ─── Create freight (service_role bypasses RLS) ───
    const freightInsert: Record<string, unknown> = {
      producer_id: null,
      is_guest_freight: true,
      prospect_user_id: prospectId,
      cargo_type: safeCargoType,
      service_type: data.service_type,
      weight: data.weight,
      origin_address: safeOriginAddress || `${data.origin_city} — ${data.origin_state}`,
      origin_city: stripHtml(data.origin_city),
      origin_state: (data.origin_state || '').trim().toUpperCase().substring(0, 2),
      origin_city_id: data.origin_city_id || null,
      origin_lat: data.origin_lat || null,
      origin_lng: data.origin_lng || null,
      origin_neighborhood: safeOriginNeighborhood,
      origin_street: safeOriginStreet,
      origin_number: safeOriginNumber,
      origin_complement: safeOriginComplement,
      destination_address: safeDestAddress || `${data.destination_city} — ${data.destination_state}`,
      destination_city: stripHtml(data.destination_city),
      destination_state: (data.destination_state || '').trim().toUpperCase().substring(0, 2),
      destination_city_id: data.destination_city_id || null,
      destination_lat: data.destination_lat || null,
      destination_lng: data.destination_lng || null,
      destination_neighborhood: safeDestNeighborhood,
      destination_street: safeDestStreet,
      destination_number: safeDestNumber,
      destination_complement: safeDestComplement,
      distance_km: data.distance_km || 0,
      minimum_antt_price: data.minimum_antt_price || null,
      price: data.price,
      price_per_km: data.price_per_km || null,
      pricing_type: data.pricing_type || 'FIXED',
      required_trucks: data.required_trucks,
      accepted_trucks: 0,
      pickup_date: data.pickup_date,
      delivery_date: data.delivery_date,
      urgency: data.urgency,
      description: safeDescription,
      vehicle_type_required: sanitizeTextField(data.vehicle_type_required),
      vehicle_axles_required: data.vehicle_axles_required || null,
      high_performance: data.high_performance,
      status: 'OPEN',
      visibility_type: data.visibility_type,
      min_driver_rating: data.min_driver_rating || null,
      guest_contact_name: safeName,
      guest_contact_phone: data.guest_phone,
      guest_contact_email: data.guest_email || null,
      guest_contact_document: data.guest_document,
    };

    const { data: insertedFreight, error: insertError } = await supabaseAdmin
      .from('freights')
      .insert([freightInsert])
      .select('id')
      .single();

    if (insertError) {
      log('ERRO ao inserir frete', { error: insertError.message, code: insertError.code });
      await supabaseAdmin.from('guest_freight_security_log').insert({
        ip: clientIP, user_agent: userAgent, fingerprint_hash: fingerprint,
        phone_hash: phoneHash, document_hash: docHash,
        result: 'BLOCKED', reason_code: 'INSERT_FAILED',
        metadata: { error: insertError.message }
      });
      return errorResponse('Erro ao criar frete. Tente novamente.', 'INSERT_FAILED', 500);
    }

    const freightId = insertedFreight!.id;
    log('Frete criado', { freight_id: freightId });

    // ─── Log success ───
    await supabaseAdmin.from('guest_freight_security_log').insert({
      freight_id: freightId,
      ip: clientIP, user_agent: userAgent, fingerprint_hash: fingerprint,
      phone_hash: phoneHash, document_hash: docHash,
      result: 'ALLOWED', reason_code: 'PASSED',
      metadata: { score: fraudScore, prospect_id: prospectId }
    });

    // ─── Spatial matching (fire and forget, don't block response) ───
    let matchingResult = null;
    try {
      const matchRes = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/spatial-freight-matching`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ freight_id: freightId, notify_drivers: true }),
        }
      );
      if (matchRes.ok) {
        matchingResult = await matchRes.json();
        log('Matching executado', { matches: matchingResult?.total_matches ?? 0 });
      } else {
        const errText = await matchRes.text();
        log('Matching falhou', { status: matchRes.status, error: errText.slice(0, 200) });
      }
    } catch (matchErr) {
      log('Matching exceção', { error: matchErr instanceof Error ? matchErr.message : String(matchErr) });
    }

    return new Response(
      JSON.stringify({
        success: true,
        freight_id: freightId,
        status: 'OPEN',
        requester_type: 'GUEST',
        matching: matchingResult,
        message: 'Frete criado com sucesso! Motoristas da região serão notificados.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    log('ERRO inesperado', { error: error instanceof Error ? error.message : String(error) });
    return errorResponse(
      'Ocorreu um erro ao processar sua solicitação. Tente novamente.',
      'INTERNAL_ERROR', 500
    );
  }
});
