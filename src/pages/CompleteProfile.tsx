import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { supabase } from '@/integrations/supabase/client';
import DocumentUpload from '@/components/DocumentUpload';
import LocationPermission from '@/components/LocationPermission';
import MapLibreMap from '@/components/map/MapLibreMap';
import { CameraSelfie } from '@/components/CameraSelfie';
import { SelfieCaptureModal } from '@/components/selfie/SelfieCaptureModal';
import { AddressLocationInput } from '@/components/AddressLocationInput';
import AutomaticApprovalService from '@/components/AutomaticApproval';
import { CheckCircle, AlertCircle, User, FileText, Truck, MapPin, Building, Plus, X, Shield, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { validateDocument } from '@/utils/cpfValidator';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { LegalDocumentDialog } from '@/components/LegalDocumentDialog';
import { uploadSelfieWithInstrumentation } from '@/utils/selfieUpload';
import { 
  getRegistrationMode, 
  getRequiredSteps, 
  getMissingForStep, 
  getDocumentsMissingMessage,
  validateCNHExpiry,
  type RegistrationMode 
} from '@/lib/registration-policy';

// Tipo PlatePhoto removido - veículos são cadastrados após o cadastro pessoal

interface AddressData {
  city: string;
  state: string;
  cityId?: string;
  lat?: number;
  lng?: number;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
}

const CompleteProfile = () => {
  const { profile, loading: authLoading, isAuthenticated, profileError, clearProfileError, retryProfileCreation, signOut, user, refreshProfile } = useAuth();
  const { company, isTransportCompany } = useTransportCompany();
  const { isCompanyDriver, isLoading: isLoadingCompany } = useCompanyDriver();
  const navigate = useNavigate();
  const [newCpf, setNewCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveringProfile, setRecoveringProfile] = useState(false);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const autoRetryMaxRef = useRef(5);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Calcular modo de cadastro usando a política centralizada
  const registrationMode: RegistrationMode = profile ? 
    getRegistrationMode(profile, user, company, isCompanyDriver) : 'PRODUTOR';
  
  // Número total de passos baseado no modo de cadastro
  const totalSteps = getRequiredSteps(registrationMode).length;
  
  // Distinct driver type flags (mantido para compatibilidade)
  const isAutonomousDriver = registrationMode === 'MOTORISTA_AUTONOMO';
  const isAffiliatedDriver = registrationMode === 'MOTORISTA_AFILIADO';
  const isDriver = isAutonomousDriver || isAffiliatedDriver;
  const [documentUrls, setDocumentUrls] = useState({
    selfie: '',
    document_photo: '',
    cnh: '',
    truck_documents: '',
    truck_photo: '',
    license_plate: '',
    address_proof: ''
  });
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    contact_phone: '',
    cpf_cnpj: '',
    farm_name: '',
    farm_address: '',
    farm_lat: null as number | null,
    farm_lng: null as number | null,
    rntrc: '',
    antt_number: '',
    cooperative: '',
    fixed_address: '',
    cnh_category: '',
    cnh_expiry_date: '' as string,
  });
  
  // Estado para endereço estruturado
  const [addressData, setAddressData] = useState<AddressData>({
    city: '',
    state: '',
    cityId: undefined,
    lat: undefined,
    lng: undefined,
    bairro: '',
    rua: '',
    numero: '',
    complemento: ''
  });
  
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  // platePhotos removido - veículos são cadastrados após o cadastro pessoal na aba Veículos
  const [acceptedDocumentsResponsibility, setAcceptedDocumentsResponsibility] = useState(false);
  const [acceptedTermsOfUse, setAcceptedTermsOfUse] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [legalDialogType, setLegalDialogType] = useState<'terms' | 'privacy' | null>(null);
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Autenticado mas perfil ainda não carregado: apenas aguarde (useAuth cuidará da criação automaticamente)
    if (isAuthenticated && !profile) {
      return;
    }

    // Inicializar dados do formulário apenas uma vez para evitar reset durante revalidações do perfil
    if (profile && !didInitRef.current) {
      // Buscar dados completos via profiles_secure (contorna CLS para o próprio dono)
      const fetchSecureProfile = async () => {
        try {
          const { data: secureData } = await supabase
            .from('profiles_secure')
            .select('cpf_cnpj, phone, contact_phone, fixed_address, farm_address, farm_name, rntrc, antt_number, cnh_category, cnh_expiry_date, selfie_url, document_photo_url, cnh_photo_url, truck_documents_url, truck_photo_url, license_plate_photo_url, address_proof_url')
            .eq('id', profile.id)
            .single();
          
          const sd = secureData as any;
          if (sd) {
            setDocumentUrls({
              selfie: sd.selfie_url || '',
              document_photo: sd.document_photo_url || '',
              cnh: sd.cnh_photo_url || '',
              truck_documents: sd.truck_documents_url || '',
              truck_photo: sd.truck_photo_url || '',
              license_plate: sd.license_plate_photo_url || '',
              address_proof: sd.address_proof_url || ''
            });
            
            setProfileData(prev => ({
              ...prev,
              full_name: prev.full_name || profile.full_name || '',
              phone: sd.phone || prev.phone || '',
              contact_phone: sd.contact_phone || prev.contact_phone || '',
              cpf_cnpj: sd.cpf_cnpj || prev.cpf_cnpj || '',
              farm_name: sd.farm_name || prev.farm_name || '',
              farm_address: sd.farm_address || prev.farm_address || '',
              rntrc: sd.rntrc || prev.rntrc || '',
              antt_number: sd.antt_number || prev.antt_number || '',
              fixed_address: sd.fixed_address || prev.fixed_address || '',
              cnh_category: sd.cnh_category || prev.cnh_category || '',
              cnh_expiry_date: sd.cnh_expiry_date || prev.cnh_expiry_date || '',
            }));
          }
        } catch (err) {
          console.warn('[CompleteProfile] Falha ao buscar dados seguros, usando perfil básico:', err);
        }
      };
      
      // Inicializar com dados disponíveis do useAuth (pode estar incompleto por CLS)
      setDocumentUrls({
        selfie: profile.selfie_url || '',
        document_photo: profile.document_photo_url || '',
        cnh: profile.cnh_photo_url || '',
        truck_documents: profile.truck_documents_url || '',
        truck_photo: profile.truck_photo_url || '',
        license_plate: profile.license_plate_photo_url || '',
        address_proof: profile.address_proof_url || ''
      });
      
      setLocationEnabled(profile.location_enabled || false);
      
      // Load profile data with safe access (dados básicos do useAuth)
      setProfileData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        contact_phone: profile.contact_phone || '',
        cpf_cnpj: (profile as any).cpf_cnpj || '',
        farm_name: (profile as any).farm_name || '',
        farm_address: (profile as any).farm_address || '',
        farm_lat: (profile as any).farm_lat,
        farm_lng: (profile as any).farm_lng,
        rntrc: (profile as any).rntrc || '',
        antt_number: (profile as any).antt_number || '',
        cooperative: (profile as any).cooperative || '',
        fixed_address: (profile as any).fixed_address || '',
        cnh_category: (profile as any).cnh_category || '',
        cnh_expiry_date: (profile as any).cnh_expiry_date || null,
      });
      
      // Buscar dados completos via view segura (resolve CLS)
      fetchSecureProfile();
      
      // Load structured address from fixed_address if available
      if ((profile as any).fixed_address) {
        // Tentar extrair dados do endereço já salvo
        const savedAddress = (profile as any).fixed_address;
        setProfileData(prev => ({ ...prev, fixed_address: savedAddress }));
      }

      // Redirect if profile is fully complete (even if pending approval)
      const hasCompletedProfile = profile.selfie_url && profile.document_photo_url && 
        (!isAutonomousDriver || (
          profile.cnh_photo_url && 
          profile.address_proof_url &&
          profile.location_enabled
        ));

      if (hasCompletedProfile) {
        const dashboardPath = isDriver
          ? '/dashboard/driver'
          : (profile.role === 'TRANSPORTADORA' || profile.active_mode === 'TRANSPORTADORA' || isTransportCompany)
            ? '/dashboard/company'
            : (profile.role as any) === 'PRESTADOR_SERVICOS'
              ? '/dashboard/service-provider'
              : '/dashboard/producer';
        navigate(dashboardPath);
      }

      // Evita reidratação em atualizações subsequentes do perfil
      didInitRef.current = true;
    }
  }, [profile, authLoading, isAuthenticated, navigate]);

  // Função para construir endereço completo
  const buildFullAddress = () => {
    const parts = [];
    if (addressData.rua) parts.push(addressData.rua);
    if (addressData.numero) parts.push(addressData.numero);
    if (addressData.bairro) parts.push(addressData.bairro);
    if (addressData.complemento) parts.push(addressData.complemento);
    if (addressData.city && addressData.state) parts.push(`${addressData.city} - ${addressData.state}`);
    return parts.join(', ');
  };
  
  // Atualizar fixed_address quando os campos de endereço mudarem
  useEffect(() => {
    if (addressData.city && addressData.rua && addressData.numero) {
      const fullAddress = buildFullAddress();
      setProfileData(prev => ({ ...prev, fixed_address: fullAddress }));
    }
  }, [addressData]);

  // ✅ Auto-retry: tentar buscar perfil automaticamente antes de mostrar tela de recuperação
  useEffect(() => {
    if (!authLoading && isAuthenticated && !profile && autoRetryCount < autoRetryMaxRef.current) {
      const timer = setTimeout(async () => {
        if (import.meta.env.DEV) console.log(`[CompleteProfile] Auto-retry ${autoRetryCount + 1}/${autoRetryMaxRef.current}...`);
        try {
          sessionStorage.removeItem('profile_fetch_cooldown_until');
        } catch {}
        await refreshProfile();
        setAutoRetryCount(prev => prev + 1);
      }, autoRetryCount === 0 ? 500 : 1500);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, profile, autoRetryCount, refreshProfile]);

  const ensureLocationEnabled = async (): Promise<boolean> => {
    if (locationEnabled) return true;
    try {
      const { getCurrentPositionSafe } = await import('@/utils/location');
      await getCurrentPositionSafe();
      setLocationEnabled(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveAndContinue = async () => {
    if (!profile) return;

    const state = {
      profileData,
      documentUrls,
      platePhotos: [], // Removido - veículos são adicionados após o cadastro
      vehicles: [], // Veículos agora são adicionados após o cadastro
      skipVehicleRegistration: true, // Sempre pular cadastro de veículos durante registro
      locationEnabled
    };

    // Validar passo 1: dados básicos
    if (currentStep === 1) {
      const missing = getMissingForStep(registrationMode, 'dados_basicos', state);
      
      if (missing.length > 0) {
        const message = missing.length === 1 
          ? `Por favor, preencha o campo: ${missing[0]}`
          : `Por favor, preencha os campos: ${missing.join(', ')}`;
        toast.error(message);
        return;
      }
      
      // Validar CPF/CNPJ
      if (!validateDocument(profileData.cpf_cnpj)) {
        toast.error('CPF/CNPJ inválido. Verifique os dados informados.');
        return;
      }
      
      setCurrentStep(2);
      return;
    }

    // Validar passo 2: documentos básicos
    if (currentStep === 2) {
      const missing = getMissingForStep(registrationMode, 'documentos_basicos', state);
      
      if (missing.length > 0) {
        toast.error(`Por favor, envie: ${missing.join(', ')}`);
        return;
      }
      
      // Motoristas vão para o passo 3
      if (registrationMode === 'MOTORISTA_AUTONOMO' || registrationMode === 'MOTORISTA_AFILIADO') {
        setCurrentStep(3);
        return;
      }
      
      // Demais perfis finalizam no passo 2
      await finalizeProfile();
      return;
    }
    
    // Validar passo 3: documentos de motorista (CNH, endereço, localização - SEM veículos)
    if (currentStep === 3 && isDriver) {
      const missing = getMissingForStep(registrationMode, 'documentos_e_veiculos', state);
      
      if (missing.length > 0) {
        toast.error(`Por favor, envie: ${missing.join(', ')}`);
        return;
      }
      
      // Termos já aceitos no signup (Auth.tsx) - não duplicar validação

      // Validar vencimento de CNH
      const cnhValidation = validateCNHExpiry(registrationMode, profileData.cnh_expiry_date);
      if (!cnhValidation.valid) {
        toast.error(cnhValidation.message!);
        return;
      }
      if (cnhValidation.message) {
        toast.warning(cnhValidation.message);
      }
      
      // Finalizar cadastro
      await finalizeProfile();
      return;
    }
  };

  const finalizeProfile = async () => {
    if (import.meta.env.DEV) console.log('🚀 Iniciando finalização do perfil...', { profileData, documentUrls });

    // Validação final de selfie
    if (!documentUrls.selfie) {
      toast.error('Selfie não foi enviada. Por favor, tire uma selfie antes de continuar.');
      console.error('❌ Selfie ausente na finalização');
      return;
    }

    setLoading(true);

    try {
      // Helper function to clean empty fields
      const cleanEmptyFields = (data: any) => {
        const cleaned = { ...data };
        Object.keys(cleaned).forEach(key => {
          if (cleaned[key] === '' || cleaned[key] === undefined) {
            cleaned[key] = null;
          }
        });
        return cleaned;
      };

      // Fotos de placas removidas - veículos são cadastrados após o cadastro
      const platePhotosMetadata: any[] = [];

      // Preparar dados base (obrigatórios para todos)
      const baseUpdateData = {
        full_name: profileData.full_name,
        phone: profileData.phone,
        cpf_cnpj: profileData.cpf_cnpj,
        fixed_address: profileData.fixed_address,
        selfie_url: documentUrls.selfie,
        document_photo_url: documentUrls.document_photo,
        address_proof_url: documentUrls.address_proof,
        location_enabled: locationEnabled,
        metadata: {
        ...((profile as any).metadata || {}),
        plate_photos: platePhotosMetadata,
        vehicle_registration_skipped: true, // Veículos são adicionados após o cadastro
        terms_acceptance: {
            documents_responsibility: new Date().toISOString(),
            terms_of_use: new Date().toISOString(),
            privacy_policy: new Date().toISOString(),
            accepted_at_signup: true,
            user_agent: navigator.userAgent
          }
        }
      };

      // Adicionar campos específicos baseado no tipo de perfil
      let updateData: any = { ...baseUpdateData };

      if (!isTransportCompany) {
        // Campos específicos de motorista comum
        updateData = {
          ...updateData,
          rntrc: profileData.rntrc || null,
          cnh_category: (profileData as any).cnh_category || null,
          cnh_expiry_date: profileData.cnh_expiry_date || null,
          cnh_photo_url: documentUrls.cnh || null,
          truck_documents_url: documentUrls.truck_documents || null,
          truck_photo_url: documentUrls.truck_photo || null,
          license_plate_photo_url: documentUrls.license_plate || null,
          antt_number: profileData.antt_number || null,
          cooperative: profileData.cooperative || null,
        };
      }

      // Para produtores, adicionar campos específicos
      if (profile.role === 'PRODUTOR') {
        updateData = {
          ...updateData,
          farm_name: profileData.farm_name || null,
          farm_address: profileData.farm_address || null,
          farm_lat: profileData.farm_lat || null,
          farm_lng: profileData.farm_lng || null,
          contact_phone: profileData.contact_phone || null,
        };
      }

      if (import.meta.env.DEV) console.log('💾 Salvando no banco de dados');

      const { error } = await supabase
        .from('profiles')
        .update(cleanEmptyFields(updateData))
        .eq('user_id', profile.user_id);

      if (error) {
        console.error('❌ Erro ao salvar perfil:', error);
        throw error;
      }
      
      if (import.meta.env.DEV) console.log('✅ Perfil salvo com sucesso!');

      if (import.meta.env.DEV) console.log('🤖 Iniciando aprovação automática...');
      const approvalResult = await AutomaticApprovalService.triggerApprovalProcess(profile.id);
      
      if (approvalResult?.approved) {
        if (import.meta.env.DEV) console.log('✅ Perfil aprovado automaticamente!');
        toast.success('Perfil completado e aprovado! Bem-vindo(a) ao AgriRoute Connect.');
      } else {
        if (import.meta.env.DEV) console.log('⏳ Perfil em análise manual');
        toast.success('Perfil completado! Você já pode acessar a plataforma.');
      }
      
      // Redirect to appropriate dashboard based on role
      if (isDriver) {
        navigate('/dashboard/driver');
      } else if (profile.role === 'PRODUTOR') {
        navigate('/dashboard/producer');
      } else if ((profile.role as any) === 'PRESTADOR_SERVICOS') {
        navigate('/dashboard/service-provider');
      } else if (profile.role === 'TRANSPORTADORA' || isTransportCompany) {
        navigate('/dashboard/company');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar erro de CPF duplicado
  if (profileError?.code === 'DOCUMENT_IN_USE') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>CPF/CNPJ já cadastrado</CardTitle>
            </div>
            <CardDescription>
              Este documento já está em uso em outra conta. Escolha uma das opções abaixo:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O CPF/CNPJ <strong>***{profileError.document?.slice(-4)}</strong> já possui cadastro.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div>
                <Label htmlFor="new-cpf">Usar outro CPF/CNPJ</Label>
                <Input
                  id="new-cpf"
                  placeholder="Digite outro documento"
                  value={newCpf}
                  onChange={(e) => setNewCpf(e.target.value.replace(/\D/g, ''))}
                  maxLength={14}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => {
                  if (newCpf.length >= 11) {
                    retryProfileCreation(newCpf);
                  } else {
                    toast.error('Digite um CPF/CNPJ válido');
                  }
                }}
                disabled={!newCpf || newCpf.length < 11}
              >
                Tentar com outro documento
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
            >
              Entrar com o e-mail original
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Precisa de ajuda?{' '}
              <a 
                href="https://wa.me/5566992734632" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Falar com suporte
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || (!profile && autoRetryCount < autoRetryMaxRef.current)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    const handleCreateMissingProfile = async () => {
      if (!user?.id) return;
      setRecoveringProfile(true);
      try {
        const meta: any = (user as any)?.user_metadata || {};
        const rawRole = String(meta?.role || meta?.active_mode || 'PRODUTOR').toUpperCase();
        const role = rawRole === 'MOTORISTA_AUTONOMO' ? 'MOTORISTA' : rawRole;

        const document = (meta?.document || meta?.cpf_cnpj || meta?.cpfCnpj || '').toString();
        const fullName = (meta?.full_name || meta?.name || '').toString();
        const phone = (meta?.phone || '').toString();

        if (import.meta.env.DEV) console.log('[CompleteProfile] Criando perfil via RPC...', { role, hasDocument: !!document });

        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_additional_profile', {
          p_user_id: user.id,
          p_role: role,
          p_document: document ? document : null,
          p_full_name: fullName ? fullName : null,
          p_phone: phone ? phone : null,
        });

        if (rpcError) {
          throw rpcError;
        }

        const result = rpcResult as any;
        if (import.meta.env.DEV) console.log('[CompleteProfile] RPC result:', result);
        
        if (!result?.success) {
          toast.error(result?.message || 'Não foi possível finalizar seu cadastro.');
          return;
        }

        toast.success('Perfil criado! Carregando dados...');
        
        // ✅ FIX: Aguardar a transação ser commitada antes de buscar o perfil
        // Delay de 800ms para garantir consistência eventual do banco
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // ✅ FIX: Retry loop para buscar o perfil recém-criado
        const maxRetries = 3;
        let profileFound = false;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (import.meta.env.DEV) console.log(`[CompleteProfile] Tentativa ${attempt}/${maxRetries} de carregar perfil...`);
          
          // Limpar cache para forçar busca fresca
          try {
            sessionStorage.removeItem('profile_fetch_cooldown_until');
          } catch {}
          
          await refreshProfile();
          
          // Verificar se o perfil foi carregado (aguardando um momento para o estado atualizar)
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Se ainda não temos perfil e não é a última tentativa, aguardar mais
          if (attempt < maxRetries) {
            // Buscar diretamente do banco para verificar
            const { data: directCheck } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);
            
            if (directCheck && directCheck.length > 0) {
              if (import.meta.env.DEV) console.log('[CompleteProfile] ✅ Perfil encontrado no banco, forçando reload...');
              profileFound = true;
              // Forçar um reload completo para garantir que o estado seja atualizado
              window.location.reload();
              return;
            }
            
            // Aguardar antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!profileFound) {
          console.warn('[CompleteProfile] Perfil criado mas não encontrado após retries');
          toast.info('Perfil criado. Recarregando página...');
          window.location.reload();
        }
      } catch (err: any) {
        console.error('[CompleteProfile] Falha ao recuperar perfil:', err);
        toast.error('Não conseguimos finalizar seu cadastro automaticamente. Tente novamente.');
      } finally {
        setRecoveringProfile(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Finalizando seu cadastro…</CardTitle>
            <CardDescription>
              Seu usuário foi criado, mas o perfil ainda não apareceu no sistema. Isso pode acontecer quando o e-mail foi confirmado e o perfil demorou a ser gerado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Aguardando perfil…</span>
            </div>

            <div className="grid gap-2">
              <Button
                type="button"
                onClick={() => refreshProfile()}
                disabled={recoveringProfile}
              >
                Tentar novamente
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateMissingProfile}
                disabled={recoveringProfile}
              >
                Finalizar cadastro agora
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => signOut()}
                disabled={recoveringProfile}
              >
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingCompany && profile?.role === 'MOTORISTA') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Clamp defensivo: evita mostrar "3 de 2" mesmo se algo escape
  const safeCurrentStep = Math.min(currentStep, totalSteps);
  const progress = (safeCurrentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader className="text-center">
          <CardTitle className="text-2xl">Complete seu Perfil</CardTitle>
            <CardDescription>
              {isAutonomousDriver 
                ? 'Envie seus documentos, cadastre seus veículos e ative a localização'
                : isAffiliatedDriver
                ? 'Envie seus documentos para completar o cadastro. Seus veículos serão cadastrados pela transportadora.'
                : 'Envie seus documentos para completar o cadastro'
              }
            </CardDescription>
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Etapa {safeCurrentStep} de {totalSteps}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Informações Básicas</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome Completo - somente leitura se já preenchido no cadastro */}
                  {profileData.full_name ? (
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nome Completo ✓</Label>
                      <Input
                        id="full_name"
                        value={profileData.full_name}
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">Informado no cadastro</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nome Completo *</Label>
                      <Input
                        id="full_name"
                        value={profileData.full_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                        required
                      />
                    </div>
                  )}

                  {/* CPF/CNPJ - somente leitura se já preenchido no cadastro */}
                  {profileData.cpf_cnpj ? (
                    <div className="space-y-2">
                      <Label htmlFor="cpf_cnpj">CPF/CNPJ ✓</Label>
                      <Input
                        id="cpf_cnpj"
                        value={profileData.cpf_cnpj}
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">Informado no cadastro</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
                      <Input
                        id="cpf_cnpj"
                        value={profileData.cpf_cnpj}
                        onChange={(e) => setProfileData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                        required
                      />
                    </div>
                  )}

                  {/* Telefone WhatsApp - somente leitura se já preenchido no cadastro */}
                  {profileData.phone ? (
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone WhatsApp ✓</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={profileData.phone}
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">Informado no cadastro</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone WhatsApp *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        required
                      />
                    </div>
                  )}

                      <div className="space-y-2">
                        <Label htmlFor="contact_phone">Telefone de Contato</Label>
                        <Input
                          id="contact_phone"
                          type="tel"
                          value={profileData.contact_phone}
                          onChange={(e) => setProfileData(prev => ({ ...prev, contact_phone: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Endereço Estruturado com CitySelector */}
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h4 className="text-md font-semibold">Endereço Completo *</h4>
                      </div>
                      
                      {/* Cidade com validação - aceita CEP ou nome da cidade */}
                      <AddressLocationInput
                        value={addressData.city && addressData.state ? {
                          city: addressData.city,
                          state: addressData.state,
                          id: addressData.cityId,
                          lat: addressData.lat,
                          lng: addressData.lng
                        } : undefined}
                        onChange={(data) => setAddressData(prev => ({
                          ...prev,
                          city: data.city,
                          state: data.state,
                          cityId: data.id,
                          lat: data.lat,
                          lng: data.lng,
                          bairro: data.neighborhood || prev.bairro // Auto-preencher bairro do CEP
                        }))}
                        label="Cidade *"
                        required={true}
                        error={!addressData.cityId && addressData.city ? 'Selecione uma cidade da lista ou digite um CEP válido' : undefined}
                      />
                      
                      {/* Bairro e Rua */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="bairro">Bairro *</Label>
                          <Input
                            id="bairro"
                            value={addressData.bairro}
                            onChange={(e) => setAddressData(prev => ({ ...prev, bairro: e.target.value }))}
                            placeholder="Ex: Centro, Jardim América"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rua">Rua *</Label>
                          <Input
                            id="rua"
                            value={addressData.rua}
                            onChange={(e) => setAddressData(prev => ({ ...prev, rua: e.target.value }))}
                            placeholder="Ex: Rua das Flores"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* Número e Complemento */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="numero">Número *</Label>
                          <Input
                            id="numero"
                            value={addressData.numero}
                            onChange={(e) => setAddressData(prev => ({ ...prev, numero: e.target.value }))}
                            placeholder="Ex: 123"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="complemento">Complemento</Label>
                          <Input
                            id="complemento"
                            value={addressData.complemento}
                            onChange={(e) => setAddressData(prev => ({ ...prev, complemento: e.target.value }))}
                            placeholder="Ex: Apt 101, Bloco A"
                          />
                        </div>
                      </div>
                      
                      {/* Validação visual */}
                      {addressData.cityId && addressData.bairro && addressData.rua && addressData.numero && (
                        <Alert className="bg-green-50 border-green-200">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            ✅ Endereço validado: {buildFullAddress()}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                {/* Producer-specific fields */}
                {profile.role === 'PRODUTOR' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Building className="h-5 w-5 text-primary" />
                      <h4 className="text-md font-semibold">Dados da Fazenda</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="farm_name">Nome da Fazenda</Label>
                        <Input
                          id="farm_name"
                          value={profileData.farm_name}
                          onChange={(e) => setProfileData(prev => ({ ...prev, farm_name: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="farm_address">Endereço da Fazenda</Label>
                        <Input
                          id="farm_address"
                          value={profileData.farm_address}
                          onChange={(e) => setProfileData(prev => ({ ...prev, farm_address: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Driver-specific fields */}
                {isDriver && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-5 w-5 text-primary" />
                      <h4 className="text-md font-semibold">Dados Profissionais</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rntrc">RNTRC *</Label>
                        <Input
                          id="rntrc"
                          value={profileData.rntrc}
                          onChange={(e) => setProfileData(prev => ({ ...prev, rntrc: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="antt_number">Número ANTT</Label>
                        <Input
                          id="antt_number"
                          value={profileData.antt_number}
                          onChange={(e) => setProfileData(prev => ({ ...prev, antt_number: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cooperative">Cooperativa</Label>
                        <Input
                          id="cooperative"
                          value={profileData.cooperative}
                          onChange={(e) => setProfileData(prev => ({ ...prev, cooperative: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSaveAndContinue}>
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Basic Documents */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Documentos Básicos</h3>
                </div>

                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-900 dark:text-blue-100">Importante - Responsabilidade do Cadastro</AlertTitle>
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Somente a pessoa que enviar estes documentos e selfie estará apta para solicitar troca de senhas e outras alterações de segurança na plataforma.</li>
                      <li>Esta pessoa será considerada a responsável oficial pelo cadastro da empresa, caso seja uma transportadora.</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Selfie *</Label>
                  {documentUrls.selfie ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">Selfie capturada com sucesso!</span>
                      </div>
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-green-500">
                        <img 
                          src={documentUrls.selfie} 
                          alt="Selfie Preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>Selfie ainda não capturada</span>
                    </div>
                  )}
                  <Button 
                    onClick={() => setShowSelfieModal(true)} 
                    variant={documentUrls.selfie ? "outline" : "secondary"}
                  >
                    {documentUrls.selfie ? 'Refazer Selfie' : 'Capturar Selfie'}
                  </Button>

                  <SelfieCaptureModal
                    isOpen={showSelfieModal}
                    title="Capturar Selfie"
                    onClose={() => setShowSelfieModal(false)}
                  >
                    <CameraSelfie
                      autoStart
                      onCapture={async (blob, uploadMethod) => {
                          try {
                            toast.loading('Enviando selfie...', { id: 'selfie-upload' });

                            const result = await uploadSelfieWithInstrumentation({ blob, uploadMethod });

                            if (!result.success && result.error) {
                              // Exibir erro real ao usuário
                              const errorMsg = result.error.status
                                ? `${result.error.message} (${result.error.status})`
                                : result.error.message;

                              toast.error(errorMsg, { id: 'selfie-upload' });

                              // Se sessão expirou, redirecionar para login
                              if (result.error.code === 'SESSION_EXPIRED') {
                                setTimeout(() => {
                                  localStorage.setItem('redirect_after_login', window.location.pathname);
                                  window.location.href = '/auth';
                                }, 1500);
                              }
                              return;
                            }

                            // Sucesso - atualizar estado
                            setDocumentUrls(prev => ({ ...prev, selfie: result.signedUrl || '' }));
                            toast.success(
                              `✅ Selfie ${uploadMethod === 'CAMERA' ? 'capturada' : 'enviada da galeria'} com sucesso!`,
                              { id: 'selfie-upload' }
                            );
                            setShowSelfieModal(false);
                          } catch (error: any) {
                            // Protege contra falhas de import dinâmico / cache / rede que derrubavam a tela
                            console.error('[CompleteProfile] Falha ao enviar selfie:', error);
                            toast.error(
                              'Falha ao enviar a selfie. Recarregue a página e tente novamente.',
                              { id: 'selfie-upload' }
                            );
                          }
                      }}
                      onCancel={() => setShowSelfieModal(false)}
                    />
                  </SelfieCaptureModal>
                </div>

                <DocumentUpload
                  label={isDriver ? "Foto da Frente da CNH *" : "Foto do Documento (RG/CNH) *"}
                  fileType="document"
                  bucketName="profile-photos"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, document_photo: url }))}
                  required
                />

                {/* Para motoristas: foto do verso da CNH e comprovante de endereço no step 2 */}
                {isDriver && (
                  <>
                    <DocumentUpload
                      label="Foto do Verso da CNH *"
                      fileType="cnh"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, cnh: url }))}
                      required
                    />

                    <DocumentUpload
                      label="Comprovante de Endereço *"
                      fileType="address"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, address_proof: url }))}
                      required
                      accept="image/*,application/pdf"
                    />
                  </>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Voltar
                  </Button>
                  <Button onClick={handleSaveAndContinue}>
                    {isDriver ? 'Continuar' : 'Finalizar Cadastro'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Driver Documents and Vehicles */}
            {currentStep === 3 && isDriver && (
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Finalização do Cadastro</h3>
                </div>

                {/* Aviso sobre veículos para motoristas */}
                {isAutonomousDriver && (
                  <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                    <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">
                      Cadastro de Veículos
                    </AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      <p>
                        Após finalizar seu cadastro, você poderá adicionar seus veículos na aba "Veículos" do seu painel.
                        <strong> É necessário ter pelo menos um veículo cadastrado para aceitar fretes.</strong>
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Categoria e Vencimento da CNH - apenas dados, sem upload de foto */}
                {!isTransportCompany && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnh_category">Categoria da CNH *</Label>
                        <Select
                          value={(profileData as any).cnh_category || ''}
                          onValueChange={(value) => setProfileData(prev => ({ ...prev, cnh_category: value } as any))}
                        >
                          <SelectTrigger id="cnh_category">
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A - Motos</SelectItem>
                            <SelectItem value="B">B - Carros</SelectItem>
                            <SelectItem value="C">C - Caminhões leves</SelectItem>
                            <SelectItem value="D">D - Ônibus</SelectItem>
                            <SelectItem value="E">E - Caminhões pesados</SelectItem>
                            <SelectItem value="AB">AB - A + B</SelectItem>
                            <SelectItem value="AC">AC - A + C</SelectItem>
                            <SelectItem value="AD">AD - A + D</SelectItem>
                            <SelectItem value="AE">AE - A + E</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cnh_expiry_date">Data de Vencimento da CNH *</Label>
                        <Input
                          id="cnh_expiry_date"
                          type="date"
                          value={profileData.cnh_expiry_date || ''}
                          onChange={(e) => setProfileData(prev => ({ ...prev, cnh_expiry_date: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          ⚠️ A CNH deve estar dentro da validade
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {!isTransportCompany && (
                  <LocationPermission
                    onPermissionChange={setLocationEnabled}
                    required
                  />
                )}

                {/* Termos já aceitos no signup (Auth.tsx) - removido para evitar duplicação */}

                <div className="flex justify-between">
                  <Button 
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                  >
                    Voltar
                  </Button>
                  <Button 
                    onClick={handleSaveAndContinue}
                    disabled={loading}
                  >
                    {loading ? 'Salvando...' : 'Finalizar Cadastro'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LegalDocumentDialog
        open={legalDialogType !== null}
        onOpenChange={(open) => { if (!open) setLegalDialogType(null); }}
        documentType={legalDialogType ?? 'terms'}
      />
    </div>
  );
};

export default CompleteProfile;