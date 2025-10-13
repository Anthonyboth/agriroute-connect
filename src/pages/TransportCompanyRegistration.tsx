import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { validateCNPJ } from '@/utils/cpfValidator';

const TransportCompanyRegistration: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isTransportCompany, createCompany } = useTransportCompany();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    company_cnpj: '',
    antt_registration: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  });

  // Basic SEO
  useEffect(() => {
    document.title = 'Cadastro de Transportadora | AgriRoute';
    const metaDesc = document.querySelector('meta[name="description"]');
    const desc = 'Cadastro de transportadora no AgriRoute: crie sua empresa e gerencie motoristas e fretes.';
    if (metaDesc) {
      metaDesc.setAttribute('content', desc);
    } else {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      m.setAttribute('content', desc);
      document.head.appendChild(m);
    }
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const href = `${window.location.origin}/cadastro-transportadora`;
    if (canonical) {
      canonical.href = href;
    } else {
      const link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', href);
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (isTransportCompany) {
      navigate('/dashboard/company', { replace: true });
    }
  }, [isTransportCompany, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    // Validations
    if (!formData.company_name.trim()) {
      toast.error('Informe o nome da empresa');
      return;
    }
    if (!validateCNPJ(formData.company_cnpj)) {
      toast.error('CNPJ inválido');
      return;
    }

    setLoading(true);
    try {
      await createCompany({
        company_name: formData.company_name.trim(),
        company_cnpj: formData.company_cnpj.trim(),
        antt_registration: formData.antt_registration.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        zip_code: formData.zip_code.trim() || undefined,
      });

      // Set active mode to TRANSPORTADORA
      await supabase
        .from('profiles')
        .update({ active_mode: 'TRANSPORTADORA' })
        .eq('id', profile.id);

      localStorage.setItem('active_mode', 'TRANSPORTADORA');
      toast.success('Transportadora criada! Redirecionando...');
      navigate('/dashboard/company', { replace: true });
    } catch (err: any) {
      console.error('Erro ao cadastrar transportadora', err);
      toast.error('Não foi possível concluir o cadastro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <section className="max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Cadastro de Transportadora</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Cadastro de Transportadora
            </CardTitle>
            <CardDescription>
              Informe os dados da empresa para habilitar o modo Transportadora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="company_name">Nome da Empresa *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Ex: Transportadora XYZ Ltda"
                  required
                />
              </div>

              <div>
                <Label htmlFor="company_cnpj">CNPJ *</Label>
                <Input
                  id="company_cnpj"
                  value={formData.company_cnpj}
                  onChange={(e) => setFormData({ ...formData, company_cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  required
                />
              </div>

              <div>
                <Label htmlFor="antt_registration">Registro ANTT</Label>
                <Input
                  id="antt_registration"
                  value={formData.antt_registration}
                  onChange={(e) => setFormData({ ...formData, antt_registration: e.target.value })}
                  placeholder="Número do registro ANTT"
                />
              </div>

              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, complemento"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando transportadora...
                    </>
                  ) : (
                    'Criar Transportadora'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default TransportCompanyRegistration;
