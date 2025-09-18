import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailNotification {
  to: string;
  subject: string;
  message: string;
  type?: 'freight_update' | 'proposal_received' | 'support_response' | 'general';
  freight_id?: string;
  user_name?: string;
}

const getEmailTemplate = (type: string, data: EmailNotification) => {
  const baseStyles = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
      .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
  `;

  let emailContent = '';

  switch (type) {
    case 'freight_update':
      emailContent = `
        <div class="container">
          <div class="header">
            <h1>🚛 AgriRoute - Atualização de Frete</h1>
          </div>
          <div class="content">
            <p>Olá ${data.user_name || 'usuário'},</p>
            <div class="alert">
              <strong>Atualização importante sobre seu frete:</strong>
              <p>${data.message}</p>
            </div>
            ${data.freight_id ? `<p><strong>ID do Frete:</strong> ${data.freight_id}</p>` : ''}
            <p>Acesse a plataforma para mais detalhes:</p>
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://agriroute.com'}" class="button">Acessar AgriRoute</a>
          </div>
        </div>
      `;
      break;

    case 'proposal_received':
      emailContent = `
        <div class="container">
          <div class="header">
            <h1>💼 AgriRoute - Nova Proposta</h1>
          </div>
          <div class="content">
            <p>Olá ${data.user_name || 'usuário'},</p>
            <p>Você recebeu uma nova proposta de frete!</p>
            <div class="alert">
              <p>${data.message}</p>
            </div>
            <p>Acesse a plataforma para visualizar os detalhes e responder:</p>
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://agriroute.com'}" class="button">Ver Proposta</a>
          </div>
        </div>
      `;
      break;

    case 'support_response':
      emailContent = `
        <div class="container">
          <div class="header">
            <h1>🎧 AgriRoute - Resposta do Suporte</h1>
          </div>
          <div class="content">
            <p>Olá ${data.user_name || 'usuário'},</p>
            <p>Recebemos sua solicitação de suporte e temos uma atualização:</p>
            <div class="alert">
              <p>${data.message}</p>
            </div>
            <p>Acesse a central de suporte para continuar a conversa:</p>
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://agriroute.com'}/support" class="button">Central de Suporte</a>
          </div>
        </div>
      `;
      break;

    default:
      emailContent = `
        <div class="container">
          <div class="header">
            <h1>📧 AgriRoute - Notificação</h1>
          </div>
          <div class="content">
            <p>Olá ${data.user_name || 'usuário'},</p>
            <p>${data.message}</p>
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://agriroute.com'}" class="button">Acessar AgriRoute</a>
          </div>
        </div>
      `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.subject}</title>
      ${baseStyles}
    </head>
    <body>
      ${emailContent}
      <div class="footer">
        <p>AgriRoute - Conectando o agro brasileiro</p>
        <p>Este é um e-mail automático, não responda.</p>
      </div>
    </body>
    </html>
  `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const emailData: EmailNotification = await req.json();
    const { to, subject, message, type = 'general', freight_id, user_name } = emailData;

    console.log('Sending email notification:', { to, subject, type, freight_id });

    // Validate email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error('Endereço de e-mail inválido');
    }

    // Generate HTML email content
    const htmlContent = getEmailTemplate(type, emailData);

    // Here you would integrate with an email service like:
    // - Resend
    // - SendGrid
    // - Amazon SES

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resend = new Resend(resendApiKey);

    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured, email would be sent to:', to);
      console.log('Subject:', subject);
      console.log('Content:', message);
      
      // Store as notification instead
      try {
        // Get user by email to store notification
        const { data: authUser } = await supabaseClient.auth.admin.getUserByEmail(to);
        
        if (authUser.user) {
          const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('user_id', authUser.user.id);

          if (profiles && profiles.length > 0) {
            await supabaseClient.rpc('send_notification', {
              p_user_id: profiles[0].id,
              p_title: subject,
              p_message: message,
              p_type: 'info'
            });
          }
        }
      } catch (error) {
        console.log('Could not store as notification:', error.message);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'RESEND_API_KEY not configured - notification stored instead' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Send email using Resend
    const { error } = await resend.emails.send({
      from: 'AgriRoute <noreply@resend.dev>',
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      throw new Error(`Email service error: ${error.message}`);
    }

    console.log('Email sent successfully');
    const result = { id: 'sent-via-resend' };

    // Log email sent
    await supabaseClient
      .from('email_logs')
      .insert([{
        recipient: to,
        subject: subject,
        type: type,
        freight_id: freight_id,
        sent_at: new Date().toISOString(),
        status: 'sent'
      }])
      .catch(err => console.log('Could not log email:', err.message));

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: result.id || 'unknown',
      message: 'E-mail enviado com sucesso' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});