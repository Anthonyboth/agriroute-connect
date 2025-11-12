import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  assignment_id: string;
  driver_id: string;
  vehicle_license_plate: string;
  action: 'created' | 'removed';
  company_name?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: NotificationPayload = await req.json();
    console.log('[send-vehicle-assignment-notification] Payload recebido:', payload);

    const { assignment_id, driver_id, vehicle_license_plate, action, company_name = 'Empresa' } = payload;

    // Obter user_id do driver a partir do profile
    const { data: driverProfile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', driver_id)
      .single();

    if (profileError || !driverProfile) {
      console.error('[send-vehicle-assignment-notification] Erro ao buscar perfil do motorista:', profileError);
      throw new Error('Motorista não encontrado');
    }

    const notification = {
      user_id: driverProfile.user_id,
      title: action === 'created' 
        ? '🚚 Novo Veículo Vinculado' 
        : '❌ Vínculo de Veículo Removido',
      message: action === 'created'
        ? `A ${company_name} vinculou o veículo ${vehicle_license_plate} à sua conta.`
        : `O vínculo com o veículo ${vehicle_license_plate} foi removido pela ${company_name}.`,
      type: action === 'created' ? 'vehicle_assignment_created' : 'vehicle_assignment_removed',
      data: {
        assignment_id,
        vehicle_license_plate,
        action,
        deep_link: '/dashboard/driver?tab=vehicles'
      }
    };

    console.log('[send-vehicle-assignment-notification] Inserindo notificação:', notification);

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notification);

    if (notificationError) {
      console.error('[send-vehicle-assignment-notification] Erro ao inserir notificação:', notificationError);
      throw notificationError;
    }

    console.log('[send-vehicle-assignment-notification] ✅ Notificação enviada com sucesso');

    return new Response(
      JSON.stringify({ success: true, message: 'Notificação enviada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-vehicle-assignment-notification] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
