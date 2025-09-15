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
import { validateDocument } from '@/utils/cpfValidator';


const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'PRODUTOR' | 'MOTORISTA'>('PRODUTOR');
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profile) {
        // Check if profile is complete (has required documents)
        const isProfileComplete = profile.selfie_url && profile.document_photo_url;
        const isDriverComplete = profile.role !== 'MOTORISTA' || (
          profile.cnh_photo_url && 
          profile.truck_documents_url && 
          profile.truck_photo_url && 
          profile.license_plate_photo_url && 
          profile.address_proof_url &&
          profile.location_enabled
        );

        if (!isProfileComplete || !isDriverComplete) {
          navigate('/complete-profile');
          return;
        }

        if (profile.status !== 'APPROVED') {
          toast.info('Sua conta está pendente de aprovação');
          return;
        }

        switch (profile.role) {
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>AgriRoute Connect</CardTitle>
          <CardDescription>
            Conectando produtores e transportadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
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
                <Button type="submit" className="w-full" disabled={loading}>
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
                    <Select value={role} onValueChange={(value: 'PRODUTOR' | 'MOTORISTA') => setRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUTOR">Produtor</SelectItem>
                        <SelectItem value="MOTORISTA">Motorista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
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
                  className="p-0 h-auto text-xs"
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