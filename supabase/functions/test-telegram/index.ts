import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[TEST-TELEGRAM] Function started');

  try {
    // SECURITY: Verify admin role before allowing telegram tests
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Autenticação inválida' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: isAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!isAdmin) {
      console.warn(`Unauthorized test-telegram attempt by user ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem testar notificações.' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_CHAT_ID = '-1003009756749'; // Supergroup (migrado)

    if (!TELEGRAM_BOT_TOKEN) {
      console.error('[TEST-TELEGRAM] TELEGRAM_BOT_TOKEN não configurado');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'TELEGRAM_BOT_TOKEN não configurado nas Edge Functions Secrets' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { source = 'Unknown', userEmail = 'N/A' } = body;

    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', { 
      timeZone: 'America/Cuiaba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const message = `🧪 TESTE DE NOTIFICAÇÃO - AGRIROUTE CONNECT

✅ Sistema de Monitoramento Operacional

📍 Origem: ${source}
👤 Usuário: ${userEmail}
🕒 Data/Hora: ${timestamp}

🔔 Esta é uma mensagem de teste para validar o sistema de notificações.
Se você está vendo isso, significa que:
✓ Bot Token está configurado
✓ Chat ID está correto
✓ Edge Function está funcionando
✓ Sistema pronto para enviar alertas reais

🔧 Status: SISTEMA OPERACIONAL`;

    console.log('[TEST-TELEGRAM] Enviando mensagem de teste para Telegram...');

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const telegramData = await telegramResponse.json();
    
    console.log('[TEST-TELEGRAM] Resposta do Telegram:', JSON.stringify(telegramData));

    if (!telegramResponse.ok) {
      console.error('[TEST-TELEGRAM] Telegram API error:', telegramData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Telegram API error: ${telegramData.description || 'Unknown'}`,
          details: telegramData
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[TEST-TELEGRAM] ✅ Mensagem enviada com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação de teste enviada com sucesso!',
        timestamp,
        telegram_message_id: telegramData.result?.message_id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[TEST-TELEGRAM] Erro não esperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
