-- =====================================================
-- CRIPTOGRAFIA EM NÍVEL DE COLUNA PARA LGPD - COMPLETA
-- Usando extensions.encrypt/decrypt do pgcrypto
-- =====================================================

-- 1. Criar tabela para armazenar dados criptografados
CREATE TABLE IF NOT EXISTS public.profiles_encrypted_data (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cpf_cnpj_encrypted TEXT,
  phone_encrypted TEXT,
  contact_phone_encrypted TEXT,
  emergency_contact_phone_encrypted TEXT,
  address_street_encrypted TEXT,
  address_number_encrypted TEXT,
  address_complement_encrypted TEXT,
  address_neighborhood_encrypted TEXT,
  address_city_encrypted TEXT,
  address_state_encrypted TEXT,
  address_zip_encrypted TEXT,
  fixed_address_encrypted TEXT,
  farm_address_encrypted TEXT,
  encrypted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.profiles_encrypted_data ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "pii_select_own" ON public.profiles_encrypted_data;
CREATE POLICY "pii_select_own" ON public.profiles_encrypted_data FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "pii_update_own" ON public.profiles_encrypted_data;
CREATE POLICY "pii_update_own" ON public.profiles_encrypted_data FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "pii_insert_system" ON public.profiles_encrypted_data;
CREATE POLICY "pii_insert_system" ON public.profiles_encrypted_data FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "pii_delete_system" ON public.profiles_encrypted_data;
CREATE POLICY "pii_delete_system" ON public.profiles_encrypted_data FOR DELETE USING (true);

-- 4. Tabela de chaves (apenas service_role acessa)
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id TEXT PRIMARY KEY,
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;
-- Sem policies = apenas service_role

-- 5. Inserir chave
INSERT INTO public.encryption_keys (id, key_value)
SELECT 'profile_pii_key', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.encryption_keys WHERE id = 'profile_pii_key');

