import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServicePricingRequest {
  service_type: 'CARGA' | 'GUINCHO' | 'MUDANCA';
  distance_km: number;
  weight_kg?: number;
  cargo_type?: string;
  vehicle_type?: string; // For guincho: 'CARRO', 'MOTO', 'CAMINHAO'
  rooms?: number; // For mudança
  additional_services?: string[]; // Extra services
}

interface ServicePricingResponse {
  base_price: number;
  price_per_km: number;
  total_price: number;
  antt_compliant: boolean;
  service_details: {
    service_type: string;
    distance_range: string;
    additional_fees: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      service_type, 
      distance_km, 
      weight_kg, 
      cargo_type, 
      vehicle_type, 
      rooms, 
      additional_services = [] 
    }: ServicePricingRequest = await req.json();
    
    console.log('Calculating service pricing for:', { service_type, distance_km, weight_kg, vehicle_type, rooms });

    // Get ANTT pricing from database
    const { data: pricingData, error } = await supabase
      .from('antt_freight_prices')
      .select('*')
      .eq('service_type', service_type)
      .or(`distance_range_max.is.null,distance_range_max.gte.${distance_km}`)
      .lte('distance_range_min', distance_km)
      .single();

    if (error || !pricingData) {
      console.error('Error fetching pricing data:', error);
      return new Response(JSON.stringify({ error: 'Pricing data not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let base_price = pricingData.base_price;
    let price_per_km = pricingData.price_per_km;
    let additional_fees = 0;

    // Apply service-specific multipliers
    switch (service_type) {
      case 'GUINCHO':
        // Vehicle type multipliers for guincho
        const vehicleMultipliers = {
          'MOTO': 0.7,
          'CARRO': 1.0,
          'CAMINHAO': 1.8,
          'ONIBUS': 2.0,
          'CARRETA': 2.5
        };
        const vehicleMultiplier = vehicleMultipliers[vehicle_type as keyof typeof vehicleMultipliers] || 1.0;
        base_price *= vehicleMultiplier;
        price_per_km *= vehicleMultiplier;
        
        // Emergency service fee (24h availability)
        additional_fees += 50;
        break;

      case 'MUDANCA':
        // Room-based multiplier for moving
        const roomMultiplier = rooms ? Math.max(1, rooms * 0.3) : 1;
        base_price *= roomMultiplier;
        
        // Additional services for moving
        const servicesFees = {
          'MONTAGEM_MOVEIS': 150,
          'EMBALAGEM': 100,
          'ELEVADOR': 80,
          'ESCADA': 60,
          'SEGURO_EXTRA': 120
        };
        
        additional_services.forEach(service => {
          additional_fees += servicesFees[service as keyof typeof servicesFees] || 0;
        });
        break;

      case 'CARGA':
        // Weight-based multiplier for regular freight
        if (weight_kg) {
          const weight_multiplier = weight_kg <= 15000 ? 1.0 : 
                                   weight_kg <= 25000 ? 1.2 : 1.4;
          base_price *= weight_multiplier;
          price_per_km *= weight_multiplier;
        }
        
        // Cargo type multiplier
        const cargoMultipliers = {
          'graos': 1.0,
          'fertilizantes': 1.1,
          'combustivel': 1.4,
          'produtos_quimicos': 1.5,
          'carga_geral': 1.2,
          'refrigerados': 1.3,
          'containers': 1.1
        };
        const cargoMultiplier = cargoMultipliers[cargo_type as keyof typeof cargoMultipliers] || 1.2;
        base_price *= cargoMultiplier;
        price_per_km *= cargoMultiplier;
        break;
    }

    // Calculate total price
    const distance_cost = distance_km * price_per_km;
    const total_price = Math.round((base_price + distance_cost + additional_fees) * 100) / 100;

    const distance_range = pricingData.distance_range_max 
      ? `${pricingData.distance_range_min}-${pricingData.distance_range_max}km`
      : `${pricingData.distance_range_min}km+`;

    const response: ServicePricingResponse = {
      base_price: Math.round(base_price * 100) / 100,
      price_per_km: Math.round(price_per_km * 100) / 100,
      total_price,
      antt_compliant: true,
      service_details: {
        service_type,
        distance_range,
        additional_fees: Math.round(additional_fees * 100) / 100
      }
    };

    console.log('Service pricing calculated:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating service pricing:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});