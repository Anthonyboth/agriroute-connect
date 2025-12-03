import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TokenRequestSchema = z.object({
  token: z.string().min(10, 'Invalid token').max(100, 'Token too long')
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const rawBody = await req.json()
    const validatedInput = validateInput(TokenRequestSchema, rawBody)
    const { token } = validatedInput

    console.log('[VALIDAR-TOKEN] Token validado via Zod, buscando convite...')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar convite
    const { data: convite, error } = await supabaseClient
      .from('convites_motoristas')
      .select(`
        id,
        transportadora_id,
        token,
        expira_em,
        usado,
        transportadora:profiles!convites_motoristas_transportadora_id_fkey(
          id,
          full_name
        ),
        empresa:transport_companies!inner(
          company_name,
          company_cnpj
        )
      `)
      .eq('token', token)
      .single()

    if (error || !convite) {
      console.log('[VALIDAR-TOKEN] Convite não encontrado:', error)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Convite não encontrado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Verificar validade
    const now = new Date()
    const expiraEm = new Date(convite.expira_em)

    if (convite.usado) {
      console.log('[VALIDAR-TOKEN] Convite já utilizado')
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Este convite já foi utilizado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (expiraEm < now) {
      console.log('[VALIDAR-TOKEN] Convite expirado')
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Este convite expirou. Solicite um novo link à transportadora.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('[VALIDAR-TOKEN] Convite válido')
    return new Response(
      JSON.stringify({
        valid: true,
        convite_id: convite.id,
        transportadora_id: convite.transportadora_id,
        transportadora_nome: convite.transportadora?.full_name,
        empresa_nome: convite.empresa?.company_name,
        expira_em: convite.expira_em
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[VALIDAR-TOKEN] Erro:', error)
    return new Response(
      JSON.stringify({ valid: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
