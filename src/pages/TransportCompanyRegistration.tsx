import React, { useEffect, useState } from 'react';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useNavigate } from 'react-router-dom';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useAuth } from '@/hooks/useAuth';
import { resolvePostAuthRoute } from '@/lib/route-after-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TransportCompanyDocumentUpload } from '@/components/TransportCompanyDocumentUpload';
import { BackButton } from '@/components/BackButton';
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

  const [documents, setDocuments] = useState({
    cnpj_document_url: '',
    antt_document_url: '',
    terms_accepted: false
  });

  const [documentsComplete, setDocumentsComplete] = useState(false);
  const [hasExistingCompany, setHasExistingCompany] = useState(false);

  // Verificar se já tem transportadora e validar role
  useEffect(() => {
    const checkExistingCompanyAndRole = async () => {
      if (!profile?.id) return;
      
      // Bloquear se já é outro tipo de usuário (não motorista/não produtor)
      if (profile.role !== 'MOTORISTA' && profile.role !== 'PRODUTOR' && profile.role !== 'TRANSPORTADORA') {
        toast.error('Você já possui um tipo de conta que não permite cadastro de transportadora');
        navigate('/', { replace: true });
        return;
      }
      
      // Verificar se já tem transportadora
      const { data } = await supabase
        .from('transport_companies')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();
      
      if (data) {
        setHasExistingCompany(true);
        // Já existe transportadora — usar gate universal
        localStorage.setItem('active_mode', 'TRANSPORTADORA');
        toast.info('Redirecionando para o painel da transportadora...');
        const dest = await resolvePostAuthRoute({
          id: profile.id,
          role: 'TRANSPORTADORA',
          status: profile.status || 'PENDING',
          selfie_url: profile.selfie_url || null,
          document_photo_url: profile.document_photo_url || null,
        });
        navigate(dest, { replace: true });
      }
    };
    
    checkExistingCompanyAndRole();
  }, [profile, navigate]);

  // Basic SEO
  useEffect(() => {
    document.title = 'Cadastro de Transportadora | AgriRoute';
    
    let createdMeta: HTMLMetaElement | null = null;
    let createdLink: HTMLLinkElement | null = null;
    
    const metaDesc = document.querySelector('meta[name="description"]');
    const desc = 'Cadastro de transportadora no AgriRoute: crie sua empresa e gerencie motoristas e fretes.';
    if (metaDesc) {
      metaDesc.setAttribute('content', desc);
    } else {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      m.setAttribute('content', desc);
      document.head.appendChild(m);
      createdMeta = m;
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
      createdLink = link;
    }
    
    return () => {
      // Only remove elements we created
      if (createdMeta && createdMeta.parentNode) {
        try {
          createdMeta.parentNode.removeChild(createdMeta);
        } catch (e) {
          console.warn('[TransportCompanyRegistration] Error removing meta:', e);
        }
      }
      if (createdLink && createdLink.parentNode) {
        try {
          createdLink.parentNode.removeChild(createdLink);
        } catch (e) {
          console.warn('[TransportCompanyRegistration] Error removing link:', e);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (isTransportCompany || hasExistingCompany) {
      // ✅ GATE: usa resolvePostAuthRoute em vez de hardcode
      if (profile) {
        resolvePostAuthRoute({
          id: profile.id,
          role: 'TRANSPORTADORA',
          status: profile.status || 'PENDING',
          selfie_url: profile.selfie_url || null,
          document_photo_url: profile.document_photo_url || null,
        }).then(dest => navigate(dest, { replace: true }));
      }
    }
  }, [isTransportCompany, hasExistingCompany, navigate, profile]);

  const handleDocumentsComplete = (docs: typeof documents) => {
    setDocuments(docs);
  };

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
    if (!documents.cnpj_document_url || !documents.antt_document_url) {
      toast.error('Envie todos os documentos obrigatórios');
      return;
    }
    if (!documents.terms_accepted) {
      toast.error('Você precisa aceitar os termos e condições');
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
        cnpj_document_url: documents.cnpj_document_url,
        antt_document_url: documents.antt_document_url,
      });

      // Set active mode to TRANSPORTADORA
      await supabase
        .from('profiles')
        .update({ active_mode: 'TRANSPORTADORA' })
        .eq('id', profile.id);

      localStorage.setItem('active_mode', 'TRANSPORTADORA');
      toast.success('🎉 Transportadora criada e aprovada! Redirecionando...');
      // ✅ GATE UNIVERSAL
      const dest = await resolvePostAuthRoute({
        id: profile.id,
        role: 'TRANSPORTADORA',
        status: profile.status || 'PENDING',
        selfie_url: profile.selfie_url || null,
        document_photo_url: profile.document_photo_url || null,
      });
      navigate(dest, { replace: true });
    } catch (err: any) {
      console.error('Erro ao cadastrar transportadora', err);
      toast.error('Não foi possível concluir o cadastro');
    } finally {
      setLoading(false);
    }
  };

  if (hasExistingCompany || isTransportCompany) {
    return <AppSpinner fullscreen />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <section className="max-w-2xl mx-auto">
        <header className="mb-6">
          <BackButton label="Voltar" className="mb-4" />
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

            </form>
          </CardContent>
        </Card>

        {/* Seção de Documentos */}
        <TransportCompanyDocumentUpload
          onAllDocumentsComplete={handleDocumentsComplete}
          onDocumentsChange={setDocumentsComplete}
        />

        {/* Botão de Submissão */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={handleSubmit}
              className="w-full" 
              disabled={loading || !documentsComplete}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando transportadora...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-5 w-5" />
                  Criar Transportadora
                </>
              )}
            </Button>
            {!documentsComplete && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                Complete o formulário e envie todos os documentos para continuar
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default TransportCompanyRegistration;
