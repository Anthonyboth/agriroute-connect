import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Aceitar parâmetros tanto de query string quanto do body (POST)
    let status: string | null = null;
    let freight_id: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        status = body.status || null;
        freight_id = body.freight_id || null;
      } catch {
        // Body vazio é ok
      }
    } else {
      const url = new URL(req.url);
      status = url.searchParams.get('status');
      freight_id = url.searchParams.get('freight_id');
    }

    let query = supabaseClient
      .from('nfe_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (freight_id) {
      query = query.eq('freight_id', freight_id);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, data: data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em nfe-list:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
