import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type IssuerType = 'CPF' | 'CNPJ' | 'MEI';
export type IssuerStatus = 'PENDING' | 'DOCUMENT_VALIDATED' | 'CERTIFICATE_PENDING' | 'CERTIFICATE_UPLOADED' | 'SEFAZ_VALIDATED' | 'ACTIVE' | 'BLOCKED';
export type FiscalEnvironment = 'homologacao' | 'producao';

export interface FiscalIssuer {
  id: string;
  profile_id: string;
  issuer_type: IssuerType;
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario: string;
  cnae_principal?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  endereco_cep?: string;
  endereco_ibge?: string;
  email_fiscal?: string;
  telefone_fiscal?: string;
  status: IssuerStatus;
  ambiente: FiscalEnvironment;
  sefaz_validated_at?: string;
  blocked_reason?: string;
  terms_accepted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FiscalCertificate {
  id: string;
  issuer_id: string;
  certificate_type: 'A1' | 'A3';
  subject_cn?: string;
  issuer_cn?: string;
  serial_number?: string;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  storage_path?: string;
  created_at: string;
}

export interface FiscalWallet {
  id: string;
  issuer_id: string;
  balance: number;
  total_credits_purchased: number;
  total_emissions_used: number;
  last_purchase_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterIssuerData {
  issuer_type: IssuerType;
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario: string;
  cnae_principal?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  endereco_cep?: string;
  endereco_ibge?: string;
  email_fiscal?: string;
  telefone_fiscal?: string;
}

export function useFiscalIssuer() {
  const [loading, setLoading] = useState(false);
  const [issuer, setIssuer] = useState<FiscalIssuer | null>(null);
  const [certificate, setCertificate] = useState<FiscalCertificate | null>(null);
  const [wallet, setWallet] = useState<FiscalWallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user's issuer data
  const fetchIssuer = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIssuer(null);
        return null;
      }

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        setIssuer(null);
        return null;
      }

      // Fetch issuer using direct query - cast to unknown first since types aren't generated yet
      const { data, error: fetchError } = await supabase
        .from('fiscal_issuers')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle() as unknown as { data: FiscalIssuer | null; error: any };

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setIssuer(data);
        
        // Fetch certificate - cast through unknown since schema may differ
        const certQuery = supabase
          .from('fiscal_certificates')
          .select('*')
          .eq('issuer_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const certResult = await (certQuery as unknown as Promise<{ data: FiscalCertificate | null; error: unknown }>);
        
        if (certResult.data) {
          setCertificate(certResult.data);
        }

        // Fetch wallet
        const { data: walletData } = await supabase
          .from('fiscal_wallet')
          .select('*')
          .eq('issuer_id', data.id)
          .maybeSingle() as unknown as { data: FiscalWallet | null; error: any };
        
        if (walletData) {
          setWallet(walletData);
        }

        return data;
      }

