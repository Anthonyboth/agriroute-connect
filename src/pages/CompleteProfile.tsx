import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { supabase } from '@/integrations/supabase/client';
import DocumentUpload from '@/components/DocumentUpload';
import LocationPermission from '@/components/LocationPermission';
import GoogleMap from '@/components/GoogleMap';
import { CameraSelfie } from '@/components/CameraSelfie';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AddressInput } from '@/components/AddressInput';
import AutomaticApprovalService from '@/components/AutomaticApproval';
import { CheckCircle, AlertCircle, User, FileText, Truck, MapPin, Building, Plus, X, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { validateDocument } from '@/utils/cpfValidator';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { 
  getRegistrationMode, 
  getRequiredSteps, 
  getMissingForStep, 
  getDocumentsMissingMessage,
  validateCNHExpiry,
  type RegistrationMode 
} from '@/lib/registration-policy';

type PlatePhoto = {
  id: string;
  type: 'TRACTOR' | 'TRAILER';
  url: string;
  label: string;
};

const CompleteProfile = () => {
  const { profile, loading: authLoading, isAuthenticated, profileError, clearProfileError, retryProfileCreation, signOut, user, isApproved } = useAuth();
  const { company, isTransportCompany } = useTransportCompany();
  const { isCompanyDriver, isLoading: isLoadingCompany } = useCompanyDriver();
  const navigate = useNavigate();
  const [newCpf, setNewCpf] = useState('');
  const [loading, setLoading] = useState(false);
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
    cnh_expiry_date: '' as string,
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_type: '',
    axle_count: 2,
    max_capacity_tons: 0,
    license_plate: '',
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [skipVehicleRegistration, setSkipVehicleRegistration] = useState(false);
  const [showVehicleChoice, setShowVehicleChoice] = useState(true);
  const [platePhotos, setPlatePhotos] = useState<PlatePhoto[]>([
    { id: '1', type: 'TRACTOR', url: '', label: 'Placa do Cavalo (Trator)' }
  ]);
  const [acceptedDocumentsResponsibility, setAcceptedDocumentsResponsibility] = useState(false);
  const [acceptedTermsOfUse, setAcceptedTermsOfUse] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
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

    // ✅ Se o perfil já está aprovado, redirecionar imediatamente para o painel correto
    if (profile && (isApproved || profile.status === 'APPROVED')) {
      const dashboardPath =
        profile.active_mode === 'TRANSPORTADORA' ? '/dashboard/company' :
        (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO') ? '/dashboard/driver' :
        profile.role === 'PRODUTOR' ? '/dashboard/producer' :
        profile.role === 'PRESTADOR_SERVICOS' ? '/dashboard/service-provider' :
        profile.role === 'ADMIN' ? '/admin' : '/';
      navigate(dashboardPath, { replace: true });
      return;
    }

    // Inicializar dados do formulário apenas uma vez para evitar reset durante revalidações do perfil
    if (profile && !didInitRef.current) {
      // Load existing document URLs
      setDocumentUrls({
        selfie: profile.selfie_url || '',
        document_photo: profile.document_photo_url || '',
        cnh: profile.cnh_photo_url || '',
        truck_documents: profile.truck_documents_url || '',
        truck_photo: profile.truck_photo_url || '',
        license_plate: profile.license_plate_photo_url || '',
        address_proof: profile.address_proof_url || ''
      });
      
      // Load plate photos from metadata
      const metadata = (profile as any).metadata;
      if (metadata?.plate_photos) {
        setPlatePhotos(metadata.plate_photos);
      }
      
      // Load vehicle registration skip status
      if (metadata?.vehicle_registration_skipped) {
        setSkipVehicleRegistration(true);
        setShowVehicleChoice(false);
      }
      setLocationEnabled(profile.location_enabled || false);
      
      // Load profile data with safe access
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
        cnh_expiry_date: (profile as any).cnh_expiry_date || null,
      });

      // Fetch vehicles for autonomous drivers only
      if (isAutonomousDriver) {
        fetchVehicles();
      }

      // Redirect if profile is fully complete (even if pending approval)
      const hasCompletedProfile = profile.selfie_url && profile.document_photo_url && 
        (!isAutonomousDriver || (
          profile.cnh_photo_url && 
          profile.address_proof_url &&
          profile.location_enabled
        ));

      if (hasCompletedProfile) {
        const dashboardPath = isDriver ? '/dashboard/driver' : 
                             (profile.role as any) === 'PRESTADOR_SERVICOS' ? '/dashboard/service-provider' :
                             '/dashboard/producer';
        navigate(dashboardPath);
      }

      // Evita reidratação em atualizações subsequentes do perfil
      didInitRef.current = true;
    }
  }, [profile, authLoading, isAuthenticated, navigate]);

  const fetchVehicles = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('driver_id', profile.id);

    if (!error && data) {
      setVehicles(data);
    }
  };

  const addVehicle = async () => {
    if (!profile || !newVehicle.vehicle_type || !newVehicle.license_plate) return;

    const { error } = await supabase
      .from('vehicles')
      .insert({
        driver_id: profile.id,
        vehicle_type: newVehicle.vehicle_type as 'TRUCK' | 'BITREM' | 'RODOTREM' | 'CARRETA' | 'VUC' | 'TOCO',
        axle_count: newVehicle.axle_count,
        max_capacity_tons: newVehicle.max_capacity_tons,
        license_plate: newVehicle.license_plate,
      });

    if (error) {
      toast.error('Erro ao cadastrar veículo. Tente novamente.');
    } else {
      toast.success('Veículo cadastrado com sucesso!');
      setNewVehicle({
        vehicle_type: '',
        axle_count: 2,
        max_capacity_tons: 0,
        license_plate: '',
      });
      fetchVehicles();
    }
  };

  const deleteVehicle = async (vehicleId: string) => {
    if (!profile) return;
    setVehicleToDelete(vehicleId);
    setConfirmDialogOpen(true);
  };

  const confirmDeleteVehicle = async () => {
    if (!profile || !vehicleToDelete) return;

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleToDelete)
      .eq('driver_id', profile.id);

    if (error) {
      toast.error('Erro ao remover veículo. Tente novamente.');
    } else {
      toast.success('Veículo removido com sucesso');
      setVehicles(prev => prev.filter(v => v.id !== vehicleToDelete));
    }
  };

  const uploadVehicleFile = async (
    vehicleId: string,
    field: 'crlv_url' | 'vehicle_photo_url' | 'insurance_document_url',
    file: File,
    label: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const ext = file.name.split('.').pop();
      const path = `${user.id}/vehicles/${vehicleId}/${field}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('vehicles')
        .update({ [field]: path })
        .eq('id', vehicleId)
        .eq('driver_id', profile!.id);
      if (updateError) throw updateError;

      setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, [field]: path } : v));
      toast.success(`${label} enviado com sucesso!`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha ao enviar ${label}`);
    }
  };

  const ensureLocationEnabled = async (): Promise<boolean> => {
    if (locationEnabled) return true;
    if ('geolocation' in navigator) {
      try {
        const enabled = await new Promise<boolean>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => { resolve(true); },
            () => resolve(false),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        });
        if (enabled) setLocationEnabled(true);
        return enabled;
      } catch {
        return false;
      }
    }
    return false;
  };

  const handleSaveAndContinue = async () => {
    if (!profile) return;

    const state = {
      profileData,
      documentUrls,
      platePhotos,
      vehicles,
      skipVehicleRegistration,
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
      
      // Se for motorista autônomo: ir para passo 3
      if (registrationMode === 'MOTORISTA_AUTONOMO') {
        setCurrentStep(3);
        return;
      }
      
      // Outros perfis: finalizar aqui
      await finalizeProfile();
      return;
    }

    // Validar passo 3: documentos e veículos (apenas motorista autônomo)
    if (currentStep === 3 && registrationMode === 'MOTORISTA_AUTONOMO') {
      const missing = getMissingForStep(registrationMode, 'documentos_e_veiculos', state);
      
      if (missing.length > 0) {
        toast.error(getDocumentsMissingMessage(registrationMode, missing));
        return;
      }

      // Verificar aceites obrigatórios
      if (!acceptedDocumentsResponsibility) {
        toast.error('Você deve declarar a veracidade dos documentos enviados');
        return;
      }
      
      if (!acceptedTermsOfUse) {
        toast.error('Você deve aceitar os Termos de Uso para continuar');
        return;
      }
      
      if (!acceptedPrivacyPolicy) {
        toast.error('Você deve aceitar a Política de Privacidade para continuar');
        return;
      }

      // Validar vencimento de CNH
      const cnhValidation = validateCNHExpiry(registrationMode, profileData.cnh_expiry_date);
      if (!cnhValidation.valid) {
        toast.error(cnhValidation.message!);
        return;
      }
      if (cnhValidation.message) {
        toast.warning(cnhValidation.message);
      }

      await finalizeProfile();
    }
  };

  const finalizeProfile = async () => {
    console.log('🚀 Iniciando finalização do perfil...');
    console.log('📋 Dados do perfil:', profileData);
    console.log('📄 URLs dos documentos:', documentUrls);

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

      // Salvar metadata com as fotos de placas
      const platePhotosMetadata = platePhotos.map(p => ({
        type: p.type,
        label: p.label,
        url: p.url
      }));

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
          vehicle_registration_skipped: skipVehicleRegistration,
          terms_acceptance: {
            documents_responsibility: acceptedDocumentsResponsibility ? new Date().toISOString() : null,
            terms_of_use: acceptedTermsOfUse ? new Date().toISOString() : null,
            privacy_policy: acceptedPrivacyPolicy ? new Date().toISOString() : null,
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

      console.log('💾 Salvando no banco de dados:', updateData);

      const { error } = await supabase
        .from('profiles')
        .update(cleanEmptyFields(updateData))
        .eq('user_id', profile.user_id);

      if (error) {
        console.error('❌ Erro ao salvar perfil:', error);
        throw error;
      }
      
      console.log('✅ Perfil salvo com sucesso!');

      // Trigger automatic approval process and wait for result
      console.log('🤖 Iniciando aprovação automática...');
      const approvalResult = await AutomaticApprovalService.triggerApprovalProcess(profile.id);
      
      if (approvalResult?.approved) {
        console.log('✅ Perfil aprovado automaticamente!');
        toast.success('Perfil completado e aprovado! Bem-vindo(a) ao AgriRoute Connect.');
      } else {
        console.log('⏳ Perfil em análise manual');
        toast.success('Perfil completado! Você já pode acessar a plataforma.');
      }
      
      // Redirect to appropriate dashboard
      if (isDriver) {
        navigate('/dashboard/driver');
      } else if (profile.role === 'PRODUTOR') {
        navigate('/dashboard/producer');
      } else if ((profile.role as any) === 'PRESTADOR_SERVICOS') {
        navigate('/dashboard/service-provider');
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
                href="https://wa.me/5565999999999" 
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Preparando seu cadastro...</p>
        </div>
      </div>
    );
  }

  if (isLoadingCompany && profile?.role === 'MOTORISTA') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Verificando vínculo com transportadora...</p>
        </div>
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
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo *</Label>
                    <Input
                      id="full_name"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
                    <Input
                      id="cpf_cnpj"
                      value={profileData.cpf_cnpj}
                      onChange={(e) => setProfileData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                      required
                    />
                  </div>

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

                    {/* Fixed Address - Required for all users */}
                    <div className="space-y-4">
                      <AddressInput
                        address={profileData.fixed_address}
                        onAddressChange={(address) => setProfileData(prev => ({ ...prev, fixed_address: address }))}
                        label="Endereço Fixo"
                        required={true}
                        placeholder="Rua, número, bairro/fazenda, cidade, estado, CEP"
                      />
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

                  <Dialog open={showSelfieModal} onOpenChange={setShowSelfieModal}>
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Capturar Selfie</DialogTitle>
                      </DialogHeader>
                      <CameraSelfie autoStart
                        onCapture={async (blob, uploadMethod) => {
                          console.log('📸 Selfie capturada, iniciando upload...');
                          try {
                            toast.loading('Enviando selfie...', { id: 'selfie-upload' });
                            
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) {
                              toast.error('Faça login para enviar a selfie.', { id: 'selfie-upload' });
                              return;
                            }
                            
                            const path = `${user.id}/identity_selfie_${Date.now()}.jpg`;
                            console.log('📁 Fazendo upload para:', path);
                            
                            const { error: uploadError } = await supabase.storage
                              .from('profile-photos')
                              .upload(path, blob, { contentType: 'image/jpeg' });
                            
                            if (uploadError) {
                              console.error('❌ Erro no upload:', uploadError);
                              throw uploadError;
                            }

                            console.log('✅ Upload concluído com sucesso');

                            // URL assinada para visualização (bucket é privado)
                            const { data: signedData, error: signedErr } = await supabase.storage
                              .from('profile-photos')
                              .createSignedUrl(path, 60 * 60 * 24); // 24h
                            if (signedErr) {
                              console.error('❌ Erro ao criar URL assinada:', signedErr);
                              throw signedErr;
                            }

                            console.log('🔗 URL assinada criada:', signedData.signedUrl);

                            // Salvar na tabela identity_selfies (mantemos o caminho do arquivo)
                            const { error: dbError } = await supabase
                              .from('identity_selfies')
                              .upsert({
                                user_id: user.id,
                                selfie_url: path,
                                upload_method: uploadMethod,
                                verification_status: 'PENDING'
                              }, { onConflict: 'user_id' });

                            if (dbError) {
                              console.error('❌ Erro ao salvar no DB:', dbError);
                              throw dbError;
                            }


                            console.log('💾 Selfie salva no banco de dados');

                            // Atualizar o estado com a URL assinada
                            setDocumentUrls(prev => {
                              const updated = { ...prev, selfie: signedData?.signedUrl || '' };
                              console.log('🔄 Estado atualizado:', updated);
                              return updated;
                            });
                            
                            toast.success(`✅ Selfie ${uploadMethod === 'CAMERA' ? 'capturada' : 'enviada da galeria'} com sucesso!`, { id: 'selfie-upload' });
                            setShowSelfieModal(false);
                          } catch (err) {
                            console.error('❌ Erro ao enviar selfie:', err);
                            toast.error('Erro ao enviar selfie. Tente novamente.', { id: 'selfie-upload' });
                          }
                        }}
                        onCancel={() => setShowSelfieModal(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>

                <DocumentUpload
                  label="Foto do Documento (RG/CNH)"
                  fileType="document"
                  bucketName="profile-photos"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, document_photo: url }))}
                  required
                />

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
                  <h3 className="text-lg font-semibold">Documentos e Veículos</h3>
                </div>

                {/* Alert para transportadoras escolherem quando cadastrar veículos */}
                {showVehicleChoice && isTransportCompany && (
                  <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                    <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-amber-900 dark:text-amber-100">
                      Cadastro de Veículos
                    </AlertTitle>
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                      <p className="mb-3">
                        Como transportadora, você pode cadastrar seus veículos agora ou adicionar depois que seu cadastro for aprovado.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => {
                            setSkipVehicleRegistration(false);
                            setShowVehicleChoice(false);
                          }}
                          variant="default"
                          size="sm"
                        >
                          Adicionar Veículos Agora
                        </Button>
                        <Button 
                          onClick={() => {
                            setSkipVehicleRegistration(true);
                            setShowVehicleChoice(false);
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Adicionar Depois
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* CNH e placas apenas para motoristas comuns */}
                {!isTransportCompany && (
                  <>
                    <DocumentUpload
                      label="CNH (Carteira Nacional de Habilitação)"
                      fileType="cnh"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, cnh: url }))}
                      required
                    />

                    {/* Sistema de múltiplas fotos de placas */}
                    <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Fotos das Placas *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextNumber = platePhotos.filter(p => p.type === 'TRAILER').length + 1;
                        setPlatePhotos([
                          ...platePhotos,
                          { 
                            id: Date.now().toString(), 
                            type: 'TRAILER', 
                            url: '', 
                            label: `Placa da Carreta ${nextNumber}` 
                          }
                        ]);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Placa de Carreta
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {platePhotos.map((plate, index) => (
                      <div key={plate.id} className="flex items-start gap-2">
                        <div className="flex-1">
                          <DocumentUpload
                            label={plate.label}
                            fileType={`plate_${plate.type.toLowerCase()}_${index}`}
                            bucketName="driver-documents"
                            onUploadComplete={(url) => {
                              setPlatePhotos(platePhotos.map(p => 
                                p.id === plate.id ? { ...p, url } : p
                              ));
                            }}
                            required={plate.type === 'TRACTOR'}
                          />
                        </div>
                        {plate.type === 'TRAILER' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPlatePhotos(platePhotos.filter(p => p.id !== plate.id));
                            }}
                            className="mt-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                      <p className="text-xs text-muted-foreground">
                        Adicione fotos de todas as placas do conjunto (cavalo + carretas)
                      </p>
                    </div>
                  </>
                )}

                <DocumentUpload
                  label="Comprovante de Endereço"
                  fileType="address"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, address_proof: url }))}
                  required
                  accept="image/*,application/pdf"
                />

                {!isTransportCompany && (
                  <LocationPermission
                    onPermissionChange={setLocationEnabled}
                    required
                  />
                )}

                {/* Vehicle Registration - apenas se não pulou */}
                {!skipVehicleRegistration && !isTransportCompany && (
                  <div className="space-y-4 border-t pt-4">
                  <h4 className="text-md font-semibold">Cadastro de Veículos</h4>
                  
                  {vehicles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Veículos Cadastrados:</p>
                      {vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="p-3 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{vehicle.vehicle_type} - {vehicle.license_plate}</p>
                              <p className="text-sm text-muted-foreground">
                                {vehicle.max_capacity_tons}t • {vehicle.axle_count} eixos • Status: {vehicle.status}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteVehicle(vehicle.id)}
                            >
                              Remover
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label>CRLV {vehicle.crlv_url ? '✓' : ''}</Label>
                              <Input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadVehicleFile(vehicle.id, 'crlv_url', f, 'CRLV');
                                }}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Foto do veículo {vehicle.vehicle_photo_url ? '✓' : ''}</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadVehicleFile(vehicle.id, 'vehicle_photo_url', f, 'Foto do veículo');
                                }}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Seguro (opcional) {vehicle.insurance_document_url ? '✓' : ''}</Label>
                              <Input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadVehicleFile(vehicle.id, 'insurance_document_url', f, 'Seguro');
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}


                  <div className="border rounded-lg p-4 space-y-4">
                    <h5 className="text-sm font-medium">Adicionar Novo Veículo:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Veículo</Label>
                        <Select
                          value={newVehicle.vehicle_type}
                          onValueChange={(value) => setNewVehicle(prev => ({ ...prev, vehicle_type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TRUCK">Truck</SelectItem>
                            <SelectItem value="BITREM">Bitrem</SelectItem>
                            <SelectItem value="RODOTREM">Rodotrem</SelectItem>
                            <SelectItem value="CARRETA">Carreta</SelectItem>
                            <SelectItem value="CARRETA_BAU">Carreta Baú</SelectItem>
                            <SelectItem value="VUC">VUC</SelectItem>
                            <SelectItem value="TOCO">Toco</SelectItem>
                            <SelectItem value="F400">Ford F-400</SelectItem>
                            <SelectItem value="STRADA">Fiat Strada</SelectItem>
                            <SelectItem value="CARRO_PEQUENO">Carro Pequeno</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Placa do Veículo</Label>
                        <Input
                          placeholder="ABC-1234"
                          value={newVehicle.license_plate}
                          onChange={(e) => setNewVehicle(prev => ({ ...prev, license_plate: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Capacidade (toneladas)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={newVehicle.max_capacity_tons}
                          onChange={(e) => setNewVehicle(prev => ({ ...prev, max_capacity_tons: Number(e.target.value) }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Número de Eixos</Label>
                        <Input
                          type="number"
                          min="2"
                          max="9"
                          value={newVehicle.axle_count}
                          onChange={(e) => setNewVehicle(prev => ({ ...prev, axle_count: Number(e.target.value) }))}
                        />
                      </div>
                    </div>

                    <Button 
                      type="button" 
                      onClick={addVehicle}
                      disabled={!newVehicle.vehicle_type || !newVehicle.license_plate}
                      className="w-full"
                    >
                      Adicionar Veículo
                    </Button>
                  </div>
                </div>
                )}

                {/* Seção de Aceite de Termos e Responsabilidades */}
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="h-5 w-5 text-primary" />
                      Termos e Responsabilidades
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <AlertTitle className="text-amber-900 dark:text-amber-100">
                        Declaração Obrigatória
                      </AlertTitle>
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        Antes de finalizar seu cadastro, você deve ler e aceitar os termos abaixo. 
                        Esta é uma etapa obrigatória para garantir a segurança e conformidade da plataforma.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4 mt-4">
                      {/* Checkbox 1: Responsabilidade pelos Documentos */}
                      <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <Checkbox
                          id="documents-responsibility"
                          checked={acceptedDocumentsResponsibility}
                          onCheckedChange={(checked) => setAcceptedDocumentsResponsibility(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="documents-responsibility"
                            className="text-sm font-medium leading-relaxed cursor-pointer"
                          >
                            Declaro que todas as imagens e documentos enviados são verdadeiros, autênticos e de minha 
                            propriedade. Estou ciente de que o envio de documentos falsos ou de terceiros sem autorização 
                            constitui crime e pode resultar em responsabilização civil e criminal, além do banimento 
                            permanente da plataforma.
                          </label>
                        </div>
                      </div>

                      {/* Checkbox 2: Termos de Uso */}
                      <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <Checkbox
                          id="terms-of-use"
                          checked={acceptedTermsOfUse}
                          onCheckedChange={(checked) => setAcceptedTermsOfUse(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="terms-of-use"
                            className="text-sm font-medium leading-relaxed cursor-pointer"
                          >
                            Li e aceito integralmente os{' '}
                            <a 
                              href="/termos" 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Termos de Uso
                            </a>
                            {' '}da plataforma AgriRoute, incluindo todas as cláusulas sobre direitos, 
                            obrigações e responsabilidades.
                          </label>
                        </div>
                      </div>

                      {/* Checkbox 3: Política de Privacidade */}
                      <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <Checkbox
                          id="privacy-policy"
                          checked={acceptedPrivacyPolicy}
                          onCheckedChange={(checked) => setAcceptedPrivacyPolicy(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="privacy-policy"
                            className="text-sm font-medium leading-relaxed cursor-pointer"
                          >
                            Li e aceito a{' '}
                            <a 
                              href="/privacidade" 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Política de Privacidade
                            </a>
                            {' '}e autorizo o tratamento dos meus dados pessoais conforme descrito, 
                            em conformidade com a Lei Geral de Proteção de Dados (LGPD).
                          </label>
                        </div>
                      </div>

                      {/* Informação Adicional */}
                      <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-md">
                        <p className="flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>Importante:</strong> Ao aceitar estes termos, você está criando um vínculo 
                            legal com a AgriRoute. Recomendamos que leia atentamente todos os documentos antes 
                            de prosseguir. Em caso de dúvidas, entre em contato com nosso suporte em{' '}
                            <a href="mailto:agrirouteconnect@gmail.com" className="text-primary hover:underline">
                              agrirouteconnect@gmail.com
                            </a>
                          </span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={confirmDeleteVehicle}
        title="Remover Veículo"
        description="Tem certeza que deseja remover este veículo? Esta ação não pode ser desfeita."
        confirmText="Sim, remover"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};

export default CompleteProfile;