import React, { useState, useEffect } from 'react';
import { validatePasswordStrength } from '@/utils/passwordValidation';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { uploadSelfieWithInstrumentation } from '@/utils/selfieUpload';
import { Loader2, CheckCircle, XCircle, Users, AlertTriangle, User, FileText, Truck, Shield, Camera, Eye, EyeOff } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { BackButton } from '@/components/BackButton';
import { validateDocument, formatDocument, validateCNPJ, formatCNPJ } from '@/utils/cpfValidator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getErrorMessage } from '@/lib/error-handler';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DocumentUploadLocal } from '@/components/DocumentUploadLocal';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/dialog';
import { CameraSelfie } from '@/components/CameraSelfie';
import { useAffiliatedDriverManager } from '@/hooks/useAffiliatedDriverManager';

const AffiliatedDriverSignup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyCNPJFromURL = searchParams.get('companyCNPJ') || '';
  const inviteToken = searchParams.get('inviteToken');

  // P0: provisionamento determinístico (perfil + vínculo) para evitar “auth ok / profile missing”
  const { provisionAffiliatedDriver } = useAffiliatedDriverManager();

  // Control states
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validatingCompany, setValidatingCompany] = useState(false);
  const [companyValid, setCompanyValid] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyId, setCompanyId] = useState<string>('');
  const [cnpjLocalValid, setCnpjLocalValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieBlobPending, setSelfieBlobPending] = useState<Blob | null>(null);
  const [selfieMethodPending, setSelfieMethodPending] = useState<'CAMERA' | 'GALLERY'>('CAMERA');

  // Form data
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    document: '',
    password: '',
    confirmPassword: '',
    // Endereço
    address_zip: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    // Emergência
    emergency_contact_name: '',
    emergency_contact_phone: '',
    // Profissional
    cnh_number: '',
    cnh_category: '',
    cnh_expiry_date: '',
    rntrc: '',
    antt_number: '',
    cooperative: '',
  });

  // Document URLs (para preview)
  const [documentUrls, setDocumentUrls] = useState({
    selfie: '',
    document_photo: '',
    cnh_photo: '',
    address_proof: '',
  });

  // Document Blobs (para upload após autenticação)
  const [documentBlobs, setDocumentBlobs] = useState<{
    document_photo: Blob | null;
    cnh_photo: Blob | null;
    address_proof: Blob | null;
  }>({
    document_photo: null,
    cnh_photo: null,
    address_proof: null,
  });

  // Terms acceptance
  const [acceptedTerms, setAcceptedTerms] = useState({
    documentsResponsibility: false,
    termsOfUse: false,
    privacyPolicy: false,
  });

  const normalizedFromURL = (companyCNPJFromURL || '').replace(/\D/g, '');
  const [companyCNPJ, setCompanyCNPJ] = useState(normalizedFromURL ? formatDocument(normalizedFromURL) : '');
  const cnpjDigits = companyCNPJ.replace(/\D/g, '');

  // Validate company CNPJ
  useEffect(() => {
    const validateCompanyCNPJ = async () => {
      const isLocallyValid = cnpjDigits.length === 14 && validateCNPJ(cnpjDigits);
      setCnpjLocalValid(isLocallyValid);
      
      if (cnpjDigits.length !== 14) {
        setCompanyValid(null);
        setCompanyName('');
        setIsValidating(false);
        return;
      }

      if (!isLocallyValid) {
        setCompanyValid(false);
        toast.error('CNPJ inválido');
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      setValidatingCompany(true);
      try {
        const { data, error } = await supabase.rpc('find_company_by_cnpj', {
          p_cnpj: cnpjDigits
        });

        if (error || !data || data.length === 0) {
          setCompanyValid(false);
          setCompanyName('');
          setCompanyId('');
          setIsValidating(false);
          setValidatingCompany(false);
          return;
        }

        const company = Array.isArray(data) ? data[0] : data;
        
        if (['ACTIVE', 'PENDING', 'APPROVED'].includes(company.status)) {
          setCompanyValid(true);
          setCompanyName(company.company_name);
          setCompanyId(company.id);
          toast.success(`Transportadora Válida: ${company.company_name}`);
        } else {
          setCompanyValid(false);
          setCompanyName('');
          setCompanyId('');
        }
      } catch (error) {
        console.error('Erro ao validar CNPJ:', error);
        setCompanyValid(false);
        setCompanyName('');
        setCompanyId('');
      } finally {
        setIsValidating(false);
        setValidatingCompany(false);
      }
    };

    if (companyCNPJ.length >= 14) {
      validateCompanyCNPJ();
    } else {
      setCompanyValid(null);
      setCompanyName('');
      setCnpjLocalValid(false);
      setIsValidating(false);
    }
  }, [companyCNPJ, cnpjDigits]);

  const handleNextStep = async () => {
    switch (currentStep) {
      case 1:
        if (!companyValid) {
          toast.error('CNPJ da transportadora inválido');
          return;
        }
        break;
        
      case 2:
        if (!formData.fullName || !formData.email || !formData.phone || !formData.document || !formData.password) {
          toast.error('Preencha todos os campos obrigatórios');
          return;
        }
        if (!validateDocument(formData.document)) {
          toast.error('CPF/CNPJ inválido');
          return;
        }
        const pwValidation = validatePasswordStrength(formData.password);
        if (!pwValidation.valid) {
          toast.error(`Senha fraca: ${pwValidation.errors.join(', ')}`);
          return;
        }
        if (!formData.confirmPassword) {
          toast.error('Confirme sua senha');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast.error('As senhas não coincidem');
          return;
        }
        if (!formData.address_zip || !formData.address_street || !formData.address_city || !formData.address_state) {
          toast.error('Preencha o endereço completo');
          return;
        }
        break;
        
      case 3:
        // Verificar se temos os blobs OU as previews (para os documentos locais)
        const hasSelfie = !!selfieBlobPending || !!documentUrls.selfie;
        const hasDocumentPhoto = !!documentBlobs.document_photo || !!documentUrls.document_photo;
        const hasCnhPhoto = !!documentBlobs.cnh_photo || !!documentUrls.cnh_photo;
        const hasAddressProof = !!documentBlobs.address_proof || !!documentUrls.address_proof;
        
        if (!hasSelfie || !hasDocumentPhoto || !hasCnhPhoto || !hasAddressProof) {
          toast.error('Envie todos os documentos obrigatórios');
          return;
        }
        break;
        
      case 4:
        if (!formData.cnh_category || !formData.cnh_number || !formData.cnh_expiry_date) {
          toast.error('Preencha os dados da CNH');
          return;
        }
        
        const expiryDate = new Date(formData.cnh_expiry_date);
        if (expiryDate < new Date()) {
          toast.error('CNH vencida. Por favor, renove antes de continuar.');
          return;
        }
        
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 90) {
          toast.message('Atenção', {
            description: `Sua CNH vence em ${daysUntilExpiry} dias. Considere renová-la em breve.`
          });
        }
        break;
        
      case 5:
        if (!acceptedTerms.documentsResponsibility || 
            !acceptedTerms.termsOfUse || 
            !acceptedTerms.privacyPolicy) {
          toast.error('Você deve aceitar todos os termos para continuar');
          return;
        }
        await handleSubmit();
        return;
    }
    
    setCurrentStep(prev => prev + 1);
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const cleanDoc = formData.document.replace(/\D/g, '');

      // 1. Create user or sign in if exists
      let authData;
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`,
          data: {
            full_name: formData.fullName,
            role: 'MOTORISTA_AFILIADO',
            phone: formData.phone,
            document: cleanDoc,
            is_affiliated_driver: true,
            affiliated_company_cnpj: companyCNPJ.replace(/\D/g, '')
          }
        }
      });

      // If user already exists, try to sign in
      if (authError) {
        const isUserExists = authError.status === 422 || 
                            authError.message?.toLowerCase().includes('already') ||
                            authError.message?.toLowerCase().includes('registered');
        
        if (isUserExists) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password
          });

          if (signInError) {
            toast.error('Email já cadastrado. Entre com sua senha ou redefina-a para continuar.');
            setLoading(false);
            return;
          }

          authData = signInData;
        } else {
          throw authError;
        }
      } else {
        authData = signUpData;
      }

      if (!authData.user) throw new Error('Erro ao autenticar usuário');

      // 1.1 Garantir sessão ativa ANTES de qualquer operação que dependa de auth (RLS/Storage)
      // Observação: dependendo da configuração do Supabase (ex: confirmação de e-mail ligada),
      // o signUp pode retornar user mas sem session. Neste caso NÃO tentamos upload e NÃO redirecionamos.
      const ensureActiveSession = async () => {
        // Preferir session retornada pela chamada de auth
        if ((authData as any)?.session?.access_token) return (authData as any).session;

        // Tentar recuperar do storage local
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id === authData.user!.id) return sessionData.session;

        // Último fallback: efetuar sign-in para materializar uma sessão
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) return null;
        return signInData.session ?? null;
      };

      const activeSession = await ensureActiveSession();
      if (!activeSession) {
        toast.error('Não foi possível iniciar sua sessão agora. Faça login para concluir o envio dos documentos.');
        setLoading(false);
        return;
      }

       // 2. Garantir perfil + vínculo de forma determinística (sem depender de trigger/replicação)
       let profileData: { id: string; metadata: any } | null = null;
       try {
         const provisioned = await provisionAffiliatedDriver({
           companyId,
           fullName: formData.fullName,
           cpfCnpj: cleanDoc,
           phone: formData.phone,
           email: formData.email,
         });

         if (!provisioned?.profileId) {
           throw new Error('Provisionamento não retornou profileId');
         }

         profileData = { id: provisioned.profileId, metadata: {} };
       } catch (provisionErr) {
         console.error('[AffiliatedDriverSignup] Falha ao provisionar perfil/vínculo:', provisionErr);
         toast.error('Erro ao criar seu perfil. Tente novamente ou faça login.');
         navigate('/auth');
         return;
       }

      // 4. Upload selfie após autenticação (com instrumentação completa)
      let selfieUrl = '';
      if (selfieBlobPending) {
        try {
          const result = await uploadSelfieWithInstrumentation({
            blob: selfieBlobPending,
            uploadMethod: selfieMethodPending || 'CAMERA',
          });
          
          if (result.success && result.signedUrl) {
            selfieUrl = result.signedUrl;
            if (import.meta.env.DEV) console.log('✅ Selfie uploaded successfully');
          } else if (result.error) {
            console.error('⚠️ Erro ao fazer upload da selfie:', result.error);
            toast.message('Selfie não foi enviada', {
              description: 'Você poderá enviá-la depois no perfil.'
            });
          }
        } catch (error: any) {
          console.error('⚠️ Erro ao fazer upload da selfie:', error);
          toast.message('Selfie não foi enviada', {
            description: 'Continue o cadastro. Você poderá enviá-la depois no perfil.'
          });
        }
      }

      // 4.1 Upload dos demais documentos após autenticação
      const uploadDocument = async (blob: Blob | null, fileType: string): Promise<string> => {
        if (!blob || blob.size === 0) return '';
        
        try {
          const ext = 'jpg'; // Assumimos jpg para imagens
          const fileName = `${authData.user!.id}/${fileType}_${Date.now()}.${ext}`;
          
          const { error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
          
          if (uploadError) {
            console.error(`⚠️ Erro ao fazer upload de ${fileType}:`, uploadError);
            return '';
          }
          
          // Generate signed URL (bucket is private)
          const { data: signedData, error: signError } = await supabase.storage
            .from('profile-photos')
            .createSignedUrl(fileName, 86400); // 24h

          if (signError || !signedData?.signedUrl) {
            console.error(`⚠️ Erro ao gerar signed URL para ${fileType}:`, signError);
            return '';
          }
          
          if (import.meta.env.DEV) console.log(`✅ ${fileType} uploaded`);
          return signedData.signedUrl;
        } catch (err) {
          console.error(`⚠️ Erro ao fazer upload de ${fileType}:`, err);
          return '';
        }
      };

      const [documentPhotoUrl, cnhPhotoUrl, addressProofUrl] = await Promise.all([
        uploadDocument(documentBlobs.document_photo, 'document_photo'),
        uploadDocument(documentBlobs.cnh_photo, 'cnh_photo'),
        uploadDocument(documentBlobs.address_proof, 'address_proof'),
      ]);

      // 5. Update profile with all data (store CNH in metadata)
      const updatedMetadata = {
        ...(profileData.metadata || {}),
        cnh_number: formData.cnh_number
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          contact_phone: formData.phone,
          cpf_cnpj: cleanDoc,
          // Address
          address_street: formData.address_street,
          address_number: formData.address_number,
          address_complement: formData.address_complement,
          address_neighborhood: formData.address_neighborhood,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip: formData.address_zip,
          // Emergency
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          // Documents (URLs reais após upload)
          selfie_url: selfieUrl || null,
          document_photo_url: documentPhotoUrl || null,
          cnh_photo_url: cnhPhotoUrl || null,
          address_proof_url: addressProofUrl || null,
          // Professional (CNH number now in metadata)
          cnh_category: formData.cnh_category,
          cnh_expiry_date: formData.cnh_expiry_date,
          rntrc: formData.rntrc || null,
          antt_number: formData.antt_number || null,
          cooperative: formData.cooperative || null,
          metadata: updatedMetadata
        })
        .eq('id', profileData.id);

      if (updateError) throw updateError;

      // 6. Create or update company link (avoid duplicates)
      const { data: existingLink } = await supabase
        .from('company_drivers')
        .select('id')
        .eq('company_id', companyId)
        .eq('driver_profile_id', profileData.id)
        .maybeSingle();

      if (existingLink) {
        // Update existing link
        const { error: updateLinkError } = await supabase
          .from('company_drivers')
          .update({
            status: 'PENDING',
            notes: 'Cadastro atualizado - aguardando aprovação'
          })
          .eq('id', existingLink.id);

        if (updateLinkError) throw updateLinkError;
      } else {
        // Create new link
        const { error: linkError } = await supabase
          .from('company_drivers')
          .insert({
            company_id: companyId,
            driver_profile_id: profileData.id,
            status: 'PENDING',
            can_accept_freights: false,
            can_manage_vehicles: false,
            affiliation_type: 'AFFILIATED',
            notes: 'Cadastro completo - aguardando aprovação'
          });

        if (linkError) throw linkError;
      }

      // 7. Notify company
      const { data: companyData } = await supabase
        .from('transport_companies')
        .select('profile_id, company_name')
        .eq('id', companyId)
        .single();

      if (companyData) {
        await supabase.from('notifications').insert({
          user_id: companyData.profile_id,
          title: 'Novo Motorista com Cadastro Completo',
          message: `${formData.fullName} solicitou vínculo. Todos os documentos foram enviados.`,
          type: 'driver_approval_pending',
          data: {
            driver_profile_id: profileData.id,
            driver_name: formData.fullName,
            has_complete_profile: true,
            documents_count: 4,
            requires_action: true
          }
        });
      }

      toast.success(`Cadastro enviado! Aguarde aprovação de ${companyData?.company_name || 'sua transportadora'}.`);
      
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      toast.error(error.message || 'Erro ao completar cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleSelfieCapture = async (imageBlob: Blob, uploadMethod: 'CAMERA' | 'GALLERY') => {
    try {
      // Armazenar Blob e método em memória - upload será feito após autenticação
      setSelfieBlobPending(imageBlob);
      setSelfieMethodPending(uploadMethod);
      
      // Criar preview local
      const previewUrl = URL.createObjectURL(imageBlob);
      setDocumentUrls(prev => ({ ...prev, selfie: previewUrl }));
      
      setShowSelfieModal(false);
      toast.success('Selfie capturada! Será enviada após completar o cadastro.');
    } catch (error: any) {
      console.error('Erro ao capturar selfie:', error);
      toast.error('Erro ao capturar selfie. Tente novamente.');
    }
  };

  const progress = (currentStep / 5) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <BackButton to="/auth" />
          <div className="flex justify-center mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Cadastro de Motorista Afiliado</CardTitle>
          <CardDescription>
            Preencha todas as informações e documentos necessários
          </CardDescription>
          <Progress value={progress} className="mt-4" />
          <p className="text-sm text-muted-foreground mt-2">
            Etapa {currentStep} de 5
          </p>
        </CardHeader>

        <CardContent>
          {/* STEP 1: Company Validation */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyCNPJ">CNPJ da Transportadora *</Label>
                <Input
                  id="companyCNPJ"
                  value={companyCNPJ}
                  onChange={(e) => setCompanyCNPJ(formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  required
                  disabled={!!companyCNPJFromURL || !!inviteToken}
                  maxLength={18}
                />
                
                {companyCNPJ.length > 0 && (
                  <div className="text-sm">
                    {cnpjDigits.length < 14 && (
                      <p className="text-muted-foreground">
                        Faltam {14 - cnpjDigits.length} dígitos ({cnpjDigits.length}/14)
                      </p>
                    )}
                    {isValidating && cnpjLocalValid && (
                      <p className="text-blue-600 animate-pulse flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validando CNPJ...
                      </p>
                    )}
                  </div>
                )}
                
                {companyValid === true && (
                  <Alert className="border-success bg-success/10">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <AlertTitle className="text-success">Transportadora Válida</AlertTitle>
                    <AlertDescription className="text-success">
                      {companyName}
                    </AlertDescription>
                  </Alert>
                )}
                
                {companyValid === false && cnpjLocalValid && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>CNPJ não encontrado</AlertTitle>
                    <AlertDescription>
                      Esta transportadora não está cadastrada no AgriRoute.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              <Alert className="border-primary/30 bg-primary/5">
                <Users className="h-4 w-4 text-primary" />
                <AlertTitle>Sobre o Cadastro de Afiliado</AlertTitle>
                <AlertDescription className="text-sm space-y-2 mt-2">
                  <p>Como motorista afiliado você poderá:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Ver fretes disponíveis</li>
                    <li>Preencher suas cidades de atuação</li>
                    <li>Ver agenda montada pela transportadora</li>
                    <li>Realizar check-ins de fretes</li>
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    ⚠️ Valores e pagamentos são gerenciados pela transportadora
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* STEP 2: Basic Data */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Alert>
                <User className="h-4 w-4" />
                <AlertTitle>Dados Pessoais</AlertTitle>
                <AlertDescription>
                  Preencha suas informações básicas e endereço
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document">CPF/CNPJ *</Label>
                  <Input
                    id="document"
                    value={formData.document}
                    onChange={(e) => setFormData(prev => ({ ...prev, document: formatDocument(e.target.value) }))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <PasswordInput
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Digite a senha novamente"
                    required
                    minLength={6}
                  />
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não conferem</p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />
              <h3 className="font-semibold mb-3">Endereço</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_zip">CEP *</Label>
                  <Input
                    id="address_zip"
                    value={formData.address_zip}
                    onChange={(e) => setFormData(prev => ({ ...prev, address_zip: e.target.value }))}
                    placeholder="00000-000"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address_street">Rua/Logradouro *</Label>
                  <Input
                    id="address_street"
                    value={formData.address_street}
                    onChange={(e) => setFormData(prev => ({ ...prev, address_street: e.target.value }))}
                    placeholder="Nome da rua"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_number">Número *</Label>
                  <Input
                    id="address_number"
                    value={formData.address_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, address_number: e.target.value }))}
                    placeholder="123"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_complement">Complemento</Label>
                  <Input
                    id="address_complement"
                    value={formData.address_complement}
                    onChange={(e) => setFormData(prev => ({ ...prev, address_complement: e.target.value }))}
                    placeholder="Apto, bloco..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_neighborhood">Bairro *</Label>
                  <Input
                    id="address_neighborhood"
                    value={formData.address_neighborhood}
                    onChange={(e) => setFormData(prev => ({ ...prev, address_neighborhood: e.target.value }))}
                    placeholder="Nome do bairro"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_city">Cidade *</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) => setFormData(prev => ({ ...prev, address_city: e.target.value }))}
                    placeholder="Nome da cidade"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_state">Estado *</Label>
                  <Input
                    id="address_state"
                    value={formData.address_state}
                    onChange={(e) => setFormData(prev => ({ ...prev, address_state: e.target.value }))}
                    placeholder="UF"
                    maxLength={2}
                    required
                  />
                </div>
              </div>

              <Separator className="my-4" />
              <h3 className="font-semibold mb-3">Contato de Emergência</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Nome do Contato</Label>
                  <Input
                    id="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Telefone de Emergência</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Documents */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Alert>
                <Camera className="h-4 w-4" />
                <AlertTitle>Documentos Obrigatórios</AlertTitle>
                <AlertDescription>
                  Envie fotos nítidas e legíveis de todos os documentos
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label>Selfie *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setShowSelfieModal(true)}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {documentUrls.selfie ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Selfie enviada
                      </>
                    ) : (
                      'Tirar Selfie'
                    )}
                  </Button>
                </div>

                <DocumentUploadLocal
                  label="Foto do RG ou CNH (frente)"
                  fileType="document_photo"
                  onFileSelect={(blob, previewUrl) => {
                    if (blob.size > 0) {
                      setDocumentBlobs(prev => ({ ...prev, document_photo: blob }));
                      setDocumentUrls(prev => ({ ...prev, document_photo: previewUrl }));
                    } else {
                      setDocumentBlobs(prev => ({ ...prev, document_photo: null }));
                      setDocumentUrls(prev => ({ ...prev, document_photo: '' }));
                    }
                  }}
                  currentPreview={documentUrls.document_photo}
                  required
                />

                <DocumentUploadLocal
                  label="Foto da CNH (verso)"
                  fileType="cnh_photo"
                  onFileSelect={(blob, previewUrl) => {
                    if (blob.size > 0) {
                      setDocumentBlobs(prev => ({ ...prev, cnh_photo: blob }));
                      setDocumentUrls(prev => ({ ...prev, cnh_photo: previewUrl }));
                    } else {
                      setDocumentBlobs(prev => ({ ...prev, cnh_photo: null }));
                      setDocumentUrls(prev => ({ ...prev, cnh_photo: '' }));
                    }
                  }}
                  currentPreview={documentUrls.cnh_photo}
                  required
                />

                <DocumentUploadLocal
                  label="Comprovante de Residência"
                  fileType="address_proof"
                  accept="image/*,application/pdf"
                  onFileSelect={(blob, previewUrl) => {
                    if (blob.size > 0) {
                      setDocumentBlobs(prev => ({ ...prev, address_proof: blob }));
                      setDocumentUrls(prev => ({ ...prev, address_proof: previewUrl }));
                    } else {
                      setDocumentBlobs(prev => ({ ...prev, address_proof: null }));
                      setDocumentUrls(prev => ({ ...prev, address_proof: '' }));
                    }
                  }}
                  currentPreview={documentUrls.address_proof}
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 4: Professional Data */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <Alert>
                <Truck className="h-4 w-4" />
                <AlertTitle>Dados Profissionais</AlertTitle>
                <AlertDescription>
                  Informações da sua CNH e registros profissionais
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnh_category">Categoria da CNH *</Label>
                  <Select
                    value={formData.cnh_category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, cnh_category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                      <SelectItem value="AB">AB</SelectItem>
                      <SelectItem value="AC">AC</SelectItem>
                      <SelectItem value="AD">AD</SelectItem>
                      <SelectItem value="AE">AE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnh_number">Número da CNH *</Label>
                  <Input
                    id="cnh_number"
                    value={formData.cnh_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, cnh_number: e.target.value }))}
                    placeholder="00000000000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnh_expiry_date">Data de Validade da CNH *</Label>
                  <Input
                    id="cnh_expiry_date"
                    type="date"
                    value={formData.cnh_expiry_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, cnh_expiry_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rntrc">RNTRC</Label>
                  <Input
                    id="rntrc"
                    value={formData.rntrc}
                    onChange={(e) => setFormData(prev => ({ ...prev, rntrc: e.target.value }))}
                    placeholder="00000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="antt_number">Número ANTT</Label>
                  <Input
                    id="antt_number"
                    value={formData.antt_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, antt_number: e.target.value }))}
                    placeholder="000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cooperative">Cooperativa</Label>
                  <Input
                    id="cooperative"
                    value={formData.cooperative}
                    onChange={(e) => setFormData(prev => ({ ...prev, cooperative: e.target.value }))}
                    placeholder="Nome da cooperativa"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Review and Terms */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">Resumo do Cadastro</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <strong>Nome:</strong> {formData.fullName}
                  </div>
                  <div>
                    <strong>CPF/CNPJ:</strong> {formData.document}
                  </div>
                  <div>
                    <strong>Telefone:</strong> {formData.phone}
                  </div>
                  <div>
                    <strong>CNH:</strong> {formData.cnh_category} - Válida até {formData.cnh_expiry_date}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <strong>Documentos Enviados:</strong>
                    <div className="flex flex-wrap gap-2">
                      {documentUrls.selfie && (
                        <Badge variant="outline" className="bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                          Selfie
                        </Badge>
                      )}
                      {documentUrls.document_photo && (
                        <Badge variant="outline" className="bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                          RG/CNH
                        </Badge>
                      )}
                      {documentUrls.cnh_photo && (
                        <Badge variant="outline" className="bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                          CNH
                        </Badge>
                      )}
                      {documentUrls.address_proof && (
                        <Badge variant="outline" className="bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                          Comprovante
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="docs"
                    checked={acceptedTerms.documentsResponsibility}
                    onCheckedChange={(checked) =>
                      setAcceptedTerms(prev => ({ ...prev, documentsResponsibility: !!checked }))
                    }
                  />
                  <Label htmlFor="docs" className="text-sm leading-relaxed cursor-pointer">
                    Declaro que as informações e documentos enviados são verdadeiros e de minha responsabilidade
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms.termsOfUse}
                    onCheckedChange={(checked) =>
                      setAcceptedTerms(prev => ({ ...prev, termsOfUse: !!checked }))
                    }
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                    Li e aceito os Termos de Uso
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="privacy"
                    checked={acceptedTerms.privacyPolicy}
                    onCheckedChange={(checked) =>
                      setAcceptedTerms(prev => ({ ...prev, privacyPolicy: !!checked }))
                    }
                  />
                  <Label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
                    Li e aceito a Política de Privacidade
                  </Label>
                </div>
              </div>

              <Alert className="border-success bg-success/10">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertDescription>
                  Seu cadastro está completo! Após enviar, aguarde a aprovação da transportadora.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-2 mt-6">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
                disabled={loading}
              >
                Voltar
              </Button>
            )}
            
            <Button
              type="button"
              className="flex-1"
              onClick={handleNextStep}
              disabled={loading || (currentStep === 1 && companyValid !== true)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : currentStep === 5 ? (
                'Enviar Solicitação'
              ) : (
                'Continuar'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selfie Modal */}
      <Dialog open={showSelfieModal} onOpenChange={setShowSelfieModal}>
        <DialogContent className="max-w-md p-0">
          <VisuallyHidden>
            <DialogTitle>Capturar Selfie</DialogTitle>
            <DialogDescription>
              Use sua câmera para tirar uma selfie para o cadastro
            </DialogDescription>
          </VisuallyHidden>
          <CameraSelfie
            onCapture={handleSelfieCapture}
            onCancel={() => setShowSelfieModal(false)}
            autoStart={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AffiliatedDriverSignup;
