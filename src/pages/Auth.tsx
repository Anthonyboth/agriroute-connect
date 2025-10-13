import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Mail, Eye, EyeOff, Truck, Building2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { validateDocument } from '@/utils/cpfValidator';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { userRegistrationSchema, validateInput } from '@/lib/validations';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'PRODUTOR' | 'MOTORISTA' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA'>('PRODUTOR');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const navigate = useNavigate();

  // Estados para fluxo multi-step de cadastro
  const [signupStep, setSignupStep] = useState<'role-selection' | 'driver-type' | 'form'>('role-selection');
  const [driverType, setDriverType] = useState<'MOTORISTA' | 'TRANSPORTADORA' | null>(null);
  
  // Estados extras para transportadora
  const [companyName, setCompanyName] = useState('');
  const [companyFantasyName, setCompanyFantasyName] = useState('');
  const [companyCNPJ, setCompanyCNPJ] = useState('');
  const [companyANTT, setCompanyANTT] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    // Remove automatic redirect from auth page - let RedirectIfAuthed handle it
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Just log, don't redirect from here
        console.log('User already authenticated, RedirectIfAuthed will handle redirect');
      }
    };
    
    checkSession();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Se for transportadora e não aceitou os termos
    if (driverType === 'TRANSPORTADORA' && !acceptedTerms) {
      toast.error('Você deve aceitar os Termos de Uso para Transportadoras');
      setLoading(false);
      return;
    }

    // Validação básica
    if (driverType === 'TRANSPORTADORA') {
      if (!companyName || !companyCNPJ || !companyANTT || !companyAddress) {
        toast.error('Preencha todos os campos obrigatórios da transportadora');
        setLoading(false);
        return;
      }
      if (!validateDocument(companyCNPJ)) {
        toast.error('CNPJ inválido');
        setLoading(false);
        return;
      }
    }

    // Validate input usando Zod schema
    const validation = validateInput(userRegistrationSchema, {
      full_name: fullName,
      email,
      password,
      phone,
      document: driverType === 'TRANSPORTADORA' ? companyCNPJ : document,
      role: driverType === 'TRANSPORTADORA' ? 'MOTORISTA' : role
    });
    
    if (validation.success === false) {
      toast.error(`Erro de validação: ${validation.errors.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`,
          data: {
            full_name: fullName,
            role: driverType === 'TRANSPORTADORA' ? 'MOTORISTA' : role,
            phone,
            document: driverType === 'TRANSPORTADORA' ? companyCNPJ : document,
            is_transport_company: driverType === 'TRANSPORTADORA'
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Email já cadastrado. Tente fazer login.');
        } else {
          toast.error('Erro na autenticação. Verifique suas credenciais.');
        }
        setLoading(false);
        return;
      }

      // Se for transportadora, criar registro na tabela transport_companies
      if (driverType === 'TRANSPORTADORA' && data?.user) {
        // Aguardar criação do perfil (trigger handle_new_user)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Buscar o profile_id
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', data.user.id)
          .single();

        if (profileData) {
          const { error: companyError } = await supabase
            .from('transport_companies')
            .insert({
              profile_id: profileData.id,
              company_name: companyName,
              company_cnpj: companyCNPJ,
              antt_registration: companyANTT,
              address: companyAddress,
              status: 'PENDING'
            });

          if (companyError) {
            console.error('Erro ao criar transportadora:', companyError);
            toast.warning('Cadastro criado, mas houve erro ao criar transportadora. Entre em contato com o suporte.');
          }
        }
      }

      toast.success('Pré-cadastro realizado! Verifique seu email para continuar.');
    } catch (error) {
      toast.error('Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowResendConfirmation(false); // Reset state

    try {
      // Determinar se é email, CPF ou usuário
      let signInData;
      
      if (loginField.includes('@')) {
        // É um email
        signInData = { email: loginField, password };
      } else {
        // É CPF ou usuário - buscar o email associado
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`document.eq.${loginField},full_name.ilike.%${loginField}%`)
          .single();

        if (profileError || !profile) {
          toast.error('Usuário ou CPF não encontrado');
          setLoading(false);
          return;
        }

        // Buscar o email do usuário
        const { data: user, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);
        
        if (userError || !user.user?.email) {
          toast.error('Erro ao buscar dados do usuário');
          setLoading(false);
          return;
        }

        signInData = { email: user.user.email, password };
      }

      const { error } = await supabase.auth.signInWithPassword(signInData);

      if (error) {
        const msg = error.message || '';
        if (msg.includes('Invalid login credentials')) {
          toast.error('Credenciais inválidas');
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          setShowResendConfirmation(true);
          toast.error('Email não confirmado. Clique em "Reenviar e-mail de confirmação" abaixo.');
        } else {
          toast.error(msg);
        }
      }
    } catch (error) {
      toast.error('Erro no login');
    } finally {
      setLoading(false);
    }
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
            Conectando pessoas
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Tabs defaultValue="login" className="space-y-6">
            <TabsList className="mx-auto grid grid-cols-2 gap-1 w-full max-w-xs bg-muted rounded-lg p-1">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Cadastro</TabsTrigger>
            </TabsList>
            
            {/* Social Login Section - Common for both tabs */}
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginField">Email, CPF ou Nome de Usuário</Label>
                  <Input
                    id="loginField"
                    value={loginField}
                    onChange={(e) => setLoginField(e.target.value)}
                    placeholder="Digite seu email, CPF ou nome de usuário"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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
            
            <TabsContent value="register">
              <div className="space-y-4">
                {/* Step 1: Seleção de Role */}
                {signupStep === 'role-selection' && (
                  <div className="space-y-4">
                    <Label htmlFor="role">Tipo de Usuário</Label>
                    <Select 
                      value={role === 'MOTORISTA' && !driverType ? 'MOTORISTA/TRANSPORTADORA' : role} 
                      onValueChange={(value) => {
                        if (value === 'MOTORISTA/TRANSPORTADORA') {
                          setRole('MOTORISTA');
                        } else {
                          setRole(value as 'PRODUTOR' | 'PRESTADOR_SERVICOS');
                          setDriverType(null);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUTOR">Produtor/Contratante</SelectItem>
                        <SelectItem value="MOTORISTA/TRANSPORTADORA">Motorista/Transportadora</SelectItem>
                        <SelectItem value="PRESTADOR_SERVICOS">Prestador de Serviços</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Botão Continuar - aparece quando um tipo é selecionado */}
                    {role && (
                      <Button 
                        type="button"
                        className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
                        onClick={() => {
                          if (role === 'MOTORISTA') {
                            setSignupStep('driver-type');
                          } else {
                            setSignupStep('form');
                          }
                        }}
                      >
                        Continuar
                      </Button>
                    )}
                  </div>
                )}

                {/* Step 2: Escolha entre Motorista ou Transportadora */}
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
                    
                    <h3 className="font-semibold text-lg">Escolha o tipo de cadastro:</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card 
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => {
                          setDriverType('MOTORISTA');
                          setSignupStep('form');
                        }}
                      >
                        <CardHeader>
                          <Truck className="h-12 w-12 text-primary mb-2" />
                          <CardTitle>Sou Motorista</CardTitle>
                          <CardDescription>
                            Motorista individual com CPF ou CNPJ
                          </CardDescription>
                        </CardHeader>
                      </Card>
                      
                      <Card 
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => {
                          setDriverType('TRANSPORTADORA');
                          setSignupStep('form');
                        }}
                      >
                        <CardHeader>
                          <Building2 className="h-12 w-12 text-primary mb-2" />
                          <CardTitle>Sou Transportadora</CardTitle>
                          <CardDescription>
                            Empresa de transporte (2 ou mais carretas)
                          </CardDescription>
                          <Badge variant="secondary" className="w-fit mt-2">2+ carretas</Badge>
                        </CardHeader>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Step 3: Formulário de Cadastro */}
                {signupStep === 'form' && (
                  <form onSubmit={handleSignUp} className="space-y-4">
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
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone WhatsApp</Label>
                      <Input
                        id="phone"
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

                        <div className="space-y-2">
                          <Label htmlFor="companyAddress">Endereço Completo *</Label>
                          <Input
                            id="companyAddress"
                            value={companyAddress}
                            onChange={(e) => setCompanyAddress(e.target.value)}
                            placeholder="Rua, Número, Bairro, Cidade, Estado"
                            required
                          />
                        </div>

                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="terms"
                            checked={acceptedTerms}
                            onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                          />
                          <label
                            htmlFor="terms"
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Li e aceito os{' '}
                            <a 
                              href="/termos" 
                              target="_blank" 
                              className="text-primary hover:underline"
                            >
                              Termos de Uso para Transportadoras
                            </a>
                            {' '}*
                          </label>
                        </div>
                      </>
                    ) : (
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
    </div>
  );
};

export default Auth;