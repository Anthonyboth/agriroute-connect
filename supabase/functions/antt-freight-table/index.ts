import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FreightCalculationRequest {
  cargo_type: string;
  weight_kg: number;
  distance_km: number;
  origin_state: string;
  destination_state: string;
}

interface FreightCalculationResponse {
  minimum_freight_value: number;
  suggested_freight_value: number;
  antt_reference_price: number;
  calculation_details: {
    base_rate_per_km: number;
    weight_factor: number;
    cargo_type_multiplier: number;
    interstate_fee: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cargo_type, weight_kg, distance_km, origin_state, destination_state }: FreightCalculationRequest = await req.json();
    
    console.log('Calculating ANTT freight for:', { cargo_type, weight_kg, distance_km, origin_state, destination_state });

    // Tabela de referência ANTT simplificada (baseada em dados reais aproximados)
    const cargoTypeMultipliers = {
      'graos': 1.0,
      'fertilizantes': 1.1,
      'combustivel': 1.4,
      'produtos_quimicos': 1.5,
      'carga_geral': 1.2,
      'refrigerados': 1.3,
      'containers': 1.1
    };

    // Taxa base por km (varia conforme peso e distância)
    let base_rate_per_km = 2.50; // R$ por km base
    
    // Fator de peso (quanto mais pesado, maior o valor por km)
    const weight_factor = weight_kg <= 15000 ? 1.0 : 
                         weight_kg <= 25000 ? 1.2 : 1.4;
    
    // Multiplicador do tipo de carga
    const cargo_multiplier = cargoTypeMultipliers[cargo_type as keyof typeof cargoTypeMultipliers] || 1.2;
    
    // Taxa interestadual
    const interstate_fee = origin_state !== destination_state ? 0.15 : 0;
    
    // Desconto por distância (viagens longas têm desconto progressivo)
    const distance_discount = distance_km > 500 ? 0.9 : 
                             distance_km > 800 ? 0.85 : 1.0;
    
    // Cálculo final
    base_rate_per_km = base_rate_per_km * weight_factor * cargo_multiplier * distance_discount;
    
    const antt_reference_price = Math.round(distance_km * (base_rate_per_km + interstate_fee) * 100) / 100;
    const minimum_freight_value = Math.round(antt_reference_price * 0.95 * 100) / 100; // 5% abaixo da referência
    const suggested_freight_value = Math.round(antt_reference_price * 1.1 * 100) / 100; // 10% acima da referência

    const response: FreightCalculationResponse = {
      minimum_freight_value,
      suggested_freight_value,
      antt_reference_price,
      calculation_details: {
        base_rate_per_km: Math.round(base_rate_per_km * 100) / 100,
        weight_factor,
        cargo_type_multiplier: cargo_multiplier,
        interstate_fee
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating ANTT freight:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});