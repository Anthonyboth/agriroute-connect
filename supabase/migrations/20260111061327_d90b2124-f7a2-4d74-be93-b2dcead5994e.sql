-- ============================================
-- CORREÇÃO CRÍTICA: Cadastro de Empresa Fiscal AgriRoute
-- ============================================

-- Inserir empresa fiscal vinculada à transportadora existente
INSERT INTO public.empresas_fiscais (
  id,
  transport_company_id,
  razao_social,
  nome_fantasia,
  cnpj,
  inscricao_estadual,
  uf,
  municipio,
  municipio_ibge,
  endereco_logradouro,
  endereco_numero,
  endereco_bairro,
  endereco_cep,
  rntrc,
  ambiente_fiscal,
  onboarding_completo,
  ativo
) VALUES (
  gen_random_uuid(),
  '76bc21ba-a7ba-48a7-8238-07a841de5759', -- ID da Tatinha Transportes
  'TATINHA TRANSPORTES LTDA',
  'Tatinha Transportes',
  '62965243000111',
  '123456789', -- IE exemplo (deve ser atualizado com valor real)
  'SP',
  'São Paulo',
  '3550308', -- Código IBGE de São Paulo
  'Rua Exemplo',
  '100',
  'Centro',
  '01000000',
  '00000000', -- RNTRC exemplo (deve ser atualizado com valor real)
  'homologacao', -- Iniciar em homologação para testes seguros
  true,
  true
) ON CONFLICT DO NOTHING;

-- ============================================
-- CONFIGURAR CRON JOB PARA POLLING DE CT-e
-- ============================================

-- Habilitar extensão pg_cron se não estiver habilitada
-- (Esta extensão já deve estar habilitada no Supabase por padrão)

-- Criar função para chamar o edge function de polling
CREATE OR REPLACE FUNCTION public.trigger_cte_polling()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Chamar edge function via http
  SELECT content::json INTO result
  FROM extensions.http((
    'POST',
    'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/cte-polling',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
      extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::extensions.http_request);
  
  RAISE NOTICE 'CT-e polling executado: %', result;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro no CT-e polling: %', SQLERRM;
END;
$$;

-- Comentário: O cron job para polling automático deve ser configurado via
-- Supabase Dashboard > Database > Extensions > pg_cron
-- Comando sugerido:
-- SELECT cron.schedule('cte-polling-job', '*/5 * * * *', 'SELECT public.trigger_cte_polling()');
-- 
-- Nota: Por segurança, não executamos o schedule automaticamente.
-- O administrador deve configurar manualmente via dashboard.