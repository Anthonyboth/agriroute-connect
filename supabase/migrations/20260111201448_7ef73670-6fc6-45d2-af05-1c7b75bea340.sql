-- Drop existing function with different parameter name
DROP FUNCTION IF EXISTS public.is_transport_company(uuid);

-- =====================================================
-- SISTEMA DE EMISSÃO DE NF-e - AGRIROUTE
-- Fase 1: Infraestrutura de Banco de Dados
-- =====================================================

-- 1. FISCAL ISSUERS - Cadastro de Emissores (CPF/CNPJ)
CREATE TABLE public.fiscal_issuers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('CPF', 'CNPJ')),
  document_number TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  state_registration TEXT,
  municipal_registration TEXT,
  uf TEXT NOT NULL,
  city TEXT NOT NULL,
  city_ibge_code TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_zip_code TEXT,
  tax_regime TEXT NOT NULL CHECK (tax_regime IN ('simples_nacional', 'simples_nacional_excesso', 'lucro_presumido', 'lucro_real', 'mei', 'isento')),
  cnae_code TEXT,
  cnae_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'documents_pending', 'sefaz_validating', 'validated', 'blocked', 'suspended')),
  status_reason TEXT,
  sefaz_status TEXT CHECK (sefaz_status IN ('not_validated', 'homologation_pending', 'homologation_approved', 'production_enabled', 'production_blocked')),
  sefaz_validated_at TIMESTAMPTZ,
  sefaz_validation_response JSONB,
  onboarding_step INTEGER DEFAULT 1,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  fiscal_environment TEXT NOT NULL DEFAULT 'homologation' CHECK (fiscal_environment IN ('homologation', 'production')),
  activated_at TIMESTAMPTZ,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES public.profiles(id),
  block_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_issuer_document UNIQUE (document_number),
  CONSTRAINT unique_profile_issuer UNIQUE (profile_id)
);

CREATE INDEX idx_fiscal_issuers_profile ON public.fiscal_issuers(profile_id);
CREATE INDEX idx_fiscal_issuers_document ON public.fiscal_issuers(document_number);
CREATE INDEX idx_fiscal_issuers_status ON public.fiscal_issuers(status);

-- 2. FISCAL CERTIFICATES
CREATE TABLE public.fiscal_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES public.fiscal_issuers(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL DEFAULT 'A1' CHECK (certificate_type IN ('A1', 'A3')),
  serial_number TEXT,
  issuer_cn TEXT,
  subject_cn TEXT,
  subject_document TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_valid BOOLEAN DEFAULT FALSE,
  is_expired BOOLEAN DEFAULT FALSE,
  storage_path TEXT,
  password_hash TEXT,
  encryption_key_id TEXT,
  purchased_via_platform BOOLEAN DEFAULT FALSE,
  purchase_order_id TEXT,
  purchase_provider TEXT,
  purchase_amount DECIMAL(10,2),
  purchase_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'valid', 'expired', 'revoked', 'invalid')),
  validation_error TEXT,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_certificates_issuer ON public.fiscal_certificates(issuer_id);
CREATE INDEX idx_fiscal_certificates_status ON public.fiscal_certificates(status);

-- 3. FISCAL WALLET
CREATE TABLE public.fiscal_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issuer_id UUID REFERENCES public.fiscal_issuers(id) ON DELETE SET NULL,
  available_balance INTEGER NOT NULL DEFAULT 0,
  reserved_balance INTEGER NOT NULL DEFAULT 0,
  total_credited INTEGER NOT NULL DEFAULT 0,
  total_debited INTEGER NOT NULL DEFAULT 0,
  emissions_count INTEGER NOT NULL DEFAULT 0,
  last_emission_at TIMESTAMPTZ,
  last_credit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_wallet_per_profile UNIQUE (profile_id),
  CONSTRAINT positive_balances CHECK (available_balance >= 0 AND reserved_balance >= 0)
);

CREATE INDEX idx_fiscal_wallet_profile ON public.fiscal_wallet(profile_id);

-- 4. FISCAL WALLET TRANSACTIONS
CREATE TABLE public.fiscal_wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.fiscal_wallet(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'reserve', 'release', 'refund')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('package_purchase', 'single_purchase', 'emission', 'emission_refund', 'admin_adjustment', 'promotional_credit')),
  reference_id UUID,
  description TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  payment_method TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_wallet_transactions_wallet ON public.fiscal_wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_created ON public.fiscal_wallet_transactions(created_at DESC);

