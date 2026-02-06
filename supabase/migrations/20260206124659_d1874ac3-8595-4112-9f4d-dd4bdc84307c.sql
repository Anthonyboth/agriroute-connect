
-- =====================================================
-- CLS: Revogar SELECT em colunas de contato PII da tabela service_requests
-- Protege contact_name, contact_phone, contact_email, contact_document
-- Acesso deve ser feito via view service_requests_secure que mascara dados
-- =====================================================

-- Revogar acesso às colunas PII
REVOKE SELECT (contact_name, contact_phone, contact_email, contact_document)
ON public.service_requests FROM authenticated;

-- Garantir que a view segura continua funcionando (view owner tem acesso total)
-- A view service_requests_secure já mascara corretamente os dados de contato

-- Comentário documentando a proteção
COMMENT ON COLUMN public.service_requests.contact_name IS 'PII protegido via CLS - acessar via service_requests_secure';
COMMENT ON COLUMN public.service_requests.contact_phone IS 'PII protegido via CLS - acessar via service_requests_secure';
COMMENT ON COLUMN public.service_requests.contact_email IS 'PII protegido via CLS - acessar via service_requests_secure';
COMMENT ON COLUMN public.service_requests.contact_document IS 'PII protegido via CLS - acessar via service_requests_secure';
