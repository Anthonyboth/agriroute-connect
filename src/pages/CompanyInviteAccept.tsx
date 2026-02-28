import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BackButton } from '@/components/BackButton';
import { supabase } from '@/integrations/supabase/client';
import { routeAfterAuth } from '@/lib/route-after-auth';
import { toast } from 'sonner';
import { Truck, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { z } from 'zod';

const registerSchema = z.object({
  full_name: z.string().min(3, 'Nome completo é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  cpf_cnpj: z.string().min(11, 'CPF inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

const CompanyInviteAccept: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf_cnpj: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (inviteCode) {
      validateInviteCode();
    }
  }, [inviteCode]);

  const validateInviteCode = async () => {
    try {
      // Buscar informações do convite
      const { data, error } = await supabase
        .from('company_invites')
        .select(`
          *,
          company:transport_companies(company_name, company_cnpj)
        `)
        .eq('invite_code', inviteCode)
        .single();

      if (error || !data) {
        console.error('Convite não encontrado:', error);
        setInviteData(null);
        setLoading(false);
        return;
      }

      // Verificar se o convite é válido
      const now = new Date();
      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
      
      if (data.status !== 'PENDING' || (expiresAt && expiresAt < now)) {
        console.log('Convite inválido ou expirado');
        setInviteData(null);
        setLoading(false);
        return;
      }

      setInviteData(data);
    } catch (error) {
      console.error('Erro ao validar convite:', error);
      setInviteData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo ao digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar dados
    try {
      registerSchema.parse(formData);
    } catch (error: any) {
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err: any) => {
        fieldErrors[err.path[0]] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: 'MOTORISTA',
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // 2. Criar perfil de motorista
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          cpf_cnpj: formData.cpf_cnpj,
          role: 'MOTORISTA',
          status: 'PENDING',
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // 3. Vincular à transportadora
      const { error: driverError } = await supabase
        .from('company_drivers')
        .insert({
          company_id: inviteData.company_id,
          driver_profile_id: profile.id,
          invited_by: inviteData.invited_by,
          status: 'ACTIVE',
          accepted_at: new Date().toISOString(),
        });

      if (driverError) throw driverError;

      // 4. Atualizar convite
      const { error: inviteError } = await supabase
        .from('company_invites')
        .update({
          status: 'ACCEPTED',
          accepted_by: profile.id,
          accepted_at: new Date().toISOString(),
          invited_driver_id: profile.id,
        })
        .eq('id', inviteData.id);

      if (inviteError) throw inviteError;

      toast.success('Cadastro realizado com sucesso! Bem-vindo à transportadora!');
      // ✅ GATE UNIVERSAL: routeAfterAuth força /complete-profile se documentos ausentes
      const destination = await routeAfterAuth(authData.user.id);
      navigate(destination);
    } catch (error: any) {
      console.error('Erro ao processar cadastro:', error);
      toast.error(error.message || 'Erro ao processar cadastro');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>
              Este convite não é válido ou expirou.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-start mb-2">
            <BackButton to="/auth" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Truck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>Junte-se à Transportadora</CardTitle>
          <CardDescription>
            Você foi convidado para fazer parte da{' '}
            <span className="font-semibold">{inviteData.company?.company_name}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Seu nome completo"
              />
              {errors.full_name && (
                <p className="text-sm text-destructive mt-1">{errors.full_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="cpf_cnpj">CPF *</Label>
              <Input
                id="cpf_cnpj"
                value={formData.cpf_cnpj}
                onChange={(e) => handleInputChange('cpf_cnpj', e.target.value)}
                placeholder="000.000.000-00"
              />
              {errors.cpf_cnpj && (
                <p className="text-sm text-destructive mt-1">{errors.cpf_cnpj}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Telefone WhatsApp *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Senha *</Label>
              <PasswordInput
                id="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <PasswordInput
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Digite a senha novamente"
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-destructive mt-1">As senhas não conferem</p>
              )}
              {errors.confirmPassword && (
                <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aceitar Convite e Cadastrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyInviteAccept;