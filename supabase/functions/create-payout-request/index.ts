import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema, amountSchema, pixKeySchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PayoutRequestSchema = z.object({
  driver_id: uuidSchema,
  amount: amountSchema.min(50, 'Amount must be at least R$ 50'),
  pix_key: pixKeySchema
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Não autorizado')
    }

    const body = await req.json()
    const validated = validateInput(PayoutRequestSchema, body)
    const { driver_id, amount, pix_key } = validated

    // Validar se o usuário é o motorista
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('id', driver_id)
      .single()

    if (profileError || !profile || profile.role !== 'MOTORISTA') {
      throw new Error('Acesso negado')
    }

    // Criar solicitação de saque
    const { data: request, error: insertError } = await supabase
      .from('driver_payout_requests')
      .insert({
        driver_id,
        amount,
        pix_key,
        status: 'PENDING'
      })
      .select()
      .single()

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ success: true, request }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})