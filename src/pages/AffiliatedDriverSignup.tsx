import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { validateDocument, formatDocument, validateCNPJ } from '@/utils/cpfValidator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const AffiliatedDriverSignup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyCNPJFromURL = searchParams.get('companyCNPJ') || '';
  const inviteToken = searchParams.get('inviteToken');

  const [loading, setLoading] = useState(false);
  const [validatingCompany, setValidatingCompany] = useState(false);
  const [companyValid, setCompanyValid] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyId, setCompanyId] = useState<string>('');

// Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [password, setPassword] = useState('');
  const normalizedFromURL = (companyCNPJFromURL || '').replace(/\D/g, '');
  const [companyCNPJ, setCompanyCNPJ] = useState(normalizedFromURL ? formatDocument(normalizedFromURL) : '');
  const [showForm, setShowForm] = useState(false);
  const cnpjDigits = companyCNPJ.replace(/\D/g, '');

  // Validar CNPJ da transportadora
  useEffect(() => {
    const validateCompanyCNPJ = async () => {
      if (!cnpjDigits || cnpjDigits.length < 14) {
        setCompanyValid(null);
        return;
      }

      if (!validateCNPJ(cnpjDigits)) {
        setCompanyValid(false);
        setCompanyName('');
        return;
      }

      setValidatingCompany(true);
      try {
        const { data, error } = await supabase
          .from('transport_companies')
          .select('id, company_name, status')
          .eq('company_cnpj', cnpjDigits)
          .maybeSingle();

        if (error) {
          console.error('Erro ao validar CNPJ:', error);
          setCompanyValid(false);
          setCompanyName('');
          return;
        }

        if (!data) {
          setCompanyValid(false);
          setCompanyName('');
          toast.error('CNPJ não encontrado. Verifique se a transportadora está cadastrada.');
          return;
        }

        const allowedStatuses = ['ACTIVE', 'PENDING', 'APPROVED'];
        if (data.status && !allowedStatuses.includes(data.status)) {
          setCompanyValid(false);
          setCompanyName('');
          toast.error('Transportadora com status inválido para afiliados.');
          return;
        }

        setCompanyValid(true);
        setCompanyName(data.company_name);
        setCompanyId(data.id);
      } catch (error) {
        console.error('Erro ao validar transportadora:', error);
        setCompanyValid(false);
        setCompanyName('');
      } finally {
        setValidatingCompany(false);
      }
    };

    validateCompanyCNPJ();
  }, [companyCNPJ]);

  useEffect(() => {
    if (companyValid && (companyCNPJFromURL || inviteToken)) {
      setShowForm(true);
    }
  }, [companyValid, companyCNPJFromURL, inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validações
    if (!companyValid) {
      toast.error('CNPJ da transportadora inválido');
      setLoading(false);
      return;
    }

    if (!validateDocument(document)) {
      toast.error('CPF/CNPJ inválido');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`,
          data: {
            full_name: fullName,
            role: 'MOTORISTA_AFILIADO',
            phone,
            document,
            is_affiliated_driver: true,
            affiliated_company_cnpj: companyCNPJ.replace(/\D/g, '')
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error('Email já cadastrado. Tente fazer login.');
        } else {
          toast.error('Erro no cadastro. Tente novamente.');
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error('Erro ao criar usuário');
        setLoading(false);
        return;
      }

      // 2. Aguardar criação do perfil (trigger handle_new_user)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Buscar o profile_id criado
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError || !profileData) {
        console.error('Erro ao buscar perfil:', profileError);
        toast.error('Perfil criado, mas houve erro. Entre em contato com o suporte.');
        setLoading(false);
        return;
      }

      // 4. Criar vínculo automático em company_drivers
      const { error: linkError } = await supabase
        .from('company_drivers')
        .insert({
          company_id: companyId,
          driver_profile_id: profileData.id,
          status: 'ACTIVE',
          can_accept_freights: false, // Motoristas afiliados não podem aceitar fretes
          can_manage_vehicles: false, // Motoristas afiliados não podem gerenciar veículos
          affiliation_type: 'AFFILIATED',
          invited_by: null, // Auto-cadastro
          notes: 'Cadastro automático como motorista afiliado'
        });

      if (linkError) {
        console.error('Erro ao criar vínculo:', linkError);
        toast.warning('Cadastro criado, mas houve erro ao vincular. Entre em contato com o suporte.');
      }

      // 5. Criar notificação para a transportadora
      const { data: companyData } = await supabase
        .from('transport_companies')
        .select('profile_id')
        .eq('id', companyId)
        .single();

      if (companyData) {
        await supabase.from('notifications').insert({
          user_id: companyData.profile_id,
          title: 'Novo Motorista Afiliado',
          message: `${fullName} se cadastrou como motorista afiliado da sua transportadora`,
          type: 'company_affiliated_driver',
          data: {
            driver_profile_id: profileData.id,
            driver_name: fullName
          }
        });
      }

      toast.success('Cadastro realizado com sucesso! Verifique seu email para confirmar.');
      
      // Redirecionar para tela de confirmação
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (error) {
      console.error('Erro no cadastro:', error);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <BackButton to="/auth" />
          <div className="flex justify-center mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Cadastro de Motorista Afiliado</CardTitle>
          <CardDescription>
            Cadastre-se como motorista vinculado a uma transportadora
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {/* CNPJ da Transportadora */}
            <div className="space-y-2">
              <Label htmlFor="companyCNPJ">CNPJ da Transportadora *</Label>
              <Input
                id="companyCNPJ"
                value={companyCNPJ}
                onChange={(e) => setCompanyCNPJ(formatDocument(e.target.value))}
                placeholder="00.000.000/0000-00"
                required
                disabled={!!companyCNPJFromURL || !!inviteToken} // Desabilitar se vier de link de convite
                maxLength={18}
              />
              {validatingCompany && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando CNPJ...
                </p>
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
              {companyValid === false && cnpjDigits.length >= 14 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    CNPJ não encontrado ou transportadora inativa
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {companyValid === true && !showForm && (
              <Button type="button" className="w-full" onClick={() => setShowForm(true)}>
                Continuar
              </Button>
            )}

            {/* Etapa 2: Informações do Motorista Afiliado */}
            {showForm && companyValid === true && (
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document">CPF/CNPJ *</Label>
                  <Input
                    id="document"
                    value={document}
                    onChange={(e) => setDocument(formatDocument(e.target.value))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !companyValid}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Cadastrar como Motorista Afiliado'
                  )}
                </Button>
              </form>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Já tem uma conta?{' '}
            <Button
              variant="link"
              className="text-xs p-0 h-auto"
              onClick={() => navigate('/auth')}
            >
              Faça login
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliatedDriverSignup;