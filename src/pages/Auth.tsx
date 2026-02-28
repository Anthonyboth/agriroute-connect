import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { routeAfterAuth, waitForProfile } from '@/lib/route-after-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { toast } from 'sonner';
import { Loader2, Mail, Eye, EyeOff, Truck, Building2, ArrowLeft, AlertTriangle, Users, Info, Briefcase, Building } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { sanitizeForStore, normalizeDocument, isValidDocument } from '@/utils/document';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { userRegistrationSchema, validateInput } from '@/lib/validations';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getErrorMessage } from '@/lib/error-handler';
import { ProfileSelectorModal } from '@/components/ProfileSelectorModal';
import { getDashboardByRole, isValidRole } from '@/lib/auth-utils';
import { RoleSelectionCards } from '@/components/auth/RoleSelectionCards';
import { VALID_SIGNUP_ROLES, isValidSignupRole, type SignupRole } from '@/lib/user-roles';
import { PasswordInput } from '@/components/ui/password-input';
import { useResilientLogin } from '@/hooks/useResilientLogin';
import AutomaticApprovalService from '@/components/AutomaticApproval';
import { clearCachedProfile } from '@/lib/profile-cache';
import { LegalDocumentDialog } from '@/components/LegalDocumentDialog';

// Parse and validate role from URL
function parseRoleFromUrl(roleParam: string | null): SignupRole | null {
  if (!roleParam) return null;
  const normalizedRole = roleParam.toUpperCase();
  if (VALID_SIGNUP_ROLES.includes(normalizedRole as SignupRole)) {
    return normalizedRole as SignupRole;
  }
  return null;
}

// Parse mode from URL (supports both 'mode' and 'tab' for backward compatibility)
function parseModeFromUrl(searchParams: URLSearchParams): 'login' | 'signup' {
  const mode = searchParams.get('mode');
  const tab = searchParams.get('tab');
  
  // 'mode' takes priority, then 'tab'
  if (mode === 'signup' || tab === 'signup' || tab === 'register') {
    return 'signup';
  }
  return 'login';
}

