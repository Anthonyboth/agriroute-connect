import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema, textSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NotificationSchema = z.object({
  user_id: uuidSchema,
  title: textSchema(200).min(1, 'Title cannot be empty'),
  message: textSchema(1000).min(1, 'Message cannot be empty'),
  type: z.string().optional().default('info'),
  data: z.record(z.any()).optional()
});

const log = (level: string, message: string, data?: any) => {
  console.log(`[${level}] ${message}`, data ? JSON.stringify(data) : '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('INFO', 'Starting notification send process');

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json()
    const validated = validateInput(NotificationSchema, body)
    const { user_id, title, message, type, data } = validated

    log('INFO', 'Creating notification', { user_id, title, type });

    // Insert notification into database
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        title,
        message,
        type,
        data,
        read: false
      })
      .select()
      .single();

    if (error) {
      log('ERROR', 'Database error when creating notification', error);
      throw error;
    }

    log('INFO', 'Notification created successfully', notification);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification: notification 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    log('ERROR', 'Unexpected error in notification send', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});