import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Normaliza CPF (11 dígitos) ou CNPJ (14 dígitos) para formato com pontuação
 */
function formatCpfCnpj(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 11) {
    // CPF: 000.000.000-00
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  if (digits.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return value;
}

/**
 * Formata telefone para (00) 00000-0000
 */
function formatPhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return value;
}

/**
 * Formata CEP para 00000-000
 */
function formatCep(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 8) {
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  
  return value;
}

export interface PrefilledPersonalData {
  name: string;
  phone: string;
  email: string;
  document: string;
  profession?: string;
}

export interface PrefilledAddressData {
  cep: string;
  city: string;
  city_id?: string;
  state: string;
  street: string;
  neighborhood: string;
  number: string;
  complement: string;
  lat?: number;
  lng?: number;
}

export interface PrefilledFiscalData {
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  email: string;
  telefone: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ibge_code?: string;
}

export interface PrefilledUserData {
  personal: PrefilledPersonalData;
  address: PrefilledAddressData;
  fiscal: PrefilledFiscalData | null;
  loading: boolean;
  hasProfile: boolean;
  hasFiscalIssuer: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook centralizado para pré-preenchimento automático de dados do usuário.
 * Busca dados do perfil autenticado e do emissor fiscal (se existir).
 * 
 * REGRA MESTRA: SE o dado já existir no sistema → ELE DEVE SER PRÉ-PREENCHIDO AUTOMATICAMENTE.
 */
export function usePrefilledUserData(): PrefilledUserData {
  const { profile, user } = useAuth();
  const [fiscalIssuer, setFiscalIssuer] = useState<any>(null);
  const [secureProfile, setSecureProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Buscar dados completos da view profiles_secure (contorna CLS)
  const fetchSecureProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles_secure')
        .select('full_name, phone, contact_phone, cpf_cnpj, document, email, base_city_name, base_state, base_lat, base_lng, base_city_id, address_street, address_number, address_complement, address_neighborhood, address_zip, id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setSecureProfile(data);
      }
    } catch (err) {
      console.warn('[usePrefilledUserData] Erro ao buscar profiles_secure:', err);
    }
  };

  const fetchFiscalIssuer = async () => {
    if (!profile?.id) {
      setFiscalIssuer(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('fiscal_issuers')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setFiscalIssuer(data);
      } else {
        setFiscalIssuer(null);
      }
    } catch (err) {
      console.warn('[usePrefilledUserData] Erro ao buscar emissor fiscal:', err);
      setFiscalIssuer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchSecureProfile();
    }
  }, [user?.id]);

  useEffect(() => {
    if (profile?.id) {
      fetchFiscalIssuer();
    } else {
      setLoading(false);
    }
  }, [profile?.id]);

  // ✅ Dados pessoais: prioriza profiles_secure (dados completos via view segura)
  const personal = useMemo<PrefilledPersonalData>(() => {
    const src = secureProfile || profile;
    if (!src) {
      return { name: '', phone: '', email: '', document: '', profession: '' };
    }

    return {
      name: src.full_name || profile?.full_name || '',
      phone: formatPhone(src.phone || src.contact_phone || ''),
      email: src.email || user?.email || '',
      document: formatCpfCnpj(src.cpf_cnpj || src.document || ''),
      profession: '',
    };
  }, [secureProfile, profile, user]);

  // ✅ Endereço: prioriza profiles_secure com campos address_*
  const address = useMemo<PrefilledAddressData>(() => {
    const src = secureProfile || profile;
    if (!src) {
      return { cep: '', city: '', city_id: '', state: '', street: '', neighborhood: '', number: '', complement: '' };
    }

    return {
      cep: formatCep(src.address_zip || ''),
      city: src.base_city_name || profile?.base_city_name || '',
      city_id: src.base_city_id || (profile as any)?.base_city_id || '',
      state: src.base_state || profile?.base_state || '',
      street: src.address_street || '',
      neighborhood: src.address_neighborhood || '',
      number: src.address_number || '',
      complement: src.address_complement || '',
      lat: src.base_lat ?? profile?.base_lat,
      lng: src.base_lng ?? profile?.base_lng,
    };
  }, [secureProfile, profile]);

  const fiscal = useMemo<PrefilledFiscalData | null>(() => {
    if (!fiscalIssuer) {
      // Fallback: usar dados do perfil se não houver emissor fiscal
      const src = secureProfile || profile;
      if (src) {
        return {
          cnpj_cpf: formatCpfCnpj(src.cpf_cnpj || src.document || ''),
          razao_social: src.full_name || '',
          nome_fantasia: '',
          inscricao_estadual: '',
          inscricao_municipal: '',
          email: src.email || user?.email || '',
          telefone: formatPhone(src.phone || src.contact_phone || ''),
          logradouro: src.address_street || '',
          numero: src.address_number || '',
          bairro: src.address_neighborhood || '',
          municipio: src.base_city_name || '',
          uf: src.base_state || '',
          cep: formatCep(src.address_zip || ''),
          ibge_code: '',
        };
      }
      return null;
    }

    // Usar dados do emissor fiscal (mais completos)
    return {
      cnpj_cpf: formatCpfCnpj(fiscalIssuer.document_number || ''),
      razao_social: fiscalIssuer.legal_name || '',
      nome_fantasia: fiscalIssuer.trade_name || '',
      inscricao_estadual: fiscalIssuer.state_registration || fiscalIssuer.ie || '',
      inscricao_municipal: fiscalIssuer.municipal_registration || fiscalIssuer.im || '',
      email: fiscalIssuer.email_fiscal || fiscalIssuer.fiscal_email || user?.email || '',
      telefone: formatPhone(fiscalIssuer.telefone_fiscal || fiscalIssuer.fiscal_phone || secureProfile?.phone || profile?.phone || ''),
      logradouro: fiscalIssuer.address_street || fiscalIssuer.endereco_logradouro || '',
      numero: fiscalIssuer.address_number || fiscalIssuer.endereco_numero || '',
      bairro: fiscalIssuer.address_neighborhood || fiscalIssuer.endereco_bairro || '',
      municipio: fiscalIssuer.city || fiscalIssuer.endereco_cidade || '',
      uf: fiscalIssuer.uf || fiscalIssuer.endereco_uf || '',
      cep: formatCep(fiscalIssuer.address_zip_code || fiscalIssuer.endereco_cep || ''),
      ibge_code: fiscalIssuer.address_ibge_code || fiscalIssuer.endereco_ibge || '',
    };
  }, [fiscalIssuer, secureProfile, profile, user]);

  const refresh = async () => {
    setLoading(true);
    await Promise.all([fetchSecureProfile(), fetchFiscalIssuer()]);
  };

  return {
    personal,
    address,
    fiscal,
    loading,
    hasProfile: !!profile,
    hasFiscalIssuer: !!fiscalIssuer,
    refresh,
  };
}

/**
 * Helper para aplicar prefill em um objeto de formulário.
 * Não sobrescreve valores já preenchidos pelo usuário.
 */
export function applyPrefillToForm<T extends Record<string, any>>(
  formData: T,
  prefillData: Partial<T>,
  overwriteExisting = false
): T {
  const result = { ...formData };
  
  for (const [key, value] of Object.entries(prefillData)) {
    if (value !== undefined && value !== null && value !== '') {
      const currentValue = result[key as keyof T];
      
      // Só sobrescreve se:
      // 1. overwriteExisting é true, OU
      // 2. O valor atual está vazio/undefined/null
      if (overwriteExisting || currentValue === undefined || currentValue === null || currentValue === '') {
        (result as any)[key] = value;
      }
    }
  }
  
  return result;
}