      return null;
    } catch (err: any) {
      console.error('[FISCAL] Error fetching issuer:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Register new issuer
  const registerIssuer = useCallback(async (data: RegisterIssuerData): Promise<FiscalIssuer | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('fiscal-issuer-register', {
        body: data,
      });

      if (fnError) throw fnError;

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Emissor fiscal cadastrado com sucesso!');
      
      // Refresh data
      await fetchIssuer();
      
      return result.issuer as FiscalIssuer;
    } catch (err: any) {
      const message = err.message || 'Erro ao cadastrar emissor fiscal';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchIssuer]);

  // Update issuer data
  const updateIssuer = useCallback(async (updates: Partial<RegisterIssuerData>): Promise<boolean> => {
    if (!issuer) {
      toast.error('Nenhum emissor fiscal encontrado');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('fiscal_issuers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', issuer.id);

      if (updateError) throw updateError;

      toast.success('Dados atualizados com sucesso');
      await fetchIssuer();
      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao atualizar dados';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, fetchIssuer]);

  // Upload certificate
  const uploadCertificate = useCallback(async (
    file: File, 
    password: string
  ): Promise<boolean> => {
    if (!issuer) {
      toast.error('Nenhum emissor fiscal encontrado');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      const { data: result, error: fnError } = await supabase.functions.invoke('fiscal-certificate-upload', {
        body: {
          issuer_id: issuer.id,
          certificate_base64: base64,
          certificate_password: password,
          file_name: file.name,
        },
      });

      if (fnError) throw fnError;

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Certificado digital enviado com sucesso!');
      await fetchIssuer();
      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao enviar certificado';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, fetchIssuer]);

  // Validate with SEFAZ (homologation test)
  const validateWithSefaz = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error('Nenhum emissor fiscal encontrado');
      return false;
    }

    if (!certificate) {
      toast.error('Certificado digital não encontrado');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('fiscal-sefaz-validation', {
        body: {
          issuer_id: issuer.id,
        },
      });

      if (fnError) throw fnError;

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        toast.success('Validação SEFAZ concluída com sucesso!');
        await fetchIssuer();
        return true;
      } else {
        throw new Error(result.message || 'Falha na validação SEFAZ');
      }
    } catch (err: any) {
      const message = err.message || 'Erro na validação SEFAZ';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, certificate, fetchIssuer]);

  // Accept fiscal terms
  const acceptTerms = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error('Nenhum emissor fiscal encontrado');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Record acceptance in fiscal_terms_acceptances
      const { error: acceptError } = await supabase
        .from('fiscal_terms_acceptances')
        .upsert({
          issuer_id: issuer.id,
          term_version: '2.0',
          accepted_at: new Date().toISOString(),
          ip_address: null,
          user_agent: navigator.userAgent,
          document_hash: 'FISCAL_TERMS_V2_HASH',
        } as any);

      if (acceptError) throw acceptError;

      // Update issuer status
      const { error: updateError } = await supabase
        .from('fiscal_issuers')
        .update({
          terms_accepted_at: new Date().toISOString(),
          status: issuer.status === 'SEFAZ_VALIDATED' ? 'ACTIVE' : issuer.status,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', issuer.id);

      if (updateError) throw updateError;

      toast.success('Termo de responsabilidade aceito');
      await fetchIssuer();
      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao aceitar termos';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, fetchIssuer]);

  // Get onboarding progress
  const getOnboardingProgress = useCallback((): { 
    step: number; 
    total: number; 
    label: string;
    canEmit: boolean;
  } => {
    if (!issuer) {
      return { step: 0, total: 5, label: 'Não iniciado', canEmit: false };
    }

    switch (issuer.status) {
      case 'PENDING':
        return { step: 1, total: 5, label: 'Cadastro pendente', canEmit: false };
      case 'DOCUMENT_VALIDATED':
        return { step: 2, total: 5, label: 'Documentos validados', canEmit: false };
      case 'CERTIFICATE_PENDING':
        return { step: 2, total: 5, label: 'Certificado pendente', canEmit: false };
      case 'CERTIFICATE_UPLOADED':
        return { step: 3, total: 5, label: 'Certificado enviado', canEmit: false };
      case 'SEFAZ_VALIDATED':
        return { step: 4, total: 5, label: 'Validado pela SEFAZ', canEmit: false };
      case 'ACTIVE':
        return { step: 5, total: 5, label: 'Ativo', canEmit: true };
      case 'BLOCKED':
        return { step: 0, total: 5, label: 'Bloqueado', canEmit: false };
      default:
        return { step: 0, total: 5, label: 'Desconhecido', canEmit: false };
    }
  }, [issuer]);

  // Check certificate validity
  const isCertificateValid = useCallback((): boolean => {
    if (!certificate || !certificate.valid_until) return false;
    return new Date(certificate.valid_until) > new Date();
  }, [certificate]);

  // Get days until certificate expires
  const getCertificateDaysUntilExpiry = useCallback((): number | null => {
    if (!certificate || !certificate.valid_until) return null;
    const now = new Date();
    const expiry = new Date(certificate.valid_until);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [certificate]);

  // Initial fetch
  useEffect(() => {
    fetchIssuer();
  }, [fetchIssuer]);

  return {
    loading,
    error,
    issuer,
    certificate,
    wallet,
    fetchIssuer,
    registerIssuer,
    updateIssuer,
    uploadCertificate,
    validateWithSefaz,
    acceptTerms,
    getOnboardingProgress,
    isCertificateValid,
    getCertificateDaysUntilExpiry,
    clearError: () => setError(null),
  };
}