const Auth = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>('PRODUTOR');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const navigate = useNavigate();

  // ✅ CRITICAL: Read mode and role from URL query params
  const urlMode = parseModeFromUrl(searchParams);
  const urlRole = parseRoleFromUrl(searchParams.get('role'));
  
  // ✅ Controlled active tab synced to URL
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(urlMode);

  // Estados para fluxo multi-step de cadastro
  const [signupStep, setSignupStep] = useState<'role-selection' | 'driver-type' | 'form'>('role-selection');
  const [driverType, setDriverType] = useState<'MOTORISTA' | 'TRANSPORTADORA' | null>(null);
  
  // Estados extras para transportadora
  const [companyName, setCompanyName] = useState('');
  const [companyFantasyName, setCompanyFantasyName] = useState('');
  const [companyCNPJ, setCompanyCNPJ] = useState('');
  const [companyANTT, setCompanyANTT] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDialogType, setLegalDialogType] = useState<'terms' | 'privacy' | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);

  // ✅ CRITICAL: Sync URL mode to active tab state on mount and URL changes
  useEffect(() => {
    const mode = parseModeFromUrl(searchParams);
    setActiveTab(mode);
    
    // Handle role from URL - store in sessionStorage for persistence
    const roleFromUrl = parseRoleFromUrl(searchParams.get('role'));
    
    // Also check sessionStorage for pending role (from AuthModal)
    const pendingRole = sessionStorage.getItem('pending_signup_role');
    const effectiveRole = roleFromUrl || (
      pendingRole && VALID_SIGNUP_ROLES.includes(pendingRole as SignupRole) 
        ? pendingRole as SignupRole 
        : null
    );
    
    if (effectiveRole) {
      // Store in sessionStorage if from URL (for persistence)
      if (roleFromUrl) {
        sessionStorage.setItem('pending_signup_role', roleFromUrl);
      }
      setRole(effectiveRole);
      
      // If role is provided and we're in signup mode, show role-selection with card pre-selected
      if (mode === 'signup') {
        if (effectiveRole === 'MOTORISTA_AFILIADO') {
          // Redirect to affiliate signup page
          window.location.href = '/cadastro-motorista-afiliado';
          return;
        }
        // Stay on role-selection step with the card pre-highlighted
        setSignupStep('role-selection');
      }
    }
  }, [searchParams]);

  // ✅ CRITICAL: Update URL when tab changes (single source of truth)
  const handleTabChange = (newTab: string) => {
    const tab = newTab as 'login' | 'signup';
    setActiveTab(tab);
    
    // Update URL to reflect the new mode
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', tab);
    
    // Preserve role if switching to signup
    if (tab === 'signup') {
      const pendingRole = sessionStorage.getItem('pending_signup_role');
      if (pendingRole) {
        newParams.set('role', pendingRole);
      }
    } else {
      newParams.delete('role');
    }
    
    // Remove legacy 'tab' param
    newParams.delete('tab');
    
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    // Remove automatic redirect from auth page - let RedirectIfAuthed handle it
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Just log, don't redirect from here
          if (import.meta.env.DEV) console.log('User already authenticated, RedirectIfAuthed will handle redirect');
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Verificar se as senhas coincidem
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem. Digite a mesma senha nos dois campos.');
      setLoading(false);
      return;
    }

    // Se for transportadora e não aceitou os termos
    if (driverType === 'TRANSPORTADORA' && !acceptedTerms) {
      toast.error('Você deve aceitar os Termos de Uso para Transportadoras');
      setLoading(false);
      return;
    }

    // Validação básica para transportadora
    if (driverType === 'TRANSPORTADORA') {
      if (!companyName || !companyCNPJ || !companyANTT) {
        toast.error('Preencha todos os campos obrigatórios da transportadora');
        setLoading(false);
        return;
      }
    }

    // Validate input usando Zod schema (já valida e normaliza documento)
    const validation = validateInput(userRegistrationSchema, {
      full_name: fullName,
      email,
      password,
      phone,
      document: driverType === 'TRANSPORTADORA' ? companyCNPJ : document,
      role: driverType === 'TRANSPORTADORA' ? 'TRANSPORTADORA' : role
    });
    
    if (validation.success === false) {
      toast.error(`Erro de validação: ${validation.errors.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      // Document already normalized by Zod validation
      const cleanDoc = validation.data.document;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`,
          data: {
            full_name: fullName,
            role: driverType === 'TRANSPORTADORA' ? 'TRANSPORTADORA' : role,
            phone,
            document: cleanDoc,
            is_transport_company: driverType === 'TRANSPORTADORA'
          }
        }
      });

      if (error) {
        // Verificar se é erro de usuário já cadastrado
        const errorMsg = error.message || '';
        const errorStatus = (error as any)?.status;
        const errorCode = String((error as any)?.code || '').toLowerCase();
        const isUserExists =
          errorStatus === 422 ||
          errorCode.includes('user_already_exists') ||
          errorMsg.toLowerCase().includes('already') ||
          errorMsg.toLowerCase().includes('registered');
        
        if (isUserExists) {
          try {
            // Tentar fazer login com as credenciais fornecidas
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
              email,
              password
            });

            if (loginError) {
              toast.error('Email já cadastrado. Use sua senha correta ou clique em "Esqueci minha senha".');
              setLoading(false);
              return;
            }

            if (loginData.user) {
              // Login bem-sucedido - verificar se já tem perfil com a role solicitada
              const { data: existingProfiles } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', loginData.user.id);

              const targetRole = driverType === 'TRANSPORTADORA' ? 'TRANSPORTADORA' : role;
              const hasRoleProfile = existingProfiles?.some(p => p.role === targetRole);

              if (hasRoleProfile) {
                // Já tem perfil com essa role - apenas ativar
                const profileToActivate = existingProfiles?.find(p => p.role === targetRole);
                if (profileToActivate) {
                  localStorage.setItem('current_profile_id', profileToActivate.id);
                  toast.success('Perfil já existe! Redirecionando...');
                  // ✅ GATE UNIVERSAL: routeAfterAuth decide destino
                  const dest = await routeAfterAuth(loginData.user.id, profileToActivate.id);
                  navigate(dest);
                }
              } else {
                // ✅ P0 HOTFIX: Criar novo perfil via RPC (idempotente)
                try {
                  const payload = {
                    p_user_id: loginData.user.id,
                    p_role: targetRole,
                    p_full_name: fullName,
                    p_phone: phone,
                    p_document: cleanDoc
                  };
                  if (import.meta.env.DEV) console.log('CREATE_ADDITIONAL_PROFILE_CALLED', { 
                    userId: loginData.user.id, 
                    payloadKeys: Object.keys(payload) 
                  });
                  
                  const { data: rpcResult, error: rpcError } = await supabase.rpc('create_additional_profile', payload);

                  if (rpcError) {
                    console.error('CREATE_ADDITIONAL_PROFILE_ERROR', rpcError);
                    toast.error(`Erro ao criar perfil: ${rpcError.message || 'Erro desconhecido'}`);
                    setLoading(false);
                    return;
                  }
                  
                  // ✅ RPC agora retorna JSONB com success, profile_id, already_exists, message
                  const result = rpcResult as { success: boolean; profile_id: string | null; already_exists: boolean; message: string };
                  if (import.meta.env.DEV) console.log('[Auth] RPC result:', result);
                  
                  if (!result.success) {
                    toast.error(result.message || 'Erro ao criar perfil');
                    setLoading(false);
                    return;
                  }
                  
                  const newProfileId = result.profile_id;

                  // Ativar o novo perfil
                  localStorage.setItem('current_profile_id', newProfileId);
                  
                  // Limpar role pendente
                  sessionStorage.removeItem('pending_signup_role');
                  
                  toast.success('Novo perfil criado com sucesso!');
                  
                  // Se for transportadora, criar registro
                  if (driverType === 'TRANSPORTADORA') {
                    const { error: companyError } = await supabase
                      .from('transport_companies')
                      .insert({
                        profile_id: newProfileId,
                        company_name: companyName,
                        company_cnpj: sanitizeForStore(companyCNPJ),
                        antt_registration: companyANTT,
                        status: 'PENDING'
                      });

                    if (companyError) {
                      console.error('[Auth] Erro ao criar transportadora:', companyError);
                      toast.warning('Perfil criado, mas houve erro ao criar transportadora.');
                    }
                  }
                  
                  // ✅ GATE UNIVERSAL: routeAfterAuth decide destino
                  const dest2 = await routeAfterAuth(loginData.user.id, newProfileId);
                  navigate(dest2);
                } catch (createError) {
                  console.error('[Auth] Erro inesperado ao criar perfil:', createError);
                  toast.error('Erro ao criar novo perfil. Tente novamente.');
                }
              }
            }
            
            setLoading(false);
            return;
          } catch (err) {
            console.error('Erro ao processar usuário existente:', err);
            toast.error('Erro ao processar cadastro. Tente novamente.');
            setLoading(false);
            return;
          }
        }
        
        // Outros erros
        toast.error(getErrorMessage(error));
        setLoading(false);
        return;
      }

      // Se for transportadora, criar registro na tabela transport_companies
      if (driverType === 'TRANSPORTADORA' && data?.user) {
        // ✅ CORRIGIDO: polling/retry em vez de setTimeout(2000)
        const profileData = await waitForProfile(data.user.id);

        if (profileData) {
          const { error: companyError } = await supabase
            .from('transport_companies')
            .insert({
              profile_id: profileData.id,
              company_name: companyName,
              company_cnpj: sanitizeForStore(companyCNPJ),
              antt_registration: companyANTT,
              status: 'PENDING'
            });

          if (companyError) {
            console.error('Erro ao criar transportadora:', companyError);
            toast.warning('Cadastro criado, mas houve erro ao criar transportadora. Entre em contato com o suporte.');
          } else {
            // Atualizar profiles.document com o CNPJ para permitir login posterior
            const { error: updateProfileError } = await supabase
              .from('profiles')
              .update({
                document: sanitizeForStore(companyCNPJ),
                phone: phone || null
              })
              .eq('id', profileData.id);

            if (updateProfileError) {
              console.warn('Aviso: Não foi possível atualizar documento no perfil:', updateProfileError);
            }
          }
        }
      }

      // Verificar se a confirmação por email está desativada
      if (data.session) {
        // ✅ GATE UNIVERSAL: routeAfterAuth decide se vai para /complete-profile ou dashboard
        toast.info('Conta criada! Redirecionando...');
        const destination = await routeAfterAuth(data.user!.id);
        navigate(destination);
      } else {
        // Email confirmation está ON - precisa confirmar email
        toast.success('Conta criada. Você já pode fazer login.');
      }
    } catch (error: any) {
      console.error('Error during signup:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // ✅ Hook robusto de login com notificações Telegram
  const { login: resilientLogin, selectProfile: resilientSelectProfile, loading: resilientLoading } = useResilientLogin();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowResendConfirmation(false);
    setLoading(true);

    const result = await resilientLogin(loginField, password);
    
    if (!result.success) {
      // Mostrar erro amigável
      if (result.error?.toLowerCase().includes('email não confirmado') || 
          result.error?.toLowerCase().includes('email not confirmed')) {
        setShowResendConfirmation(true);
      }
      toast.error(result.error || 'Erro no login');
      setLoading(false);
      return;
    }
    
    // Se requer seleção de perfil, mostrar modal
    if (result.requiresProfileSelection && result.profiles) {
      setAvailableProfiles(result.profiles);
      setShowProfileSelector(true);
      setLoading(false);
      return;
    }
    
    // Login bem-sucedido - redirecionamento já foi feito pelo hook
    // ✅ Fallback: se por algum motivo ainda estivermos no /auth, força redirecionamento
    if (result.redirectTo) {
      setTimeout(() => {
        if (window.location.pathname === '/auth') {
          window.location.href = result.redirectTo as string;
        }
      }, 300);
    }
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    try {
      const targetEmail =
        (loginField && loginField.includes('@') && loginField) ||
        (email && email.includes('@') && email) ||
        '';

      if (!targetEmail) {
        toast.error('Informe seu email no campo para reenviar a confirmação.');
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`,
        },
      });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('For security purposes, you can only request this after')) {
          const seconds = msg.match(/(\d+) seconds?/)?.[1] || '60';
          toast.error(`Por segurança, você só pode solicitar novamente após ${seconds} segundos.`);
        } else {
          toast.error('Não foi possível reenviar o email.');
        }
        return;
      }

      toast.success('Link de confirmação reenviado. Verifique sua caixa de entrada e spam.');
    } catch (err) {
      toast.error('Erro ao reenviar o email de confirmação.');
    }
  };

  // Mostrar loading enquanto verifica sessão
  if (isCheckingSession) {
    return <AppSpinner fullscreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10 md:px-8 md:py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <BackButton to="/" />
            <div className="flex-1"></div>
          </div>
          <CardTitle>AgriRoute Connect</CardTitle>
          <CardDescription>
            {loading ? 'Processando...' : 'Conectando pessoas'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* ✅ CRITICAL: Controlled tabs synced to URL */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="mx-auto grid grid-cols-2 gap-1 w-full max-w-xs bg-muted rounded-lg p-1">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>
            
            {/* Social Login Section - Common for both tabs */}
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4" autoComplete="on">
                <div className="space-y-2">
                  <Label htmlFor="loginField">Email ou CPF/CNPJ</Label>
                  <Input
                    id="loginField"
                    name="username"
                    autoComplete="username"
                    value={loginField}
                    onChange={(e) => setLoginField(e.target.value)}
                    placeholder="Digite seu email ou CPF/CNPJ"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">Senha</Label>
                  <PasswordInput
                    id="loginPassword"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
              
              <div className="text-center mt-4 space-y-1">
                <Button
                  variant="link"
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Esqueci minha senha
                </Button>
                {showResendConfirmation && (
                  <div>
                    <Button
                      variant="link"
                      className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4"
                      onClick={handleResendConfirmation}
                    >
                      Reenviar e-mail de confirmação
                    </Button>
                  </div>
                )}
              </div>

            </TabsContent>
            
            <TabsContent value="signup">
              <div className="space-y-4">
                {/* Step 1: Seleção de Role */}
                {/* ✅ P0 FIX: Seleção de role via CARDS (removido dropdown/select) */}
                {signupStep === 'role-selection' && (
                  <RoleSelectionCards
                    selectedRole={role === 'MOTORISTA_AFILIADO' ? null : role}
                    onRoleSelect={(selectedRole) => {
                      setRole(selectedRole);
                      setDriverType(null);
                    }}
                    onContinue={() => {
                      // ✅ Step 1: Apenas MOTORISTA vai para step 2 (Autônomo vs Afiliado)
                      // Transportadora, Produtor e Prestador vão direto para o form
                      if (role === 'MOTORISTA') {
                        setSignupStep('driver-type');
                      } else if (role === 'TRANSPORTADORA') {
                        setDriverType('TRANSPORTADORA');
                        setSignupStep('form');
                      } else {
                        setSignupStep('form');
                      }
                    }}
                    title="Escolha o tipo de conta"
                    description="Selecione o perfil que melhor se encaixa com você"
                    continueButtonText="Continuar"
                  />
                )}

                {/* Step 2: Apenas para MOTORISTA — Autônomo ou Afiliado */}
                {signupStep === 'driver-type' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSignupStep('role-selection');
                          setDriverType(null);
                        }}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Voltar
                      </Button>
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2">Qual tipo de motorista?</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Motorista Autônomo */}
                      <Card 
                        className="cursor-pointer transition-all duration-300 hover:border-primary hover:shadow-lg hover:-translate-y-1 h-full flex flex-col"
                        onClick={() => {
                          setDriverType('MOTORISTA');
                          setSignupStep('form');
                        }}
                      >
                        <CardHeader className="flex-1 flex flex-col items-center text-center">
                          <Truck className="h-12 w-12 text-primary mb-3" />
                          <CardTitle className="text-xl">Autônomo</CardTitle>
                          <CardDescription className="text-sm mt-2">
                            Motorista individual com CPF ou CNPJ
                          </CardDescription>
                          <div className="mt-auto pt-4">
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Info className="h-3 w-3" />
                              CPF ou CNPJ
                            </Badge>
                          </div>
                        </CardHeader>
                      </Card>
                      
                      {/* Motorista Afiliado — redireciona para fluxo específico */}
                      <Card 
                        className="cursor-pointer transition-all duration-300 hover:border-primary hover:shadow-lg hover:-translate-y-1 h-full flex flex-col"
                        onClick={() => {
                          window.location.href = '/cadastro-motorista-afiliado';
                        }}
                      >
                        <CardHeader className="flex-1 flex flex-col items-center text-center">
                          <Users className="h-12 w-12 text-primary mb-3" />
                          <CardTitle className="text-xl">Afiliado</CardTitle>
                          <CardDescription className="text-sm mt-2">
                            Vinculado a uma transportadora
                          </CardDescription>
                          <div className="mt-auto pt-4">
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              Requer CNPJ da empresa
                            </Badge>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Step 3: Formulário de Cadastro */}
                {signupStep === 'form' && (
                  <form onSubmit={handleSignUp} className="space-y-4" autoComplete="on">
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (driverType) {
                            setSignupStep('driver-type');
                          } else {
                            setSignupStep('role-selection');
                          }
                        }}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Voltar
                      </Button>
                    </div>

                    {driverType === 'TRANSPORTADORA' && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Cadastro de Transportadora</AlertTitle>
                        <AlertDescription>
                          Este tipo de cadastro é para empresas com 2 ou mais carretas
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="fullName">{driverType === 'TRANSPORTADORA' ? 'Nome do Responsável' : 'Nome Completo'}</Label>
                      <Input
                        id="fullName"
                        name="name"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    {driverType === 'TRANSPORTADORA' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="companyName">Razão Social *</Label>
                          <Input
                            id="companyName"
                            name="organization"
                            autoComplete="organization"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="companyFantasyName">Nome Fantasia</Label>
                          <Input
                            id="companyFantasyName"
                            value={companyFantasyName}
                            onChange={(e) => setCompanyFantasyName(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="signupEmail">Email</Label>
                      <Input
                        id="signupEmail"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signupPassword">Senha</Label>
                      <PasswordInput
                        id="signupPassword"
                        name="new-password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                      <PasswordInput
                        id="confirmPassword"
                        name="confirm-password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Digite a senha novamente"
                      />
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-destructive">As senhas não conferem</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone WhatsApp</Label>
                      <Input
                        id="phone"
                        name="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        required
                      />
                    </div>

                    {driverType === 'TRANSPORTADORA' ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="companyCNPJ">CNPJ *</Label>
                          <Input
                            id="companyCNPJ"
                            value={companyCNPJ}
                            onChange={(e) => setCompanyCNPJ(e.target.value)}
                            placeholder="00.000.000/0001-00"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="companyANTT">ANTT *</Label>
                          <Input
                            id="companyANTT"
                            value={companyANTT}
                            onChange={(e) => setCompanyANTT(e.target.value)}
                            placeholder="Número de registro ANTT"
                            required
                          />
                        </div>

                        {/* 3 Checkboxes obrigatórios para Transportadora */}
                        <div className="space-y-3 border-t pt-4 mt-4">
                          <p className="text-sm font-medium text-foreground">Termos Obrigatórios *</p>
                          
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id="termsDocumentResponsibility"
                              checked={acceptedTerms}
                              onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                            />
                            <label
                              htmlFor="termsDocumentResponsibility"
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Declaro que sou responsável pelas informações e documentos fornecidos
                            </label>
                          </div>
                          
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id="termsOfUse"
                              required
                            />
                            <label
                              htmlFor="termsOfUse"
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Li e aceito os{' '}
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); setLegalDialogType('terms'); }}
                                className="text-primary hover:underline inline"
                              >
                                Termos de Uso
                              </button>
                            </label>
                          </div>
                          
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id="privacyPolicy"
                              required
                            />
                            <label
                              htmlFor="privacyPolicy"
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Li e aceito a{' '}
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); setLegalDialogType('privacy'); }}
                                className="text-primary hover:underline inline"
                              >
                                Política de Privacidade
                              </button>
                            </label>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="document">CPF/CNPJ *</Label>
                          <Input
                            id="document"
                            value={document}
                            onChange={(e) => setDocument(e.target.value)}
                            placeholder="000.000.000-00 ou 00.000.000/0001-00"
                            required
                          />
                        </div>
                        
                        {/* 3 Checkboxes obrigatórios para Motorista/Produtor */}
                        <div className="space-y-3 border-t pt-4 mt-4">
                          <p className="text-sm font-medium text-foreground">Termos Obrigatórios *</p>
                          
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id="termsDocResponsibility"
                              required
                            />
                            <label
                              htmlFor="termsDocResponsibility"
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Declaro que sou responsável pelas informações e documentos fornecidos
                            </label>
                          </div>
                          
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id="termsOfUseGeneral"
                              required
                            />
                            <label
                              htmlFor="termsOfUseGeneral"
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Li e aceito os{' '}
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); setLegalDialogType('terms'); }}
                                className="text-primary hover:underline inline"
                              >
                                Termos de Uso
                              </button>
                            </label>
                          </div>
                          
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id="privacyPolicyGeneral"
                              required
                            />
                            <label
                              htmlFor="privacyPolicyGeneral"
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Li e aceito a{' '}
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); setLegalDialogType('privacy'); }}
                                className="text-primary hover:underline inline"
                              >
                                Política de Privacidade
                              </button>
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                    
                    <Button type="submit" className="w-full h-12" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Cadastrar
                    </Button>
                  </form>
                )}
              </div>
            </TabsContent>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Você também pode{' '}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-xs underline-offset-4 hover:underline"
                      onClick={() => navigate('/')}
                    >
                  solicitar serviços sem cadastro
                </Button>
              </p>
            </div>
          </Tabs>
        </CardContent>
      </Card>
      
      <ForgotPasswordModal 
        open={showForgotPassword} 
        onOpenChange={setShowForgotPassword} 
      />

      {showProfileSelector && (
        <ProfileSelectorModal
          open={showProfileSelector}
          profiles={availableProfiles}
          onSelectProfile={(profileId, route) => {
            localStorage.setItem('current_profile_id', profileId);
            setShowProfileSelector(false);
            window.location.href = route;
          }}
        />
      )}

      <LegalDocumentDialog
        open={legalDialogType !== null}
        onOpenChange={(open) => { if (!open) setLegalDialogType(null); }}
        documentType={legalDialogType || 'terms'}
      />
    </div>
  );
};

export default Auth;