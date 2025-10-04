import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema, coordinateSchema, longitudeSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LocationUpdateSchema = z.object({
  freight_id: uuidSchema,
  lat: coordinateSchema,
  lng: longitudeSchema,
  speed: z.number().min(0).max(300).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).max(1000).optional(),
  source: z.string().max(20).optional()
});

interface LocationUpdate {
  freight_id: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  source?: string;
}

interface IncidentData {
  freight_id: string;
  incident_type: 'SIGNAL_LOST' | 'ROUTE_DEVIATION' | 'GPS_DISABLED' | 'SUSPECTED_SPOOFING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  last_known_lat?: number;
  last_known_lng?: number;
  description?: string;
  evidence_data?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const url = new URL(req.url);
    const path = url.pathname;
    
    // POST /tracking-service/locations - Receber updates de localização
    if (path.includes('/locations') && req.method === 'POST') {
      const body = await req.json();
      const { freight_id, lat, lng, speed, heading, accuracy, source } = validateInput(LocationUpdateSchema, body);
      
      // Verificar se o usuário tem permissão para este frete
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      const { data: freight } = await supabase
        .from('freights')
        .select('driver_id, tracking_status')
        .eq('id', freight_id)
        .eq('driver_id', profile.id)
        .single();

      if (!freight) {
        throw new Error('Freight not found or no permission');
      }

      // Inserir localização
      const { error: insertError } = await supabase
        .from('trip_locations')
        .insert({
          freight_id,
          user_id: user.id,
          lat,
          lng,
          speed,
          heading,
          accuracy,
          source: source || 'GPS'
        });

      if (insertError) {
        throw insertError;
      }

      // Atualizar última localização no frete
      await supabase
        .from('freights')
        .update({
          current_lat: lat,
          current_lng: lng,
          last_location_update: new Date().toISOString()
        })
        .eq('id', freight_id);

      // Verificar desvio de rota (implementação básica)
      await checkRouteDeviation(supabase, freight_id, lat, lng, user.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Location updated' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // POST /tracking-service/incidents - Criar incidentes
    if (path.includes('/incidents') && req.method === 'POST') {
      const incidentData: IncidentData = await req.json();
      
      const { error: insertError } = await supabase
        .from('incident_logs')
        .insert({
          ...incidentData,
          user_id: user.id,
          auto_generated: true
        });

      if (insertError) {
        throw insertError;
      }

      // Notificar produtor
      await notifyProducer(supabase, incidentData.freight_id, incidentData.incident_type);

      return new Response(
        JSON.stringify({ success: true, message: 'Incident created' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // GET /tracking-service/incidents - Listar incidentes para admin
    if (path.includes('/incidents') && req.method === 'GET') {
      const { data: incidents } = await supabase
        .from('incident_logs')
        .select(`
          *,
          freight:freights(
            id,
            origin_address,
            destination_address,
            producer:profiles!producer_id(full_name),
            driver:profiles!driver_id(full_name)
          )
        `)
        .order('created_at', { ascending: false });

      return new Response(
        JSON.stringify({ incidents }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in tracking service:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

async function checkRouteDeviation(supabase: any, freightId: string, lat: number, lng: number, userId: string) {
  // Implementação básica de detecção de desvio
  // Em produção, seria mais sofisticada comparando com a rota planejada
  const { data: settings } = await supabase
    .from('tracking_settings')
    .select('setting_value')
    .eq('setting_key', 'route_deviation_threshold')
    .single();

  const threshold = parseInt(settings?.setting_value || '5000'); // metros
  
  // Lógica básica de desvio (implementar comparação com waypoints da rota)
  console.log(`Checking route deviation for freight ${freightId} at ${lat}, ${lng} with threshold ${threshold}m`);
}

async function notifyProducer(supabase: any, freightId: string, incidentType: string) {
  const { data: freight } = await supabase
    .from('freights')
    .select('producer_id, origin_address, destination_address')
    .eq('id', freightId)
    .single();

  if (freight) {
    await supabase.functions.invoke('send-notification', {
      body: {
        user_id: freight.producer_id,
        title: 'Alerta de Rastreamento',
        message: `Incidente detectado no frete: ${incidentType}`,
        type: 'warning'
      }
    });
  }
}