import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CityZipData {
  name: string;
  state: string;
  zip_code: string;
}

// Principais cidades do MT com seus CEPs base
const MT_CITIES_ZIP: CityZipData[] = [
  { name: 'Cuiabá', state: 'MT', zip_code: '78000-000' },
  { name: 'Várzea Grande', state: 'MT', zip_code: '78110-000' },
  { name: 'Rondonópolis', state: 'MT', zip_code: '78700-000' },
  { name: 'Sinop', state: 'MT', zip_code: '78550-000' },
  { name: 'Tangará da Serra', state: 'MT', zip_code: '78300-000' },
  { name: 'Cáceres', state: 'MT', zip_code: '78200-000' },
  { name: 'Sorriso', state: 'MT', zip_code: '78890-000' },
  { name: 'Lucas do Rio Verde', state: 'MT', zip_code: '78455-000' },
  { name: 'Primavera do Leste', state: 'MT', zip_code: '78850-000' },
  { name: 'Barra do Garças', state: 'MT', zip_code: '78600-000' },
  { name: 'Alta Floresta', state: 'MT', zip_code: '78580-000' },
  { name: 'Pontes e Lacerda', state: 'MT', zip_code: '78250-000' },
  { name: 'Juína', state: 'MT', zip_code: '78320-000' },
  { name: 'Poxoréu', state: 'MT', zip_code: '78840-000' },
  { name: 'Campo Verde', state: 'MT', zip_code: '78840-000' },
  { name: 'Mirassol d\'Oeste', state: 'MT', zip_code: '78280-000' },
  { name: 'Diamantino', state: 'MT', zip_code: '78400-000' },
  { name: 'Colíder', state: 'MT', zip_code: '78500-000' },
  { name: 'Nova Mutum', state: 'MT', zip_code: '78450-000' },
  { name: 'Paranatinga', state: 'MT', zip_code: '78.750-000' }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Populando CEPs das cidades do MT...');

    let updated = 0;
    let failed = 0;

    for (const cityData of MT_CITIES_ZIP) {
      try {
        // Buscar cidade no banco
        const { data: cities, error: searchError } = await supabase
          .from('cities')
          .select('id, name')
          .ilike('name', cityData.name)
          .eq('state', cityData.state)
          .limit(1);

        if (searchError || !cities || cities.length === 0) {
          console.log(`⚠️ Cidade não encontrada: ${cityData.name} - ${cityData.state}`);
          failed++;
          continue;
        }

        const city = cities[0];

        // Atualizar com CEP
        const { error: updateError } = await supabase
          .from('cities')
          .update({ zip_code: cityData.zip_code })
          .eq('id', city.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar ${city.name}:`, updateError);
          failed++;
        } else {
          console.log(`✅ ${city.name}: CEP ${cityData.zip_code}`);
          
          // Salvar no cache também
          await supabase.rpc('save_zip_to_cache', {
            p_zip_code: cityData.zip_code.replace('-', ''),
            p_city_name: city.name,
            p_state: cityData.state,
            p_city_id: city.id,
            p_source: 'manual'
          });
          
          updated++;
        }
      } catch (error) {
        console.error(`❌ Erro processando ${cityData.name}:`, error);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'População de CEPs concluída',
        updated,
        failed,
        total: MT_CITIES_ZIP.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