-- 5. EMISSION PACKAGES
CREATE TABLE public.emission_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  emissions_count INTEGER NOT NULL,
  price_per_emission INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

INSERT INTO public.emission_packages (name, description, emissions_count, price_per_emission, total_price, discount_percentage, is_featured, display_order) VALUES
  ('Avulso', 'Emissão única de NF-e', 1, 390, 390, 0, FALSE, 1),
  ('Pacote 10', 'Ideal para pequenos prestadores', 10, 290, 2900, 25.64, FALSE, 2),
  ('Pacote 50', 'Mais popular - Melhor custo-benefício', 50, 250, 12500, 35.90, TRUE, 3),
  ('Pacote 100', 'Para grandes volumes', 100, 190, 19000, 51.28, FALSE, 4);

-- 6. NFE EMISSIONS
CREATE TABLE public.nfe_emissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES public.fiscal_issuers(id) ON DELETE RESTRICT,
  wallet_id UUID REFERENCES public.fiscal_wallet(id),
  freight_id UUID REFERENCES public.freights(id) ON DELETE SET NULL,
  access_key TEXT,
  number INTEGER,
  series INTEGER DEFAULT 1,
  model TEXT NOT NULL DEFAULT '55' CHECK (model IN ('55', '65')),
  internal_ref TEXT NOT NULL,
  issue_date TIMESTAMPTZ,
  authorization_date TIMESTAMPTZ,
  cancellation_date TIMESTAMPTZ,
  operation_nature TEXT NOT NULL,
  cfop TEXT NOT NULL,
  issuer_document TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  issuer_ie TEXT,
  issuer_address JSONB NOT NULL,
  recipient_document_type TEXT CHECK (recipient_document_type IN ('CPF', 'CNPJ', 'ESTRANGEIRO')),
  recipient_document TEXT,
  recipient_name TEXT NOT NULL,
  recipient_ie TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_address JSONB,
  items JSONB NOT NULL DEFAULT '[]',
  totals JSONB NOT NULL,
  transport_mode INTEGER,
  transport_data JSONB,
  payment_method TEXT,
  payment_data JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validating', 'processing', 'authorized', 'rejected', 'canceled', 'correction_sent')),
  status_history JSONB DEFAULT '[]',
  sefaz_status_code TEXT,
  sefaz_status_message TEXT,
  sefaz_response JSONB,
  sefaz_protocol TEXT,
  error_code TEXT,
  error_message TEXT,
  rejection_reason TEXT,
  xml_url TEXT,
  danfe_url TEXT,
  xml_signed_hash TEXT,
  emission_cost INTEGER NOT NULL DEFAULT 0,
  emission_paid BOOLEAN DEFAULT FALSE,
  wallet_transaction_id UUID,
  cancellation_protocol TEXT,
  cancellation_justification TEXT,
  canceled_by UUID REFERENCES public.profiles(id),
  correction_letters JSONB DEFAULT '[]',
  antifraud_score INTEGER,
  antifraud_status TEXT CHECK (antifraud_status IN ('pending', 'approved', 'flagged', 'blocked')),
  antifraud_events JSONB DEFAULT '[]',
  emission_context JSONB,
  focus_nfe_ref TEXT,
  focus_nfe_response JSONB,
  fiscal_environment TEXT NOT NULL DEFAULT 'homologation' CHECK (fiscal_environment IN ('homologation', 'production')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

CREATE INDEX idx_nfe_emissions_issuer ON public.nfe_emissions(issuer_id);
CREATE INDEX idx_nfe_emissions_access_key ON public.nfe_emissions(access_key);
CREATE INDEX idx_nfe_emissions_status ON public.nfe_emissions(status);
CREATE INDEX idx_nfe_emissions_created ON public.nfe_emissions(created_at DESC);

-- 7. ANTIFRAUD RULES
CREATE TABLE public.antifraud_nfe_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_code TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('location', 'frequency', 'timing', 'certificate', 'value', 'recipient', 'device', 'pattern')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  score_impact INTEGER NOT NULL DEFAULT 10,
  auto_action TEXT CHECK (auto_action IN ('none', 'warn', 'flag', 'block')),
  parameters JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

INSERT INTO public.antifraud_nfe_rules (rule_code, rule_name, description, category, severity, score_impact, auto_action, parameters) VALUES
  ('AF001', 'Emissão fora de rota', 'GPS não corresponde ao trajeto', 'location', 'high', 30, 'flag', '{"max_distance_km": 50}'),
  ('AF002', 'Múltiplas emissões', 'Mais de 5 emissões em 1 hora', 'frequency', 'medium', 20, 'warn', '{"max_per_hour": 5}'),
  ('AF003', 'Horário suspeito', 'Emissão entre 00h e 05h', 'timing', 'low', 10, 'none', '{"suspicious_start": 0, "suspicious_end": 5}'),
  ('AF004', 'Certificado compartilhado', 'Mesmo certificado em dispositivos diferentes', 'certificate', 'critical', 50, 'block', '{"max_devices": 2}'),
  ('AF005', 'Valor atípico', 'Valor maior que 3x a média', 'value', 'high', 25, 'flag', '{"multiplier": 3}'),
  ('AF006', 'Destinatário frequente', 'Mesmo destinatário mais de 10x/dia', 'recipient', 'medium', 15, 'warn', '{"max_per_day": 10}'),
  ('AF007', 'IP suspeito', 'Proxy/VPN detectado', 'device', 'high', 30, 'flag', '{}'),
  ('AF008', 'Dispositivo novo', 'Primeiro uso', 'device', 'low', 5, 'none', '{}');

-- 8. ANTIFRAUD EVENTS
CREATE TABLE public.antifraud_nfe_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES public.fiscal_issuers(id) ON DELETE CASCADE,
  emission_id UUID REFERENCES public.nfe_emissions(id) ON DELETE SET NULL,
  rule_id UUID NOT NULL REFERENCES public.antifraud_nfe_rules(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  score_impact INTEGER NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  evidence JSONB,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'escalated', 'false_positive')),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  resolution_action TEXT CHECK (resolution_action IN ('approved', 'blocked', 'warning_issued', 'false_positive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_antifraud_nfe_events_issuer ON public.antifraud_nfe_events(issuer_id);
CREATE INDEX idx_antifraud_nfe_events_status ON public.antifraud_nfe_events(status);

-- 9. FISCAL TERMS ACCEPTANCE
CREATE TABLE public.fiscal_terms_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issuer_id UUID REFERENCES public.fiscal_issuers(id) ON DELETE SET NULL,
  term_type TEXT NOT NULL CHECK (term_type IN ('fiscal_responsibility', 'privacy_policy', 'terms_of_service', 'emission_agreement')),
  term_version TEXT NOT NULL,
  term_hash TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_term_acceptance UNIQUE (profile_id, term_type, term_version)
);

CREATE INDEX idx_fiscal_terms_profile ON public.fiscal_terms_acceptances(profile_id);

-- 10. EMISSION QUEUE
CREATE TABLE public.emission_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  emission_id UUID NOT NULL REFERENCES public.nfe_emissions(id) ON DELETE CASCADE,
  queue_status TEXT NOT NULL DEFAULT 'pending' CHECK (queue_status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  error_history JSONB DEFAULT '[]',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_emission_in_queue UNIQUE (emission_id)
);

-- HABILITAR RLS
ALTER TABLE public.fiscal_issuers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antifraud_nfe_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antifraud_nfe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_queue ENABLE ROW LEVEL SECURITY;

-- FUNÇÃO: Verificar transportadora (recriar com nome de param correto)
CREATE OR REPLACE FUNCTION public.is_transport_company(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id 
    AND role = 'TRANSPORTADORA'::user_role
  )
$$;

-- POLÍTICAS RLS - FISCAL ISSUERS
CREATE POLICY "Users can view own issuers" ON public.fiscal_issuers FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can create own issuers" ON public.fiscal_issuers FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users can update own issuers" ON public.fiscal_issuers FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Transportadoras view all" ON public.fiscal_issuers FOR SELECT USING (public.is_transport_company(auth.uid()));

-- POLÍTICAS RLS - FISCAL CERTIFICATES
CREATE POLICY "Users can view own certificates" ON public.fiscal_certificates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.fiscal_issuers WHERE id = fiscal_certificates.issuer_id AND profile_id = auth.uid()));
CREATE POLICY "Users can create own certificates" ON public.fiscal_certificates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.fiscal_issuers WHERE id = issuer_id AND profile_id = auth.uid()));
CREATE POLICY "Users can update own certificates" ON public.fiscal_certificates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.fiscal_issuers WHERE id = fiscal_certificates.issuer_id AND profile_id = auth.uid()));

