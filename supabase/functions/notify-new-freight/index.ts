import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FreightPayload {
  id: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  cargo_type?: string;
  price?: number;
  pickup_date?: string;
}

/**
 * Edge function to notify nearby drivers about new freights
 * Called when a new freight is created with status OPEN
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { freight, notify_radius_km = 100 } = await req.json() as { 
      freight: FreightPayload; 
      notify_radius_km?: number;
    };

    if (!freight || !freight.id) {
      throw new Error('Freight data is required');
    }

    console.log(`[NOTIFY] Processing new freight: ${freight.id}`);
    console.log(`[NOTIFY] Route: ${freight.origin_city}/${freight.origin_state} → ${freight.destination_city}/${freight.destination_state}`);

    // Get freight location (origin city)
    const { data: originCity } = await supabase
      .from('cities')
      .select('id, lat, lng')
      .eq('name', freight.origin_city)
      .eq('state', freight.origin_state)
      .single();

    // Find drivers with active service areas near the freight origin
    let nearbyDriverIds: string[] = [];

    if (originCity?.lat && originCity?.lng) {
      // Spatial matching - find drivers whose service areas cover the origin
      const { data: matches } = await supabase
        .from('driver_service_areas')
        .select('driver_id')
        .eq('is_active', true);

      // For now, get all active drivers with service areas
      // In production, use PostGIS for proper spatial queries
      nearbyDriverIds = [...new Set(matches?.map(m => m.driver_id) || [])];
    }

    // Also find drivers from companies that serve this region
    const { data: companyDrivers } = await supabase
      .from('company_drivers')
      .select(`
        driver_profile_id,
        company:transport_companies!company_drivers_company_id_fkey(
          id,
          cities_served
        )
      `)
      .eq('status', 'ACTIVE')
      .eq('can_accept_freights', true);

    // Filter company drivers by city match
    const companyDriverIds = (companyDrivers || [])
      .filter((cd: any) => {
        const cities = cd.company?.cities_served || [];
        return cities.some((c: string) => 
          c.toLowerCase().includes(freight.origin_city.toLowerCase())
        );
      })
      .map((cd: any) => cd.driver_profile_id)
      .filter(Boolean);

    // Combine and deduplicate driver IDs
    const allDriverIds = [...new Set([...nearbyDriverIds, ...companyDriverIds])];

    console.log(`[NOTIFY] Found ${allDriverIds.length} potential drivers to notify`);

    if (allDriverIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          notified: 0, 
          message: 'No nearby drivers found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check notification rate limits
    const { data: limits } = await supabase
      .from('driver_notification_limits')
      .select('driver_id, notification_count, window_start')
      .in('driver_id', allDriverIds);

    const limitsMap = new Map(limits?.map(l => [l.driver_id, l]) || []);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Filter out drivers who exceeded their hourly limit
    const eligibleDrivers = allDriverIds.filter(driverId => {
      const limit = limitsMap.get(driverId);
      if (!limit) return true;
      
      const windowStart = new Date(limit.window_start);
      if (windowStart < oneHourAgo) return true; // Window expired, allow
      
      return (limit.notification_count || 0) < 10; // Max 10 per hour
    });

    console.log(`[NOTIFY] ${eligibleDrivers.length} drivers within rate limits`);

    // Format price for notification
    const priceText = freight.price 
      ? `R$ ${freight.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : 'A combinar';

    // Format pickup date
    const pickupText = freight.pickup_date
      ? new Date(freight.pickup_date).toLocaleDateString('pt-BR')
      : 'Flexível';

    // Send push notifications via the existing push notification function
    if (eligibleDrivers.length > 0) {
      const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_ids: eligibleDrivers,
          title: '🚚 Novo Frete Disponível!',
          message: `${freight.origin_city}/${freight.origin_state} → ${freight.destination_city}/${freight.destination_state}`,
          type: 'new_freight',
          data: {
            freight_id: freight.id,
            origin: `${freight.origin_city}/${freight.origin_state}`,
            destination: `${freight.destination_city}/${freight.destination_state}`,
            cargo_type: freight.cargo_type || 'Carga Geral',
            price: priceText,
            pickup_date: pickupText,
          },
          url: `/driver-dashboard?tab=search&freight=${freight.id}`,
          requireInteraction: true,
          actions: [
            { action: 'view', title: 'Ver Detalhes' },
            { action: 'dismiss', title: 'Ignorar' }
          ]
        }
      });

      if (pushError) {
        console.error('[NOTIFY] Push notification error:', pushError);
      } else {
        console.log('[NOTIFY] Push notification result:', pushResult);
      }

      // Update rate limits for notified drivers
      const updatePromises = eligibleDrivers.map(driverId => {
        const existingLimit = limitsMap.get(driverId);
        const windowStart = existingLimit?.window_start 
          ? new Date(existingLimit.window_start)
          : now;
        
        const isNewWindow = !existingLimit || windowStart < oneHourAgo;

        return supabase
          .from('driver_notification_limits')
          .upsert({
            driver_id: driverId,
            notification_count: isNewWindow ? 1 : (existingLimit?.notification_count || 0) + 1,
            window_start: isNewWindow ? now.toISOString() : existingLimit?.window_start,
            updated_at: now.toISOString()
          }, {
            onConflict: 'driver_id'
          });
      });

      await Promise.allSettled(updatePromises);

      // Create freight matches for tracking
      const matchInserts = eligibleDrivers.map(driverId => ({
        freight_id: freight.id,
        driver_id: driverId,
        match_type: 'push_notification',
        notified_at: now.toISOString(),
        match_score: 1.0
      }));

      await supabase
        .from('freight_matches')
        .upsert(matchInserts, { 
          onConflict: 'freight_id,driver_id',
          ignoreDuplicates: true 
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: eligibleDrivers.length,
        total_drivers: allDriverIds.length,
        rate_limited: allDriverIds.length - eligibleDrivers.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NOTIFY] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
