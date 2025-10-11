import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IBGE_API = 'https://servicodados.ibge.gov.br/api/v1/localidades';

interface IBGECity {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
      };
    };
  };
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

    const { state } = await req.json();
    
    if (!state) {
      return new Response(
        JSON.stringify({ error: 'Estado é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Iniciando importação de cidades do estado: ${state}`);
    
    // Buscar cidades do estado no IBGE
    const response = await fetch(`${IBGE_API}/estados/${state}/municipios`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar cidades do IBGE: ${response.statusText}`);
    }
    
    const cities: IBGECity[] = await response.json();
    
    console.log(`Encontradas ${cities.length} cidades do ${state}`);
    
    // Preparar dados para inserção
    const cityData = cities.map(city => ({
      name: city.nome,
      state: city.microrregiao.mesorregiao.UF.sigla,
      ibge_code: city.id.toString(),
      lat: null,
      lng: null
    }));
    
    // Inserir em lotes de 50
    const batchSize = 50;
    let importedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < cityData.length; i += batchSize) {
      const batch = cityData.slice(i, i + batchSize);
      
      const { data, error } = await supabaseClient
        .from('cities')
        .upsert(batch, { 
          onConflict: 'name,state',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`Erro no lote ${i}-${i + batchSize}:`, error);
        errorCount += batch.length;
      } else {
        console.log(`Importado lote ${i}-${i + batchSize}`);
        importedCount += batch.length;
      }
    }
    
    console.log(`Importação concluída: ${importedCount} cidades importadas, ${errorCount} erros`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: importedCount,
        errors: errorCount,
        state,
        total: cities.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Erro ao importar cidades:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
