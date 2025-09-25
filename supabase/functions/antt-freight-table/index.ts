import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Try to get pricing from database first
    let base_rate_per_km = 2.50; // fallback default
    let cargo_multiplier = 1.2; // fallback default

    try {
      // Query ANTT freight prices table for the specific service type and distance range
      const { data: priceData, error: priceError } = await supabase
        .from('antt_freight_prices')
        .select('*')
        .eq('service_type', cargo_type)
        .lte('distance_range_min', distance_km)
        .or(`distance_range_max.gte.${distance_km},distance_range_max.is.null`)
        .order('distance_range_min', { ascending: false })
        .limit(1)
        .single();

      if (!priceError && priceData) {
        base_rate_per_km = parseFloat(priceData.price_per_km);
        console.log('Using database pricing:', { base_rate_per_km, service_type: cargo_type });
      } else {
        // Fallback to hardcoded multipliers
        const cargoTypeMultipliers = {
          'graos': 1.0,
          'fertilizantes': 1.1,
          'combustivel': 1.4,
          'produtos_quimicos': 1.5,
          'carga_geral': 1.2,
          'refrigerados': 1.3,
          'containers': 1.1
        };
        cargo_multiplier = cargoTypeMultipliers[cargo_type as keyof typeof cargoTypeMultipliers] || 1.2;
        console.log('Using fallback pricing:', { base_rate_per_km, cargo_multiplier });
      }
    } catch (dbError) {
      console.log('Database query failed, using fallback pricing:', dbError);
    }
    
    // Fator de peso (quanto mais pesado, maior o valor por km)
    const weight_factor = weight_kg <= 15000 ? 1.0 : 
                         weight_kg <= 25000 ? 1.2 : 1.4;
    
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});