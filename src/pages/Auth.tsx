import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { validateDocument } from '@/utils/cpfValidator';


const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'PRODUTOR' | 'MOTORISTA' | 'PRESTADOR_SERVICOS'>('PRODUTOR');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Only check for existing session on mount, don't duplicate auth state changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Use setTimeout to prevent immediate redirect conflicts
        setTimeout(() => {
          handleRedirectAfterAuth(session.user.id);
        }, 100);
      }
    });
  }, []);

  const handleRedirectAfterAuth = async (userId: string) => {
    try {
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId);

      if (!userProfiles || userProfiles.length === 0) {
        navigate('/complete-profile');
        return;
      }

      // Se tem múltiplos perfis, usar o salvo no localStorage ou o primeiro
      let activeProfile = userProfiles[0];
      const savedProfileId = localStorage.getItem('current_profile_id');
      
      if (savedProfileId && userProfiles.length > 1) {
        const savedProfile = userProfiles.find(p => p.id === savedProfileId);
        if (savedProfile) {
          activeProfile = savedProfile;
        }
      }

      // Verificar se o perfil está completo
      const isProfileComplete = activeProfile.selfie_url && activeProfile.document_photo_url;
      const isDriverComplete = activeProfile.role !== 'MOTORISTA' || (
        activeProfile.cnh_photo_url && 
        activeProfile.truck_documents_url && 
        activeProfile.truck_photo_url && 
        activeProfile.license_plate_photo_url && 
        activeProfile.address_proof_url &&
        activeProfile.location_enabled
      );

      if (!isProfileComplete || !isDriverComplete) {
        navigate('/complete-profile');
        return;
      }

      if (activeProfile.status !== 'APPROVED') {
        toast.info('Sua conta está pendente de aprovação');
        return;
      }

      switch (activeProfile.role) {
        case 'ADMIN':
          navigate('/admin');
          break;
        case 'MOTORISTA':
          navigate('/dashboard/driver');
          break;
        case 'PRODUTOR':
          navigate('/dashboard/producer');
          break;
        default:
          navigate('/');
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      navigate('/');
    }
  };


  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate CPF/CNPJ
    if (document && !validateDocument(document)) {
      toast.error('CPF/CNPJ inválido. Verifique os dados informados.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            role,
            phone,
            document
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Email já cadastrado. Tente fazer login.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Pré-cadastro realizado! Verifique seu email para continuar.');
      }
    } catch (error) {
      toast.error('Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Credenciais inválidas');
        } else {
          toast.error(error.message);
        }
      }
    } catch (error) {
      toast.error('Erro no login');
    } finally {
      setLoading(false);
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
            Conectando produtores e transportadores
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
                  <Input
                    id="password"
                    type="password"
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

            </TabsContent>
            
            <TabsContent value="register">
              <div className="space-y-4">
                
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
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
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document">CPF/CNPJ</Label>
                    <Input
                      id="document"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Tipo de Usuário</Label>
                    <Select value={role} onValueChange={(value: 'PRODUTOR' | 'MOTORISTA' | 'PRESTADOR_SERVICOS') => setRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUTOR">Produtor</SelectItem>
                        <SelectItem value="MOTORISTA">Motorista</SelectItem>
                        <SelectItem value="PRESTADOR_SERVICOS">Prestador de Serviços</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full h-12" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cadastrar
                  </Button>
                </form>
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
    </div>
  );
};

export default Auth;