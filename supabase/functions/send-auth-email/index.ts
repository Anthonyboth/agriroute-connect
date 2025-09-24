import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailData {
  user: {
    email: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const getConfirmationEmailTemplate = (data: AuthEmailData) => {
  const { user, email_data } = data;
  const confirmationUrl = `${email_data.site_url}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${email_data.redirect_to}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirme seu e-mail - AgriRoute</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #2E7D32, #4CAF50); 
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content { 
          padding: 30px 20px; 
        }
        .button { 
          display: inline-block; 
          background: #4CAF50; 
          color: white !important; 
          padding: 15px 30px; 
          text-decoration: none; 
          border-radius: 8px; 
          margin: 20px 0; 
          font-weight: 600;
          font-size: 16px;
          transition: background 0.3s ease;
        }
        .button:hover {
          background: #45a049;
        }
        .footer { 
          background: #f8f9fa;
          text-align: center; 
          padding: 20px; 
          color: #666; 
          font-size: 14px; 
          border-top: 1px solid #eee;
        }
        .welcome {
          font-size: 18px;
          margin-bottom: 20px;
          color: #2E7D32;
        }
        .code-box {
          background: #f8f9fa;
          border: 2px dashed #4CAF50;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          text-align: center;
          font-family: monospace;
          font-size: 18px;
          font-weight: bold;
          color: #2E7D32;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚛 Bem-vindo ao AgriRoute!</h1>
        </div>
        <div class="content">
          <p class="welcome">Olá${user.user_metadata?.full_name ? ` ${user.user_metadata.full_name}` : ''}!</p>
          
          <p>Obrigado por se registrar no AgriRoute - a plataforma que conecta o agro brasileiro!</p>
          
          <p>Para completar seu cadastro e começar a usar nossa plataforma, clique no botão abaixo para confirmar seu endereço de e-mail:</p>
          
          <div style="text-align: center;">
            <a href="${confirmationUrl}" class="button">
              ✅ Confirmar E-mail
            </a>
          </div>
          
          <p><strong>Ou use o código de confirmação:</strong></p>
          <div class="code-box">
            ${data.email_data.token}
          </div>
          
          <p><small>Se você não conseguir clicar no botão, copie e cole este link no seu navegador:</small></p>
          <p style="word-break: break-all; font-size: 12px; color: #666;">
            ${confirmationUrl}
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p><strong>🎯 O que você pode fazer no AgriRoute:</strong></p>
          <ul style="color: #555;">
            <li>📦 Publicar e encontrar fretes</li>
            <li>🚚 Conectar-se com transportadores e produtores</li>
            <li>💰 Negociar preços competitivos</li>
            <li>📍 Rastrear cargas em tempo real</li>
            <li>⭐ Sistema de avaliações confiável</li>
          </ul>
          
          <p style="color: #666; font-size: 14px;">
            <em>Este link de confirmação expira em 24 horas. Se você não solicitou este cadastro, pode ignorar este e-mail.</em>
          </p>
        </div>
        <div class="footer">
          <p><strong>AgriRoute</strong> - Conectando o agro brasileiro</p>
          <p>Este é um e-mail automático, não responda a esta mensagem.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Auth email webhook received");
    
    const authData: AuthEmailData = await req.json();
    const { user, email_data } = authData;

    console.log(`Sending confirmation email to: ${user.email}`);

    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Email service not configured" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlContent = getConfirmationEmailTemplate(authData);

    const { error } = await resend.emails.send({
      from: "AgriRoute <noreply@resend.dev>",
      to: [user.email],
      subject: "Confirme seu e-mail - AgriRoute",
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log("Confirmation email sent successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Confirmation email sent" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in send-auth-email function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});