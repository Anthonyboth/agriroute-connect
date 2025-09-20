import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Brazilian cities with approximate coordinates
const BRAZILIAN_CITIES = [
  { name: "Primavera do Leste", state: "MT", lat: -15.556, lng: -54.296 },
  { name: "Rondonópolis", state: "MT", lat: -16.470, lng: -54.635 },
  { name: "Cuiabá", state: "MT", lat: -15.601, lng: -56.097 },
  { name: "Várzea Grande", state: "MT", lat: -15.647, lng: -56.132 },
  { name: "Sinop", state: "MT", lat: -11.864, lng: -55.502 },
  { name: "Tangará da Serra", state: "MT", lat: -14.622, lng: -57.508 },
  { name: "Cáceres", state: "MT", lat: -16.044, lng: -57.678 },
  { name: "Barra do Garças", state: "MT", lat: -15.889, lng: -52.257 },
  { name: "Sorriso", state: "MT", lat: -12.546, lng: -55.719 },
  { name: "Alta Floresta", state: "MT", lat: -9.876, lng: -56.086 },
  { name: "Campo Grande", state: "MS", lat: -20.469, lng: -54.620 },
  { name: "Dourados", state: "MS", lat: -22.221, lng: -54.806 },
  { name: "Três Lagoas", state: "MS", lat: -20.751, lng: -51.678 },
  { name: "Goiânia", state: "GO", lat: -16.686, lng: -49.264 },
  { name: "Anápolis", state: "GO", lat: -16.327, lng: -48.953 },
  { name: "Aparecida de Goiânia", state: "GO", lat: -16.823, lng: -49.244 },
  { name: "Brasília", state: "DF", lat: -15.780, lng: -47.930 },
  { name: "Uberlândia", state: "MG", lat: -18.919, lng: -48.277 },
  { name: "Uberaba", state: "MG", lat: -19.748, lng: -47.932 },
  { name: "Ribeirão Preto", state: "SP", lat: -21.177, lng: -47.810 },
];

const CARGO_TYPES = [
  "Soja", "Milho", "Algodão", "Arroz", "Trigo", "Café", "Açúcar",
  "Fertilizantes", "Defensivos", "Sementes", "Ração", "Farelo de Soja"
];

function getRandomCity() {
  return BRAZILIAN_CITIES[Math.floor(Math.random() * BRAZILIAN_CITIES.length)];
}

