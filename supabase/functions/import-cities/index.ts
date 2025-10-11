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

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

async function importState(supabaseClient: any, state: string) {
  console.log(`Importando ${state}...`);
  
  const response = await fetch(`${IBGE_API}/estados/${state}/municipios`);
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar cidades do IBGE para ${state}: ${response.statusText}`);
  }
  
  const cities: IBGECity[] = await response.json();
  console.log(`Encontradas ${cities.length} cidades do ${state}`);
  
  const cityData = cities.map(city => ({
    name: city.nome,
    state: city.microrregiao.mesorregiao.UF.sigla,
    ibge_code: city.id.toString(),
    lat: null,
    lng: null
  }));
  
  const batchSize = 50;
  let importedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < cityData.length; i += batchSize) {
    const batch = cityData.slice(i, i + batchSize);
    
    const { error } = await supabaseClient
      .from('cities')
      .upsert(batch, { 
        onConflict: 'name,state',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`Erro no lote ${i}-${i + batchSize} do ${state}:`, error);
      errorCount += batch.length;
    } else {
      importedCount += batch.length;
    }
  }
  
  return { state, imported: importedCount, errors: errorCount, total: cities.length };
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
        JSON.stringify({ error: 'Estado é obrigatório. Use "ALL" para importar todos os estados.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Importar todos os estados
    if (state === 'ALL') {
      console.log('Iniciando importação de TODAS as cidades do Brasil...');
      
      const results = [];
      let totalImported = 0;
      let totalErrors = 0;
      
      for (const stateCode of BRAZILIAN_STATES) {
        try {
          const result = await importState(supabaseClient, stateCode);
          results.push(result);
          totalImported += result.imported;
          totalErrors += result.errors;
          
          // Pequeno delay para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Erro ao importar ${stateCode}:`, error);
          results.push({ state: stateCode, imported: 0, errors: 1, error: error.message });
          totalErrors += 1;
        }
      }
      
      console.log(`Importação completa! Total: ${totalImported} cidades, ${totalErrors} erros`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Importação de todos os estados concluída',
          totalImported,
          totalErrors,
          states: results.length,
          details: results
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Importar estado específico
    console.log(`Iniciando importação de cidades do estado: ${state}`);
    const result = await importState(supabaseClient, state);
    
    console.log(`Importação concluída: ${result.imported} cidades importadas, ${result.errors} erros`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: result.imported,
        errors: result.errors,
        state: result.state,
        total: result.total
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
