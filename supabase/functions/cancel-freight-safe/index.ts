import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Error codes for better debugging
enum ERROR_CODE {
  AUTH_ERROR = 'AUTH_ERROR',
  MISSING_FREIGHT_ID = 'MISSING_FREIGHT_ID',
  FREIGHT_NOT_FOUND = 'FREIGHT_NOT_FOUND',
  UPDATE_ERROR = 'UPDATE_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[CANCEL-FREIGHT][${requestId}] ========== NEW REQUEST ==========`);
  console.log(`[CANCEL-FREIGHT][${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[CANCEL-FREIGHT][${requestId}] Method: ${req.method}`);
  console.log(`[CANCEL-FREIGHT][${requestId}] URL: ${req.url}`);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`[CANCEL-FREIGHT][${requestId}] Supabase client created`);

    const authHeader = req.headers.get('Authorization');
    console.log(`[CANCEL-FREIGHT][${requestId}] Auth header present: ${!!authHeader}`);
    
    if (!authHeader) {
      console.error(`[CANCEL-FREIGHT][${requestId}] ❌ ERROR_CODE: ${ERROR_CODE.AUTH_ERROR} - No authorization header`);
      return new Response(
        JSON.stringify({ 
          error: 'Não autenticado',
          error_code: ERROR_CODE.AUTH_ERROR,
          details: 'Authorization header missing'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error(`[CANCEL-FREIGHT][${requestId}] ❌ ERROR_CODE: ${ERROR_CODE.AUTH_ERROR}`);
      console.error(`[CANCEL-FREIGHT][${requestId}] Auth error details:`, JSON.stringify(userError, null, 2));
      return new Response(
        JSON.stringify({ 
          error: 'Não autenticado',
          error_code: ERROR_CODE.AUTH_ERROR,
          details: userError?.message || 'Invalid or expired token'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT][${requestId}] ✅ User authenticated: ${user.id}`);

    const requestBody = await req.json();
    console.log(`[CANCEL-FREIGHT][${requestId}] Request body:`, JSON.stringify(requestBody, null, 2));
    
    const { freight_id, reason } = requestBody;

    if (!freight_id) {
      console.error(`[CANCEL-FREIGHT][${requestId}] ❌ ERROR_CODE: ${ERROR_CODE.MISSING_FREIGHT_ID}`);
      return new Response(
        JSON.stringify({ 
          error: 'freight_id é obrigatório',
          error_code: ERROR_CODE.MISSING_FREIGHT_ID,
          details: 'The freight_id parameter is required in the request body'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT][${requestId}] User ${user.id} attempting to cancel freight ${freight_id}`);
    console.log(`[CANCEL-FREIGHT][${requestId}] Cancellation reason: ${reason || 'Not provided'}`);

    // Get freight details
    console.log(`[CANCEL-FREIGHT][${requestId}] Fetching freight details...`);
    const { data: freight, error: fetchError } = await supabaseAdmin
      .from('freights')
      .select('id, pickup_date, producer_id, driver_id, status')
      .eq('id', freight_id)
      .single();

    if (fetchError || !freight) {
      console.error(`[CANCEL-FREIGHT][${requestId}] ❌ ERROR_CODE: ${ERROR_CODE.FREIGHT_NOT_FOUND}`);
      console.error(`[CANCEL-FREIGHT][${requestId}] Fetch error details:`, JSON.stringify(fetchError, null, 2));
      console.error(`[CANCEL-FREIGHT][${requestId}] Freight data:`, freight);
      return new Response(
        JSON.stringify({ 
          error: 'Frete não encontrado',
          error_code: ERROR_CODE.FREIGHT_NOT_FOUND,
          details: fetchError?.message || 'Freight does not exist or you do not have permission to access it',
          freight_id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT][${requestId}] ✅ Freight found:`, JSON.stringify(freight, null, 2));

    // Calculate safe pickup date (now + 2 hours)
    const now = new Date();
    const safePickup = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    // If freight has a future pickup_date, use the max between it and safePickup
    let finalPickupDate = safePickup;
    if (freight.pickup_date) {
      const existingPickup = new Date(freight.pickup_date);
      if (existingPickup > now) {
        finalPickupDate = existingPickup > safePickup ? existingPickup : safePickup;
      }
    }

    console.log(`[CANCEL-FREIGHT][${requestId}] Date calculations:`);
    console.log(`[CANCEL-FREIGHT][${requestId}]   - Original pickup: ${freight.pickup_date}`);
    console.log(`[CANCEL-FREIGHT][${requestId}]   - Current time: ${now.toISOString()}`);
    console.log(`[CANCEL-FREIGHT][${requestId}]   - Safe pickup (now + 2h): ${safePickup.toISOString()}`);
    console.log(`[CANCEL-FREIGHT][${requestId}]   - Final pickup date: ${finalPickupDate.toISOString()}`);

    // Update freight with safe pickup_date
    console.log(`[CANCEL-FREIGHT][${requestId}] Updating freight to CANCELLED status...`);
    const { error: updateError } = await supabaseAdmin
      .from('freights')
      .update({
        status: 'CANCELLED',
        pickup_date: finalPickupDate.toISOString(),
        updated_at: new Date().toISOString(),
        metadata: freight.metadata 
          ? { ...freight.metadata, cancellation_reason: reason }
          : { cancellation_reason: reason }
      })
      .eq('id', freight_id);

    if (updateError) {
      console.error(`[CANCEL-FREIGHT][${requestId}] ❌ ERROR_CODE: ${ERROR_CODE.UPDATE_ERROR}`);
      console.error(`[CANCEL-FREIGHT][${requestId}] Update error details:`, JSON.stringify(updateError, null, 2));
      console.error(`[CANCEL-FREIGHT][${requestId}] Error code: ${updateError.code}`);
      console.error(`[CANCEL-FREIGHT][${requestId}] Error message: ${updateError.message}`);
      console.error(`[CANCEL-FREIGHT][${requestId}] Error hint: ${updateError.hint}`);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao cancelar frete',
          error_code: ERROR_CODE.UPDATE_ERROR,
          details: updateError.message,
          postgres_code: updateError.code,
          hint: updateError.hint,
          freight_id
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT][${requestId}] ✅ Freight ${freight_id} cancelled successfully`);
    console.log(`[CANCEL-FREIGHT][${requestId}] ========== REQUEST COMPLETED SUCCESSFULLY ==========`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Frete cancelado com sucesso',
        freight_id,
        request_id: requestId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`[CANCEL-FREIGHT][${requestId}] ❌ ERROR_CODE: ${ERROR_CODE.UNEXPECTED_ERROR}`);
    console.error(`[CANCEL-FREIGHT][${requestId}] Unexpected error:`, error);
    console.error(`[CANCEL-FREIGHT][${requestId}] Error name: ${error?.name}`);
    console.error(`[CANCEL-FREIGHT][${requestId}] Error message: ${error?.message}`);
    console.error(`[CANCEL-FREIGHT][${requestId}] Error stack:`, error?.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro inesperado ao cancelar frete',
        error_code: ERROR_CODE.UNEXPECTED_ERROR,
        details: error?.stack || 'No stack trace available',
        request_id: requestId
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
