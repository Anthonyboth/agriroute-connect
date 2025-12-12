import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng } = await req.json();
    
    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: 'Latitude e longitude são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar OpenStreetMap Nominatim (gratuito, sem API key)
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'AgriRoute/1.0 (https://agriroute.app)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extrair informações do endereço
    const address = data.address || {};
    
    const result = {
      formatted_address: data.display_name,
      city: address.city || address.town || address.municipality || address.village || address.county,
      state: address.state,
      state_code: getStateCode(address.state),
      neighborhood: address.suburb || address.neighbourhood || address.district,
      street: address.road || address.street,
      house_number: address.house_number,
      cep: address.postcode,
      country: address.country
    };

    console.log('[reverse-geocode] Resultado:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[reverse-geocode] Erro:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Converter nome do estado para sigla
function getStateCode(stateName: string | undefined): string | undefined {
  if (!stateName) return undefined;
  
  const states: Record<string, string> = {
    'Acre': 'AC',
    'Alagoas': 'AL',
    'Amapá': 'AP',
    'Amazonas': 'AM',
    'Bahia': 'BA',
    'Ceará': 'CE',
    'Distrito Federal': 'DF',
    'Espírito Santo': 'ES',
    'Goiás': 'GO',
    'Maranhão': 'MA',
    'Mato Grosso': 'MT',
    'Mato Grosso do Sul': 'MS',
    'Minas Gerais': 'MG',
    'Pará': 'PA',
    'Paraíba': 'PB',
    'Paraná': 'PR',
    'Pernambuco': 'PE',
    'Piauí': 'PI',
    'Rio de Janeiro': 'RJ',
    'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS',
    'Rondônia': 'RO',
    'Roraima': 'RR',
    'Santa Catarina': 'SC',
    'São Paulo': 'SP',
    'Sergipe': 'SE',
    'Tocantins': 'TO'
  };
  
  return states[stateName] || undefined;
}
