import React, { useState, useEffect } from 'react';
import { validatePasswordStrength } from '@/utils/passwordValidation';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { routeAfterAuth } from '@/lib/route-after-auth';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Building2, User, Mail, Phone, Lock, FileText, MapPin, Truck, Eye, EyeOff } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { validateCPF, formatCPF } from '@/utils/cpfValidator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { queryWithTimeout } from '@/lib/query-utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function DriverInviteSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('inviteToken');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cpf: '',
    password: '',
    confirmPassword: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressCity: '',
    addressState: '',
    addressZipCode: '',
    vehiclePlate: '',
    vehicleType: '',
    vehicleModel: '',
    vehicleYear: '',
  });

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      console.warn('[DriverInviteSignup] Nenhum token fornecido na URL');
      setTokenValid(false);
      setError('Link de convite inválido. Nenhum token foi fornecido.');
      setLoading(false);
      toast.error('Link de convite inválido. Nenhum token foi fornecido.');
      return;
    }

    if (import.meta.env.DEV) console.log('[DriverInviteSignup] Validando token:', token);

    try {
      const response = await queryWithTimeout(
        () => supabase.functions.invoke('validar-token-convite', {
          body: { token }
        }),
        {
          timeoutMs: 5000,
          operationName: 'Validação de token de convite'
        }
      );

      const { data, error } = response;

      if (error) {
        console.error('[DriverInviteSignup] Erro na validação:', error);
        throw error;
      }

      if (import.meta.env.DEV) console.log('[DriverInviteSignup] Resposta recebida:', data);

      if (data.valid) {
        if (import.meta.env.DEV) console.log('[DriverInviteSignup] Token válido! Empresa:', data.empresa_nome);
        setTokenValid(true);
        setCompanyInfo({
          company_name: data.empresa_nome
        });
        setError(null);
        toast.success('Convite válido! Complete seu cadastro.');
      } else {
        console.warn('[DriverInviteSignup] Token inválido ou expirado');
        setTokenValid(false);
        setError(data.message || 'Este convite é inválido ou expirou.');
        toast.error(data.message || 'Este convite é inválido ou expirou.');
      }
    } catch (error: any) {
      console.error('[DriverInviteSignup] Falha ao validar token:', error);
      setTokenValid(false);
      
      if (error.message?.includes('Timeout')) {
        const timeoutMsg = 'A verificação do convite demorou muito. Verifique sua conexão e tente novamente.';
        setError(timeoutMsg);
        toast.error(timeoutMsg);
      } else {
        const errorMsg = error.message || 'Erro ao validar convite. Tente novamente.';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCPF(formData.cpf)) {
      toast.error('CPF inválido. Por favor, verifique o número digitado.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }

    const pwValidation = validatePasswordStrength(formData.password);
    if (!pwValidation.valid) {
      toast.error(`Senha fraca: ${pwValidation.errors.join(', ')}`);
      return;
    }

    if (!formData.fullName || !formData.email || !formData.phone) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('processar-cadastro-motorista', {
        body: {
          token,
          userData: {
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            phone: formData.phone,
            cpf: formData.cpf,
            address: formData.addressStreet ? {
              street: formData.addressStreet,
              number: formData.addressNumber,
              complement: formData.addressComplement,
              city: formData.addressCity,
              state: formData.addressState,
              zipCode: formData.addressZipCode,
            } : null,
            vehicle: formData.vehiclePlate ? {
              plate: formData.vehiclePlate,
              type: formData.vehicleType,
              model: formData.vehicleModel,
              year: formData.vehicleYear,
            } : null,
          }
        }
      });

      if (error) throw error;

      toast.success('Cadastro realizado com sucesso!');
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        console.error('Erro ao fazer login:', signInError);
        navigate('/auth');
      } else {
        // ✅ GATE UNIVERSAL: routeAfterAuth decide destino (complete-profile ou dashboard)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const dest = await routeAfterAuth(user.id);
          navigate(dest);
        } else {
          navigate('/complete-profile');
        }
      }
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      toast.error(error.message || 'Erro ao processar cadastro');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      {loading ? (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : !tokenValid ? (
        <Card className="w-full max-w-2xl border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle className="text-destructive">Convite Inválido</CardTitle>
            </div>
            <CardDescription>
              {error || 'Este link de convite é inválido, já foi utilizado ou expirou.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full"
            >
              Voltar para Página Inicial
            </Button>
            <Button 
              onClick={() => {
                setLoading(true);
                setError(null);
                validateToken();
              }} 
              variant="default" 
              className="w-full"
            >
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <CardTitle>Bem-vindo ao AgriRoute</CardTitle>
            </div>
            <CardDescription>
              Complete seu cadastro para se juntar à transportadora
            </CardDescription>
            {companyInfo && (
              <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-semibold">{companyInfo.company_name}</p>
                    <p className="text-sm text-muted-foreground">Transportadora</p>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 pb-2 border-b">
                  <User className="h-4 w-4" />
                  Dados Pessoais
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fullName">Nome Completo *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        className="pl-10"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-10"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        className="pl-10"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cpf"
                        type="text"
                        className="pl-10"
                        value={formData.cpf}
                        onChange={(e) => {
                          const formatted = formatCPF(e.target.value);
                          setFormData({ ...formData, cpf: formatted });
                        }}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        required
                      />
                    </div>
                    {formData.cpf && !validateCPF(formData.cpf) && formData.cpf.length >= 11 && (
                      <p className="text-xs text-destructive">CPF inválido</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 pb-2 border-b">
                  <MapPin className="h-4 w-4" />
                  Endereço (opcional)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="addressStreet">Rua</Label>
                    <Input
                      id="addressStreet"
                      type="text"
                      value={formData.addressStreet}
                      onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressNumber">Número</Label>
                    <Input
                      id="addressNumber"
                      type="text"
                      value={formData.addressNumber}
                      onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressComplement">Complemento</Label>
                    <Input
                      id="addressComplement"
                      type="text"
                      value={formData.addressComplement}
                      onChange={(e) => setFormData({ ...formData, addressComplement: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressCity">Cidade</Label>
                    <Input
                      id="addressCity"
                      type="text"
                      value={formData.addressCity}
                      onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressState">Estado</Label>
                    <Input
                      id="addressState"
                      type="text"
                      value={formData.addressState}
                      onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                      maxLength={2}
                      placeholder="SP"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="addressZipCode">CEP</Label>
                    <Input
                      id="addressZipCode"
                      type="text"
                      value={formData.addressZipCode}
                      onChange={(e) => setFormData({ ...formData, addressZipCode: e.target.value })}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 pb-2 border-b">
                  <Truck className="h-4 w-4" />
                  Veículo (opcional)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehiclePlate">Placa</Label>
                    <Input
                      id="vehiclePlate"
                      type="text"
                      value={formData.vehiclePlate}
                      onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
                      placeholder="ABC1234"
                      maxLength={7}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">Tipo</Label>
                    <Input
                      id="vehicleType"
                      type="text"
                      value={formData.vehicleType}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                      placeholder="Caminhão, Carreta, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleModel">Modelo</Label>
                    <Input
                      id="vehicleModel"
                      type="text"
                      value={formData.vehicleModel}
                      onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                      placeholder="Scania R440"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleYear">Ano</Label>
                    <Input
                      id="vehicleYear"
                      type="text"
                      value={formData.vehicleYear}
                      onChange={(e) => setFormData({ ...formData, vehicleYear: e.target.value })}
                      placeholder="2020"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 pb-2 border-b">
                  <Lock className="h-4 w-4" />
                  Credenciais de Acesso
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <PasswordInput
                        id="password"
                        className="pl-10"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <PasswordInput
                        id="confirmPassword"
                        className="pl-10"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-xs text-destructive">As senhas não conferem</p>
                    )}
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  * Campos obrigatórios. Campos opcionais podem ser preenchidos posteriormente no seu perfil.
                </AlertDescription>
              </Alert>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitting || (formData.cpf && !validateCPF(formData.cpf))}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando cadastro...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Completar Cadastro
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
