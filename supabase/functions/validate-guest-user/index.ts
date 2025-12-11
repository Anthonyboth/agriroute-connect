import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, documentNumberSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GuestUserSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome muito longo'),
  email: z.string().max(255, 'Email muito longo').optional().transform(val => val === '' ? undefined : val).pipe(z.string().email('Email inválido').optional()),
  phone: z.string().min(10, 'Telefone inválido').max(20, 'Telefone muito longo').optional().transform(val => val === '' ? undefined : val),
  document: documentNumberSchema,
  captchaToken: z.string().min(1, 'Token CAPTCHA necessário').max(500, 'Token muito longo').optional()
});

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [VALIDATE-GUEST-USER] ${step}${detailsStr}`);
};

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for') || 
         req.headers.get('cf-connecting-ip') || 
         'unknown';
}

async function verifyCaptcha(token: string): Promise<boolean> {
  const secretKey = Deno.env.get('HCAPTCHA_SECRET_KEY');
  
  if (!secretKey) {
    logStep('HCAPTCHA_SECRET_KEY não configurada - CAPTCHA desabilitado');
    return true; // Permitir se não configurado (para dev)
  }

  // ✅ CORRIGIDO: Adicionar timeout na verificação do CAPTCHA
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `response=${token}&secret=${secretKey}`,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    logStep('Resposta CAPTCHA', { success: data.success });
    return data.success === true;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logStep('Timeout na verificação CAPTCHA');
    } else {
      logStep('Erro na verificação CAPTCHA', { error: error instanceof Error ? error.message : String(error) });
    }
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Função iniciada');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.json();
    const { name, email, phone, document, captchaToken } = validateInput(GuestUserSchema, rawBody);
    
    const clientIP = getClientIP(req);
    logStep('Validando usuário convidado', { name, clientIP });

    // 1. SECURITY: Verify CAPTCHA if provided
    if (captchaToken) {
      const captchaValid = await verifyCaptcha(captchaToken);
      if (!captchaValid) {
        return new Response(
          JSON.stringify({ 
            error: 'Verificação CAPTCHA falhou',
            message: 'Verificação de segurança falhou. Por favor, tente novamente.',
            code: 'CAPTCHA_FAILED'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }

    // 2. SECURITY: Check rate limiting (3 attempts per hour per IP)
    const { data: rateLimitCheck } = await supabaseClient
      .rpc('check_guest_validation_rate_limit', { p_ip_address: clientIP });

    if (rateLimitCheck && !rateLimitCheck.allowed) {
      logStep('Rate limit atingido', { ip: clientIP, attempts: rateLimitCheck.current_attempts });
      return new Response(
        JSON.stringify({ 
          error: 'Limite de tentativas excedido',
          message: `Você atingiu o limite de tentativas. Por favor, aguarde até ${new Date(rateLimitCheck.reset_at).toLocaleTimeString('pt-BR')} para tentar novamente.`,
          code: 'RATE_LIMITED',
          retry_after: rateLimitCheck.reset_at,
          current_attempts: rateLimitCheck.current_attempts,
          max_allowed: rateLimitCheck.max_allowed
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // 3. Normalize document (remove special characters)
    const normalizedDoc = document.replace(/\D/g, '');
    
    // 4. Validate CPF/CNPJ format
    const documentType = normalizedDoc.length === 11 ? 'CPF' : 
                        normalizedDoc.length === 14 ? 'CNPJ' : null;
    
    if (!documentType) {
      return new Response(
        JSON.stringify({ 
          error: 'Documento inválido',
          message: 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).',
          code: 'INVALID_DOCUMENT'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 5. SECURITY: Check if user exists BUT DON'T REVEAL THIS INFORMATION
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id, user_id')
      .eq('document', normalizedDoc)
      .maybeSingle();

    // 6. Check if prospect already exists
    const { data: existingProspect } = await supabaseClient
      .from('prospect_users')
      .select('*')
      .eq('document', normalizedDoc)
      .maybeSingle();

    let prospectId: string;

    if (existingProspect) {
      // Update existing prospect
      const { data: updatedProspect } = await supabaseClient
        .from('prospect_users')
        .update({
          full_name: name,
          email: email || existingProspect.email,
          phone: phone,
          last_request_date: new Date().toISOString(),
          total_requests: (existingProspect.total_requests || 0) + 1,
          updated_at: new Date().toISOString(),
          metadata: {
            ...existingProspect.metadata,
            ip_address: clientIP,
            user_agent: req.headers.get('user-agent'),
            last_captcha_verified: new Date().toISOString(),
            has_registered_account: !!existingProfile
          }
        })
        .eq('id', existingProspect.id)
        .select('id')
        .single();

      prospectId = updatedProspect?.id || existingProspect.id;
      logStep('Prospect atualizado', { prospectId });
    } else {
      // Create new prospect
      const { data: newProspect } = await supabaseClient
        .from('prospect_users')
        .insert({
          full_name: name,
          email: email,
          phone: phone,
          document: normalizedDoc,
          document_type: documentType,
          total_requests: 1,
          metadata: {
            ip_address: clientIP,
            user_agent: req.headers.get('user-agent'),
            first_captcha_verified: new Date().toISOString(),
            has_registered_account: !!existingProfile
          }
        })
        .select('id')
        .single();

      prospectId = newProspect?.id || '';
      logStep('Prospect criado', { prospectId });
    }

    // 7. SECURITY: ALWAYS return the same generic success message
    return new Response(
      JSON.stringify({ 
        success: true,
        prospect_id: prospectId,
        message: 'Informações recebidas com sucesso! Você receberá as próximas instruções em breve.',
        next_steps: 'Se você já possui uma conta, faça login para continuar. Caso contrário, aguarde as instruções de cadastro.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    // Handle validation errors
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
      return new Response(error.body, { 
        status: error.status, 
        headers 
      });
    }
    
    logStep('ERRO', { error: error instanceof Error ? error.message : String(error) });
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno',
        message: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.',
        code: 'INTERNAL_ERROR'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