-- 6. Função encrypt
CREATE OR REPLACE FUNCTION public.encrypt_pii_field(p_value TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_key TEXT;
BEGIN
  IF p_value IS NULL OR p_value = '' THEN RETURN NULL; END IF;
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE id = 'profile_pii_key';
  IF v_key IS NULL THEN RAISE EXCEPTION 'Chave não encontrada'; END IF;
  RETURN encode(extensions.encrypt(convert_to(p_value, 'UTF8'), decode(v_key, 'hex'), 'aes'), 'base64');
END;
$$;

-- 7. Função decrypt
CREATE OR REPLACE FUNCTION public.decrypt_pii_field(p_encrypted TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_key TEXT; v_dec BYTEA;
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN RETURN NULL; END IF;
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE id = 'profile_pii_key';
  IF v_key IS NULL THEN RAISE EXCEPTION 'Chave não encontrada'; END IF;
  v_dec := extensions.decrypt(decode(p_encrypted, 'base64'), decode(v_key, 'hex'), 'aes');
  RETURN convert_from(v_dec, 'UTF8');
EXCEPTION WHEN OTHERS THEN RETURN '[ERRO]';
END;
$$;

-- 8. Função migração
CREATE OR REPLACE FUNCTION public.migrate_profile_to_encrypted(p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p RECORD;
BEGIN
  SELECT * INTO v_p FROM public.profiles WHERE id = p_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  INSERT INTO public.profiles_encrypted_data (id, cpf_cnpj_encrypted, phone_encrypted, contact_phone_encrypted, emergency_contact_phone_encrypted, address_street_encrypted, address_number_encrypted, address_complement_encrypted, address_neighborhood_encrypted, address_city_encrypted, address_state_encrypted, address_zip_encrypted, fixed_address_encrypted, farm_address_encrypted)
  VALUES (p_id, public.encrypt_pii_field(v_p.cpf_cnpj), public.encrypt_pii_field(v_p.phone), public.encrypt_pii_field(v_p.contact_phone), public.encrypt_pii_field(v_p.emergency_contact_phone), public.encrypt_pii_field(v_p.address_street), public.encrypt_pii_field(v_p.address_number), public.encrypt_pii_field(v_p.address_complement), public.encrypt_pii_field(v_p.address_neighborhood), public.encrypt_pii_field(v_p.address_city), public.encrypt_pii_field(v_p.address_state), public.encrypt_pii_field(v_p.address_zip), public.encrypt_pii_field(v_p.fixed_address), public.encrypt_pii_field(v_p.farm_address))
  ON CONFLICT (id) DO UPDATE SET cpf_cnpj_encrypted = EXCLUDED.cpf_cnpj_encrypted, phone_encrypted = EXCLUDED.phone_encrypted, contact_phone_encrypted = EXCLUDED.contact_phone_encrypted, emergency_contact_phone_encrypted = EXCLUDED.emergency_contact_phone_encrypted, address_street_encrypted = EXCLUDED.address_street_encrypted, address_number_encrypted = EXCLUDED.address_number_encrypted, address_complement_encrypted = EXCLUDED.address_complement_encrypted, address_neighborhood_encrypted = EXCLUDED.address_neighborhood_encrypted, address_city_encrypted = EXCLUDED.address_city_encrypted, address_state_encrypted = EXCLUDED.address_state_encrypted, address_zip_encrypted = EXCLUDED.address_zip_encrypted, fixed_address_encrypted = EXCLUDED.fixed_address_encrypted, farm_address_encrypted = EXCLUDED.farm_address_encrypted, updated_at = NOW();
  RETURN TRUE;
END;
$$;

-- 9. View segura
DROP VIEW IF EXISTS public.profiles_secure;
CREATE VIEW public.profiles_secure AS
SELECT p.id, p.user_id, p.full_name, p.status, p.rating, p.total_ratings, p.created_at, p.updated_at,
  CASE WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.cpf_cnpj_encrypted), p.cpf_cnpj) ELSE CONCAT(LEFT(p.cpf_cnpj, 3), '.***.***-**') END as cpf_cnpj,
  CASE WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.phone_encrypted), p.phone) WHEN p.phone IS NOT NULL THEN CONCAT('(**)*****-', RIGHT(p.phone, 4)) ELSE NULL END as phone,
  CASE WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.contact_phone_encrypted), p.contact_phone) WHEN p.contact_phone IS NOT NULL THEN CONCAT('(**)*****-', RIGHT(p.contact_phone, 4)) ELSE NULL END as contact_phone,
  CASE WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.address_street_encrypted), p.address_street) ELSE '***' END as address_street,
  CASE WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.address_city_encrypted), p.address_city) ELSE p.address_city END as address_city,
  CASE WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.address_state_encrypted), p.address_state) ELSE p.address_state END as address_state,
  p.profile_photo_url, p.service_types, p.base_city_name, p.base_state, p.aprovado, p.validation_status
FROM public.profiles p LEFT JOIN public.profiles_encrypted_data e ON e.id = p.id;

-- 10. Trigger
CREATE OR REPLACE FUNCTION public.auto_encrypt_profile_data()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.migrate_profile_to_encrypted(NEW.id); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_encrypt_profile ON public.profiles;
CREATE TRIGGER trigger_auto_encrypt_profile
AFTER INSERT OR UPDATE OF cpf_cnpj, phone, contact_phone, emergency_contact_phone, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, fixed_address, farm_address
ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_encrypt_profile_data();

-- 11. Migrar dados existentes
DO $$ DECLARE v_id UUID; v_c INTEGER := 0;
BEGIN FOR v_id IN SELECT id FROM public.profiles LOOP PERFORM public.migrate_profile_to_encrypted(v_id); v_c := v_c + 1; END LOOP; RAISE NOTICE 'Migrados % perfis', v_c; END; $$;

-- 12. Índice
CREATE INDEX IF NOT EXISTS idx_profiles_encrypted_id ON public.profiles_encrypted_data(id);
