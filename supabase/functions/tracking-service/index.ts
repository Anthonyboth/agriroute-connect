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

const IncidentSchema = z.object({
  freight_id: uuidSchema,
  incident_type: z.enum(['SIGNAL_LOST', 'ROUTE_DEVIATION', 'GPS_DISABLED', 'SUSPECTED_SPOOFING']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  last_known_lat: coordinateSchema.optional(),
  last_known_lng: longitudeSchema.optional(),
  description: z.string().max(500).optional(),
  evidence_data: z.any().optional()
});

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [TRACKING-SERVICE] ${step}${detailsStr}`);
};

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
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Autenticação falhou', code: 'AUTH_FAILED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;
    
    // POST /tracking-service/locations - Receber updates de localização
    if (path.includes('/locations') && req.method === 'POST') {
      const body = await req.json();
      const { freight_id, lat, lng, speed, heading, accuracy, source } = validateInput(LocationUpdateSchema, body);
      
      logStep('Atualizando localização', { freight_id, lat, lng });

      // Verificar se o usuário tem permissão para este frete
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: 'Perfil não encontrado', code: 'PROFILE_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: freight } = await supabase
        .from('freights')
        .select('driver_id, tracking_status')
        .eq('id', freight_id)
        .eq('driver_id', profile.id)
        .single();

      if (!freight) {
        return new Response(
          JSON.stringify({ error: 'Frete não encontrado ou sem permissão', code: 'FORBIDDEN' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        logStep('Erro ao inserir localização', { error: insertError });
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

      // Verificar desvio de rota
      await checkRouteDeviation(supabase, freight_id, lat, lng, user.id);

      logStep('Localização atualizada com sucesso', { freight_id });

      return new Response(
        JSON.stringify({ success: true, message: 'Localização atualizada' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // POST /tracking-service/incidents - Criar incidentes
    if (path.includes('/incidents') && req.method === 'POST') {
      const body = await req.json();
      const incidentData = validateInput(IncidentSchema, body);
      
      logStep('Criando incidente', { freight_id: incidentData.freight_id, type: incidentData.incident_type });
      
      const { error: insertError } = await supabase
        .from('incident_logs')
        .insert({
          ...incidentData,
          user_id: user.id,
          auto_generated: true
        });

      if (insertError) {
        logStep('Erro ao criar incidente', { error: insertError });
        throw insertError;
      }

      // Notificar produtor
      await notifyProducer(supabase, incidentData.freight_id, incidentData.incident_type);

      logStep('Incidente criado com sucesso');

      return new Response(
        JSON.stringify({ success: true, message: 'Incidente registrado' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // GET /tracking-service/incidents - Listar incidentes para admin
    if (path.includes('/incidents') && req.method === 'GET') {
      // Verificar se é admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'moderator'])
        .maybeSingle();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores', code: 'ADMIN_ONLY' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
        .order('created_at', { ascending: false })
        .limit(100);

      return new Response(
        JSON.stringify({ incidents }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ✅ CORRIGIDO: Log e resposta adequada para rotas não encontradas
    logStep('Rota não encontrada', { path, method: req.method });
    
    return new Response(
      JSON.stringify({ 
        error: 'Rota não encontrada', 
        code: 'NOT_FOUND',
        available_routes: [
          'POST /tracking-service/locations',
          'POST /tracking-service/incidents',
          'GET /tracking-service/incidents'
        ]
      }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    // Handle validation errors
    if (error instanceof Response) {
      return error;
    }
    
    logStep('Erro no serviço de rastreamento', { error: error.message });
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

async function checkRouteDeviation(supabase: any, freightId: string, lat: number, lng: number, userId: string) {
  // ✅ IMPLEMENTAÇÃO REAL: Verificar desvio de rota
  try {
    // Buscar configuração de threshold
    const { data: settings } = await supabase
      .from('tracking_settings')
      .select('setting_value')
      .eq('setting_key', 'route_deviation_threshold')
      .single();

    const thresholdMeters = parseInt(settings?.setting_value || '5000');
    
    // Buscar waypoints da rota planejada
    const { data: freight } = await supabase
      .from('freights')
      .select('route_waypoints, origin_lat, origin_lng, destination_lat, destination_lng')
      .eq('id', freightId)
      .single();

    if (!freight) return;

    // Se não há waypoints, usar linha reta entre origem e destino
    let minDistance = Infinity;
    
    if (freight.route_waypoints && Array.isArray(freight.route_waypoints)) {
      // Calcular distância mínima para qualquer waypoint
      for (const wp of freight.route_waypoints) {
        const distance = haversineDistance(lat, lng, wp.lat, wp.lng);
        minDistance = Math.min(minDistance, distance);
      }
    } else if (freight.origin_lat && freight.destination_lat) {
      // Calcular distância para linha reta origem-destino
      minDistance = pointToLineDistance(
        lat, lng,
        freight.origin_lat, freight.origin_lng,
        freight.destination_lat, freight.destination_lng
      );
    }

    // Se desvio maior que threshold, registrar incidente
    if (minDistance !== Infinity && minDistance > thresholdMeters) {
      console.log(`[ROUTE-DEVIATION] Desvio detectado: ${minDistance}m (threshold: ${thresholdMeters}m)`);
      
      await supabase.from('incident_logs').insert({
        freight_id: freightId,
        user_id: userId,
        incident_type: 'ROUTE_DEVIATION',
        severity: minDistance > thresholdMeters * 2 ? 'HIGH' : 'MEDIUM',
        last_known_lat: lat,
        last_known_lng: lng,
        description: `Desvio de rota detectado: ${Math.round(minDistance)}m da rota planejada`,
        auto_generated: true,
        evidence_data: {
          deviation_meters: minDistance,
          threshold_meters: thresholdMeters
        }
      });
    }
  } catch (error) {
    console.error('[ROUTE-DEVIATION] Erro ao verificar desvio:', error);
  }
}

// Fórmula de Haversine para distância entre dois pontos
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Distância de ponto para linha (aproximação)
function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  // Calcular distâncias para os dois extremos e o ponto mais próximo na linha
  const d1 = haversineDistance(px, py, x1, y1);
  const d2 = haversineDistance(px, py, x2, y2);
  
  // Projeção simples no ponto médio
  const midLat = (x1 + x2) / 2;
  const midLng = (y1 + y2) / 2;
  const dMid = haversineDistance(px, py, midLat, midLng);
  
  return Math.min(d1, d2, dMid);
}

async function notifyProducer(supabase: any, freightId: string, incidentType: string) {
  // Verificar se já existe notificação recente (últimas 2 horas)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { data: freight } = await supabase
    .from('freights')
    .select('producer_id, origin_address, destination_address')
    .eq('id', freightId)
    .single();

  if (!freight) {
    console.log('[NOTIFY] Frete não encontrado:', freightId);
    return;
  }

  const { data: recentNotifications } = await supabase
    .from('notifications')
    .select('id, created_at')
    .eq('user_id', freight.producer_id)
    .eq('type', 'warning')
    .ilike('message', `%${incidentType}%`)
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1);
  
  // Se já existe notificação recente, não criar outra
  if (recentNotifications && recentNotifications.length > 0) {
    const minutesAgo = Math.round((Date.now() - new Date(recentNotifications[0].created_at).getTime()) / 60000);
    console.log(`[DEDUP] Notificação ${incidentType} já enviada há ${minutesAgo} minutos. Pulando...`);
    return;
  }

  // Traduzir tipo de incidente
  const incidentTypesPt: Record<string, string> = {
    'SIGNAL_LOST': 'Sinal GPS perdido',
    'ROUTE_DEVIATION': 'Desvio de rota',
    'GPS_DISABLED': 'GPS desabilitado',
    'SUSPECTED_SPOOFING': 'Suspeita de falsificação de GPS'
  };

  await supabase.functions.invoke('send-notification', {
    body: {
      user_id: freight.producer_id,
      title: 'Alerta de Rastreamento',
      message: `Incidente detectado no frete: ${incidentTypesPt[incidentType] || incidentType}`,
      type: 'warning'
    }
  });
  
  console.log(`[NOTIFY] Nova notificação ${incidentType} criada para produtor ${freight.producer_id}`);
}
