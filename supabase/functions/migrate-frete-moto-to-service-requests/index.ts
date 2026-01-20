import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: unknown) => {
  try {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[MIGRATE-FRETE-MOTO] ${step}${detailsStr}`);
  } catch {
    console.log(`[MIGRATE-FRETE-MOTO] ${step}`);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userRes } = await supabase.auth.getUser(token);
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .limit(1)
      .maybeSingle();

    if (!userRole) {
      logStep("Unauthorized attempt", { userId: user.id });
      return new Response(JSON.stringify({ error: 'Unauthorized - admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep("Starting FRETE_MOTO migration", { adminUserId: user.id });

    // 1) Find legacy FRETE_MOTO in freights table that are still open
    const { data: legacyFreights, error: fetchErr } = await supabase
      .from('freights')
      .select('*')
      .eq('service_type', 'FRETE_MOTO')
      .in('status', ['OPEN', 'IN_NEGOTIATION'])
      .is('driver_id', null)
      .order('created_at', { ascending: true });

    if (fetchErr) {
      logStep("Error fetching legacy freights", fetchErr);
      throw fetchErr;
    }

    logStep("Legacy FRETE_MOTO found", { count: legacyFreights?.length || 0 });

    if (!legacyFreights || legacyFreights.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No legacy FRETE_MOTO found to migrate',
        migrated: 0,
        skipped: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let migrated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const freight of legacyFreights) {
      try {
        // Check if already migrated (idempotency check)
        const { data: existing } = await supabase
          .from('service_requests')
          .select('id')
          .eq('service_type', 'FRETE_MOTO')
          .contains('additional_info', { migrated_from_freights_id: freight.id })
          .limit(1)
          .maybeSingle();

        if (existing) {
          logStep("Already migrated, skipping", { freightId: freight.id, existingId: existing.id });
          skipped++;
          continue;
        }

        // Build service_request record
        const serviceRequest = {
          service_type: 'FRETE_MOTO',
          status: 'OPEN',
          client_id: freight.producer_id || null,
          provider_id: null,
          problem_description: freight.notes || freight.cargo_description || 'Frete por moto migrado',
          location_address: freight.origin_address || `${freight.origin_city || ''}, ${freight.origin_state || ''}`,
          city_name: freight.origin_city || null,
          state: freight.origin_state || null,
          city_id: freight.origin_city_id || null,
          location_lat: freight.origin_lat || null,
          location_lng: freight.origin_lng || null,
          urgency: freight.urgency || 'MEDIUM',
          contact_name: freight.guest_contact_name || null,
          contact_phone: freight.guest_contact_phone || null,
          contact_email: freight.guest_contact_email || null,
          additional_info: {
            migrated_from_freights_id: freight.id,
            migrated_at: new Date().toISOString(),
            original_price: freight.price,
            original_weight: freight.weight,
            destination_address: freight.destination_address,
            destination_city: freight.destination_city,
            destination_state: freight.destination_state,
            cargo_type: freight.cargo_type,
            cargo_description: freight.cargo_description,
          },
          created_at: freight.created_at,
        };

        const { error: insertErr } = await supabase
          .from('service_requests')
          .insert(serviceRequest);

        if (insertErr) {
          logStep("Error inserting service_request", { freightId: freight.id, error: insertErr });
          errors.push({ freightId: freight.id, error: insertErr.message });
          continue;
        }

        // Mark original freight as migrated (optional: update status)
        // Only if you want to prevent it from showing in old flows
        // Keeping original intact to preserve history
        // await supabase
        //   .from('freights')
        //   .update({ status: 'MIGRATED' })
        //   .eq('id', freight.id);

        migrated++;
        logStep("Successfully migrated", { freightId: freight.id });
      } catch (err) {
        logStep("Exception migrating freight", { freightId: freight.id, error: String(err) });
        errors.push({ freightId: freight.id, error: String(err) });
      }
    }

    logStep("Migration complete", { migrated, skipped, errors: errors.length });

    return new Response(JSON.stringify({
      success: true,
      message: `Migration complete: ${migrated} migrated, ${skipped} skipped (already migrated)`,
      migrated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      total_found: legacyFreights.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('migrate-frete-moto error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