function getRandomLatLng(baseCity: any, radiusKm: number = 50) {
  // Generate random point within radius
  const radiusInDegrees = radiusKm / 111; // Rough conversion
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radiusInDegrees;
  
  return {
    lat: baseCity.lat + (distance * Math.cos(angle)),
    lng: baseCity.lng + (distance * Math.sin(angle))
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

    if (req.method === 'POST') {
      const { 
        drivers_count = 1000, 
        freights_count = 50, 
        areas_per_driver = 2,
        clear_existing = false 
      } = await req.json();

      console.log(`Generating test data: ${drivers_count} drivers, ${freights_count} freights`);

      if (clear_existing) {
        console.log('Clearing existing test data...');
        await supabaseClient.from('freight_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseClient.from('driver_service_areas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // Note: Not clearing profiles/freights as they might be real data
      }

      // Get existing driver profiles
      const { data: existingDrivers, error: driversError } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'MOTORISTA')
        .limit(Math.min(drivers_count, 100)); // Use existing drivers up to limit

      if (driversError) {
        throw new Error(`Error fetching drivers: ${driversError.message}`);
      }

      console.log(`Found ${existingDrivers?.length || 0} existing drivers`);

      // Create service areas for existing drivers
      const serviceAreasToInsert = [];
      const driversToProcess = existingDrivers?.slice(0, drivers_count) || [];

      for (const driver of driversToProcess) {
        for (let i = 0; i < areas_per_driver; i++) {
          const city = getRandomCity();
          const coords = getRandomLatLng(city, 10); // Small variation around city center
          
          serviceAreasToInsert.push({
            driver_id: driver.id,
            city_name: city.name,
            state: city.state,
            lat: coords.lat,
            lng: coords.lng,
            radius_km: 30 + Math.random() * 120, // 30-150km radius
            is_active: Math.random() > 0.1 // 90% active
          });
        }
      }

      if (serviceAreasToInsert.length > 0) {
        const { error: areasError } = await supabaseClient
          .from('driver_service_areas')
          .insert(serviceAreasToInsert);

        if (areasError) {
          throw new Error(`Error inserting service areas: ${areasError.message}`);
        }
        console.log(`Created ${serviceAreasToInsert.length} service areas`);
      }

      // Get existing producer profiles
      const { data: existingProducers, error: producersError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('role', 'PRODUTOR')
        .limit(Math.min(freights_count, 20));

      if (producersError) {
        throw new Error(`Error fetching producers: ${producersError.message}`);
      }

      // Create test freights
      const freightsToInsert = [];
      const producers = existingProducers || [];

      for (let i = 0; i < freights_count && producers.length > 0; i++) {
        const producer = producers[i % producers.length];
        const originCity = getRandomCity();
        const destinationCity = getRandomCity();
        const weight = 1 + Math.random() * 29; // 1-30 tons
        const distanceKm = 100 + Math.random() * 800; // 100-900km
        const pricePerKm = 0.8 + Math.random() * 1.7; // R$ 0.80 - 2.50 per km
        
        freightsToInsert.push({
          producer_id: producer.id,
          cargo_type: CARGO_TYPES[Math.floor(Math.random() * CARGO_TYPES.length)],
          weight: weight,
          origin_address: `${originCity.name}, ${originCity.state}`,
          destination_address: `${destinationCity.name}, ${destinationCity.state}`,
          origin_lat: originCity.lat,
          origin_lng: originCity.lng,
          destination_lat: destinationCity.lat,
          destination_lng: destinationCity.lng,
          distance_km: distanceKm,
          price: Math.round(distanceKm * pricePerKm * 100) / 100,
          pickup_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next 30 days
          delivery_date: new Date(Date.now() + (Math.random() * 30 + 2) * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2-32 days from now
          urgency: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
          status: 'OPEN'
        });
      }

      if (freightsToInsert.length > 0) {
        const { error: freightsError } = await supabaseClient
          .from('freights')
          .insert(freightsToInsert);

        if (freightsError) {
          throw new Error(`Error inserting freights: ${freightsError.message}`);
        }
        console.log(`Created ${freightsToInsert.length} test freights`);
      }

      // Performance test: Execute matching on a sample freight
      if (freightsToInsert.length > 0) {
        console.log('Running performance test...');
        const testFreightId = (await supabaseClient
          .from('freights')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()).data?.id;

        if (testFreightId) {
          const startTime = performance.now();
          
          const { data: matchResults, error: matchError } = await supabaseClient
            .rpc('execute_freight_matching', { freight_uuid: testFreightId });

          const endTime = performance.now();
          const executionTime = endTime - startTime;

          console.log(`Performance test results:
            - Execution time: ${executionTime.toFixed(2)}ms
            - Matches found: ${matchResults?.length || 0}
            - Service areas tested: ${serviceAreasToInsert.length}
          `);

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Test data generated successfully',
              statistics: {
                drivers_processed: driversToProcess.length,
                service_areas_created: serviceAreasToInsert.length,
                freights_created: freightsToInsert.length,
                performance_test: {
                  execution_time_ms: executionTime,
                  matches_found: matchResults?.length || 0,
                  test_freight_id: testFreightId
                }
              }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Test data generated successfully',
          statistics: {
            drivers_processed: driversToProcess.length,
            service_areas_created: serviceAreasToInsert.length,
            freights_created: freightsToInsert.length
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test data generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});