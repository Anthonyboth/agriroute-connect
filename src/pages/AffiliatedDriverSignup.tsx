import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Users, AlertTriangle } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { validateDocument, formatDocument, validateCNPJ, formatCNPJ } from '@/utils/cpfValidator';
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
  const [cnpjLocalValid, setCnpjLocalValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

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

  // Validar CNPJ localmente e buscar transportadora
  useEffect(() => {
    const validateCompanyCNPJ = async () => {
      // Validação local
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

      // Buscar no banco usando RPC seguro
      setIsValidating(true);
      setValidatingCompany(true);
      try {
        const { data, error } = await supabase.rpc('find_company_by_cnpj', {
          p_cnpj: cnpjDigits
        });

        console.log('RPC find_company_by_cnpj resultado:', { data, error });

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
                onChange={(e) => setCompanyCNPJ(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                required
                disabled={!!companyCNPJFromURL || !!inviteToken} // Desabilitar se vier de link de convite
                maxLength={18}
              />
              
              {/* Feedback de validação */}
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
                <Alert variant="destructive" className="mt-4">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>CNPJ não encontrado</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>Esta transportadora não está cadastrada no AgriRoute.</p>
                    <div className="flex flex-col gap-2 mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const message = `Olá! Para eu me afiliar como motorista, preciso que a sua empresa se cadastre no AgriRoute: ${window.location.origin}/auth (escolha "Transportadora" no cadastro)`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                      >
                        <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Convidar transportadora via WhatsApp
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/auth`);
                          toast.success('Link de cadastro copiado!');
                        }}
                      >
                        Copiar link de cadastro
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Peça para a transportadora se cadastrar no AgriRoute escolhendo a opção "Transportadora" no cadastro.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Botão Continuar - aparece quando CNPJ for válido localmente */}
            {cnpjLocalValid && !showForm && (
              <Button 
                type="button"
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
                onClick={() => {
                  if (companyValid === true) {
                    setShowForm(true);
                  } else if (companyValid === null || isValidating) {
                    toast.error('Aguardando validação do CNPJ...');
                  } else if (companyValid === false) {
                    toast.error('CNPJ não encontrado. Convide a transportadora primeiro.');
                  }
                }}
                disabled={companyValid !== true}
              >
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