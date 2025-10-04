import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema, textSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WhatsAppMessageSchema = z.object({
  to: z.string().regex(/^55\d{10,11}$/, 'Phone number must be in Brazilian format with country code'),
  message: textSchema(1000),
  type: z.enum(['text', 'freight_update', 'proposal_received']).optional().default('text'),
  freight_id: uuidSchema.optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json()
    const validated = validateInput(WhatsAppMessageSchema, body)
    const { to, message, type, freight_id } = validated;
    
    console.log('Sending WhatsApp message:', { to, type, freight_id });

    // Validate phone number (Brazilian format)
    const phoneRegex = /^55\d{10,11}$/;
    if (!phoneRegex.test(to.replace(/\D/g, ''))) {
      throw new Error('Número de telefone inválido. Use o formato brasileiro com DDD.');
    }

    const formattedPhone = to.replace(/\D/g, '');
    
    // Format message based on type
    let formattedMessage = message;
    
    if (type === 'freight_update' && freight_id) {
      formattedMessage = `🚛 *AgriRoute - Atualização de Frete*\n\n${message}\n\n*ID do Frete:* ${freight_id}\n\nAcesse o app para mais detalhes.`;
    } else if (type === 'proposal_received') {
      formattedMessage = `💼 *AgriRoute - Nova Proposta*\n\n${message}\n\nAcesse o app para visualizar e responder.`;
    }

    // Here you would integrate with a WhatsApp API service like:
    // - WhatsApp Business API
    // - Twilio WhatsApp API
    // - Evolution API
    // For now, we'll simulate the API call
    
    const whatsappApiUrl = Deno.env.get('WHATSAPP_API_URL');
    const whatsappApiToken = Deno.env.get('WHATSAPP_API_TOKEN');

    if (!whatsappApiUrl || !whatsappApiToken) {
      console.log('WhatsApp API not configured, message would be sent to:', formattedPhone);
      console.log('Message:', formattedMessage);
      
      // Store notification in database instead
      await supabaseClient.rpc('send_notification', {
        p_user_id: null, // Would need to get user_id from phone number
        p_title: 'Mensagem WhatsApp',
        p_message: `Mensagem enviaria via WhatsApp: ${formattedMessage}`,
        p_type: 'info'
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'WhatsApp API not configured - notification stored instead' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Example API call (adapt based on your WhatsApp service)
    const whatsappResponse = await fetch(`${whatsappApiUrl}/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whatsappApiToken}`,
      },
      body: JSON.stringify({
        number: formattedPhone,
        textMessage: {
          text: formattedMessage
        }
      }),
    });

    if (!whatsappResponse.ok) {
      throw new Error(`WhatsApp API error: ${whatsappResponse.statusText}`);
    }

    const result = await whatsappResponse.json();
    console.log('WhatsApp message sent successfully:', result);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: result.key?.id || 'unknown',
      message: 'Mensagem enviada com sucesso' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});