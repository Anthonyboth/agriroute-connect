import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, documentNumberSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GuestUserSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email').max(255, 'Email too long').optional(),
  phone: z.string().min(10, 'Invalid phone').max(20, 'Phone too long').optional(),
  document: documentNumberSchema,
  captchaToken: z.string().min(1, 'CAPTCHA token required').max(500, 'Token too long')
});

interface ValidateGuestRequest {
  name: string;
  email?: string;
  phone?: string;
  document: string;
  captchaToken: string;
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for') || 
         req.headers.get('cf-connecting-ip') || 
         'unknown';
}

async function verifyCaptcha(token: string): Promise<boolean> {
  const secretKey = Deno.env.get('HCAPTCHA_SECRET_KEY');
  
  if (!secretKey) {
    console.error('[SECURITY] HCAPTCHA_SECRET_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `response=${token}&secret=${secretKey}`,
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[SECURITY] CAPTCHA verification failed:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.json();
    const { name, email, phone, document, captchaToken } = validateInput(GuestUserSchema, rawBody);
    
    const clientIP = getClientIP(req);

    // 1. SECURITY: Verify CAPTCHA first (prevent automated attacks)
    if (!captchaToken) {
      return new Response(
        JSON.stringify({ 
          error: 'CAPTCHA verification required',
          message: 'Por favor, complete a verificação de segurança.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return new Response(
        JSON.stringify({ 
          error: 'CAPTCHA verification failed',
          message: 'Verificação de segurança falhou. Por favor, tente novamente.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // 2. SECURITY: Check rate limiting (3 attempts per hour per IP)
    const { data: rateLimitCheck } = await supabaseClient
      .rpc('check_guest_validation_rate_limit', { p_ip_address: clientIP });

    if (rateLimitCheck && !rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: `Você atingiu o limite de tentativas. Por favor, aguarde até ${new Date(rateLimitCheck.reset_at).toLocaleTimeString('pt-BR')} para tentar novamente.`,
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
          error: 'Invalid document',
          message: 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 5. SECURITY: Check if user exists BUT DON'T REVEAL THIS INFORMATION
    // This is for internal tracking only - we'll return a generic message regardless
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
      // Update existing prospect (don't create duplicate)
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
            has_registered_account: !!existingProfile // Track internally only
          }
        })
        .eq('id', existingProspect.id)
        .select('id')
        .single();

      prospectId = updatedProspect?.id || existingProspect.id;
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
            has_registered_account: !!existingProfile // Track internally only
          }
        })
        .select('id')
        .single();

      prospectId = newProspect?.id || '';
    }

    // 7. SECURITY: ALWAYS return the same generic success message
    // NEVER reveal whether the user exists or not
    // This prevents user enumeration attacks
    return new Response(
      JSON.stringify({ 
        success: true,
        prospect_id: prospectId,
        message: 'Informações recebidas com sucesso! Você receberá as próximas instruções em breve.',
        // Generic response that works for both new and existing users
        next_steps: 'Se você já possui uma conta, faça login para continuar. Caso contrário, aguarde as instruções de cadastro.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    // Handle validation errors (thrown as Response by validateInput)
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
      return new Response(error.body, { 
        status: error.status, 
        headers 
      });
    }
    
    console.error('[ERROR] validate-guest-user:', error);
    
    // SECURITY: Don't reveal internal error details
    return new Response(
      JSON.stringify({ 
        error: 'Internal error',
        message: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
