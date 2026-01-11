-- Add missing columns to mdfe_config table for Focus NFe integration
ALTER TABLE public.mdfe_config 
ADD COLUMN IF NOT EXISTS municipio_codigo TEXT,
ADD COLUMN IF NOT EXISTS municipio_nome TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS ultimo_numero_mdfe INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ambiente_fiscal TEXT DEFAULT 'homologacao';

-- Add missing columns to mdfe_manifestos table for SEFAZ integration
ALTER TABLE public.mdfe_manifestos
ADD COLUMN IF NOT EXISTS referencia_focus TEXT,
ADD COLUMN IF NOT EXISTS ambiente_fiscal TEXT DEFAULT 'homologacao',
ADD COLUMN IF NOT EXISTS resposta_sefaz JSONB,
ADD COLUMN IF NOT EXISTS mensagem_erro TEXT,
ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS xml_url TEXT;

-- Add simple index for status column (no partial index to avoid enum issues)
CREATE INDEX IF NOT EXISTS idx_mdfe_manifestos_referencia_focus 
ON public.mdfe_manifestos(referencia_focus) 
WHERE referencia_focus IS NOT NULL;

-- Create trigger function for mdfe-polling cron job
CREATE OR REPLACE FUNCTION public.trigger_mdfe_polling()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function will be called by the cron job to trigger mdfe-polling
  PERFORM
    net.http_post(
      url := 'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/mdfe-polling',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_mdfe_polling() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_mdfe_polling() TO service_role;