-- POLÍTICAS RLS - FISCAL WALLET
CREATE POLICY "Users can view own wallet" ON public.fiscal_wallet FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can manage own wallet" ON public.fiscal_wallet FOR ALL USING (profile_id = auth.uid());

-- POLÍTICAS RLS - WALLET TRANSACTIONS
CREATE POLICY "Users view own transactions" ON public.fiscal_wallet_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.fiscal_wallet WHERE id = fiscal_wallet_transactions.wallet_id AND profile_id = auth.uid()));

-- POLÍTICAS RLS - EMISSION PACKAGES
CREATE POLICY "Anyone view active packages" ON public.emission_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Transportadoras manage packages" ON public.emission_packages FOR ALL USING (public.is_transport_company(auth.uid()));

-- POLÍTICAS RLS - NFE EMISSIONS
CREATE POLICY "Users view own emissions" ON public.nfe_emissions FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "Users create emissions" ON public.nfe_emissions FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users update draft emissions" ON public.nfe_emissions FOR UPDATE USING (created_by = auth.uid() AND status = 'draft');
CREATE POLICY "Companies view driver emissions" ON public.nfe_emissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_drivers cd
    JOIN public.fiscal_issuers fi ON fi.profile_id = cd.driver_profile_id
    JOIN public.transport_companies tc ON tc.id = cd.company_id
    WHERE fi.id = nfe_emissions.issuer_id AND tc.profile_id = auth.uid() AND cd.status = 'active'
  ));

