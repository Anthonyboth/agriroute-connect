import React, { useState, useEffect } from 'react';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { routeAfterAuth } from '@/lib/route-after-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackButton } from '@/components/BackButton';
import { toast } from 'sonner';
import { Loader2, Truck } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/error-handler';

const registerSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  cpf_cnpj: z.string().min(11, 'CPF/CNPJ inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  password_confirm: z.string()
}).refine((data) => data.password === data.password_confirm, {
  message: "As senhas não coincidem",
  path: ["password_confirm"],
});

export default function AffiliateSignup() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf_cnpj: '',
    password: '',
    password_confirm: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadCompany = async () => {
      if (!companyId) {
        toast.error('ID da transportadora não encontrado');
        navigate('/auth');
        return;
      }

      setLoading(true);
      try {
        const { data: company, error } = await supabase
          .from('transport_companies')
          .select('company_name')
          .eq('id', companyId)
          .single();

        if (error || !company) {
          console.error('Erro ao carregar transportadora:', error);
          toast.error('Transportadora não encontrada');
          navigate('/auth');
          return;
        }

        setCompanyName(company.company_name);
      } catch (error) {
        console.error('Erro ao carregar transportadora:', error);
        toast.error('Erro ao carregar informações');
        navigate('/auth');
      } finally {
        setLoading(false);
      }
    };

    loadCompany();
  }, [companyId, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = registerSchema.parse(formData);
      setSubmitting(true);

      // Sanitize document - only digits
      const cleanDoc = validatedData.cpf_cnpj.replace(/\D/g, '');

      // 1. Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            full_name: validatedData.full_name,
            phone: validatedData.phone,
            cpf_cnpj: cleanDoc,
            role: 'MOTORISTA'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // 2. Criar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          full_name: validatedData.full_name,
          email: validatedData.email,
          phone: validatedData.phone,
          cpf_cnpj: cleanDoc,
          role: 'MOTORISTA',
          status: 'PENDING'
        });

      if (profileError) throw profileError;

      // 3. Buscar o profile_id recém criado
      const { data: profile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (profileFetchError || !profile) throw new Error('Erro ao buscar perfil');

      // 4. Vincular à transportadora
      const { error: companyDriverError } = await supabase
        .from('company_drivers')
        .insert({
          company_id: companyId,
          driver_profile_id: profile.id,
          status: 'ACTIVE',
          accepted_at: new Date().toISOString()
        });

      if (companyDriverError) throw companyDriverError;

      toast.success('Cadastro realizado com sucesso! Bem-vindo à ' + companyName);
      // ✅ GATE UNIVERSAL: routeAfterAuth força /complete-profile se necessário
      const destination = await routeAfterAuth(authData.user.id);
      navigate(destination);

    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('Erro ao criar conta:', error);
        toast.error(getErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AppSpinner fullscreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-start mb-2">
            <BackButton to="/auth" />
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Cadastro de Motorista</CardTitle>
          <CardDescription>
            Cadastre-se para se afiliar à <span className="font-semibold text-foreground">{companyName}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="João da Silva"
                disabled={submitting}
              />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
              <Input
                id="cpf_cnpj"
                name="cpf_cnpj"
                value={formData.cpf_cnpj}
                onChange={handleInputChange}
                placeholder="000.000.000-00"
                disabled={submitting}
              />
              {errors.cpf_cnpj && <p className="text-sm text-destructive">{errors.cpf_cnpj}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(00) 00000-0000"
                disabled={submitting}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="joao@exemplo.com"
                disabled={submitting}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Mínimo 6 caracteres"
                disabled={submitting}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_confirm">Confirmar Senha</Label>
              <PasswordInput
                id="password_confirm"
                name="password_confirm"
                value={formData.password_confirm}
                onChange={handleInputChange}
                placeholder="Digite a senha novamente"
                disabled={submitting}
              />
              {errors.password_confirm && <p className="text-sm text-destructive">{errors.password_confirm}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