-- POLÍTICAS RLS - ANTIFRAUD
CREATE POLICY "Users view own antifraud events" ON public.antifraud_nfe_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.fiscal_issuers WHERE id = antifraud_nfe_events.issuer_id AND profile_id = auth.uid()));
CREATE POLICY "Anyone view active rules" ON public.antifraud_nfe_rules FOR SELECT USING (is_active = true);

-- POLÍTICAS RLS - TERMS
CREATE POLICY "Users view own term acceptances" ON public.fiscal_terms_acceptances FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users create term acceptances" ON public.fiscal_terms_acceptances FOR INSERT WITH CHECK (profile_id = auth.uid());

-- POLÍTICAS RLS - QUEUE
CREATE POLICY "Users view own queue items" ON public.emission_queue FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.nfe_emissions WHERE id = emission_queue.emission_id AND created_by = auth.uid()));

-- TRIGGERS
CREATE TRIGGER update_fiscal_issuers_updated_at BEFORE UPDATE ON public.fiscal_issuers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fiscal_certificates_updated_at BEFORE UPDATE ON public.fiscal_certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fiscal_wallet_updated_at BEFORE UPDATE ON public.fiscal_wallet FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nfe_emissions_updated_at BEFORE UPDATE ON public.nfe_emissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_antifraud_nfe_rules_updated_at BEFORE UPDATE ON public.antifraud_nfe_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_emission_queue_updated_at BEFORE UPDATE ON public.emission_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FUNÇÃO: Criar carteira ao criar emissor
CREATE OR REPLACE FUNCTION public.create_wallet_for_issuer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.fiscal_wallet (profile_id, issuer_id) VALUES (NEW.profile_id, NEW.id)
  ON CONFLICT (profile_id) DO UPDATE SET issuer_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_wallet_on_issuer_creation AFTER INSERT ON public.fiscal_issuers FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_issuer();

-- FUNÇÃO: Atualizar estatísticas da carteira
CREATE OR REPLACE FUNCTION public.update_wallet_stats_after_emission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'authorized' AND OLD.status != 'authorized' THEN
    UPDATE public.fiscal_wallet SET emissions_count = emissions_count + 1, last_emission_at = now() WHERE id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_wallet_stats_on_emission AFTER UPDATE ON public.nfe_emissions FOR EACH ROW EXECUTE FUNCTION public.update_wallet_stats_after_emission();