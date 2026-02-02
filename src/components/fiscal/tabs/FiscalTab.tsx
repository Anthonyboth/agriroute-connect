import React, { useState } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  FileText, 
  Building2, 
  CheckCircle, 
  AlertTriangle,
  Settings,
  Info,
  GraduationCap
} from 'lucide-react';
import { useDocumentPermissions } from '@/hooks/useDocumentPermissions';
import { FiscalDocumentCards } from './FiscalDocumentCards';
import { FiscalIssuerSetup } from './FiscalIssuerSetup';
import { FiscalOnboardingWizard } from '@/components/fiscal/FiscalOnboardingWizard';
import { FiscalEducationHub, hasCompletedFiscalWizard } from '@/components/fiscal/education';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FiscalTabProps {
  userRole: string;
}

export const FiscalTab: React.FC<FiscalTabProps> = ({ userRole }) => {
  const { profile } = useAuth();
  const permissions = useDocumentPermissions(userRole);
  const [activeSubTab, setActiveSubTab] = useState('documents');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Verificar se já tem emissor fiscal configurado
  const { data: fiscalIssuer, isLoading: loadingIssuer } = useQuery({
    queryKey: ['fiscal-issuer', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from('fiscal_issuers')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar emissor fiscal:', error);
      }
      return data;
    },
    enabled: !!profile?.id,
  });

  // Buscar documentos recentes
  const { data: recentDocuments } = useQuery({
    queryKey: ['recent-fiscal-documents', fiscalIssuer?.id],
    queryFn: async () => {
      if (!fiscalIssuer?.id) return { nfes: 0, ctes: 0, mdfes: 0 };
      
      const [nfeResult, cteResult] = await Promise.all([
        supabase
          .from('nfe_emissions')
          .select('id', { count: 'exact', head: true })
          .eq('issuer_id', fiscalIssuer.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('ctes')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', fiscalIssuer.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      
      return {
        nfes: nfeResult.count || 0,
        ctes: cteResult.count || 0,
        mdfes: 0,
      };
    },
    enabled: !!fiscalIssuer?.id,
  });

  const hasIssuerConfigured = !!fiscalIssuer;
  // ✅ CORREÇÃO P0: Incluir 'certificate_uploaded' (status definido pela Edge Function)
  const hasCertificate = 
    fiscalIssuer?.status === 'ACTIVE' || 
    fiscalIssuer?.status === 'active' ||
    fiscalIssuer?.status === 'certificate_uploaded' ||
    fiscalIssuer?.sefaz_status === 'validated';

  // Determinar status fiscal geral
  const getFiscalStatus = () => {
    if (!hasIssuerConfigured) {
      return { status: 'warning', message: 'Configure seu emissor fiscal para começar' };
    }
    if (!hasCertificate && (permissions.canEmitCte || permissions.canEmitMdfe)) {
      return { status: 'warning', message: 'Faça upload do certificado A1 para emitir CT-e e MDF-e' };
    }
    return { status: 'success', message: 'Emissor fiscal configurado e pronto para uso' };
  };

  const fiscalStatus = getFiscalStatus();

  if (loadingIssuer) {
    return <CenteredSpinner className="py-12" />;
  }

  return (
    <div className="space-y-6">
      {/* Header com Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Área Fiscal</h2>
          <p className="text-muted-foreground">
            Gerencie seus documentos fiscais eletrônicos
          </p>
        </div>
        
        <Alert className={`max-w-md ${
          fiscalStatus.status === 'success' 
            ? 'border-green-500/50 bg-green-500/10' 
            : 'border-yellow-500/50 bg-yellow-500/10'
        }`}>
          {fiscalStatus.status === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          )}
          <AlertDescription className="text-sm">
            {fiscalStatus.message}
          </AlertDescription>
        </Alert>
      </div>

      {/* Sub-abas */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Guia Fiscal</span>
            {!hasCompletedFiscalWizard() && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">Novo</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="issuer" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Emissor</span>
          </TabsTrigger>
          {permissions.canManageAllDocuments && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Documentos Fiscais */}
        <TabsContent value="documents" className="space-y-6 mt-6">
          {!hasIssuerConfigured ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  Configure seu Emissor Fiscal
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Para emitir documentos fiscais eletrônicos, você precisa primeiro cadastrar 
                  os dados da sua empresa emissora.
                </p>
                <Button onClick={() => setShowOnboarding(true)} size="lg">
                  <Building2 className="mr-2 h-5 w-5" />
                  Configurar Emissor
                </Button>
              </CardContent>
            </Card>
          ) : (
            <FiscalDocumentCards 
              userRole={userRole}
              fiscalIssuer={fiscalIssuer}
              permissions={permissions}
              recentCounts={recentDocuments}
            />
          )}

          {/* Informação sobre documentos bloqueados para prestador */}
          {userRole === 'PRESTADOR_SERVICOS' && (
            <Alert className="border-blue-500/30 bg-blue-500/5">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle>Documentos Disponíveis</AlertTitle>
              <AlertDescription>
                Como prestador de serviços, você pode emitir <strong>NF-e</strong> para 
                seus serviços. CT-e, MDF-e e GT-A são específicos para operações de transporte.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Guia Fiscal Educativo */}
        <TabsContent value="guide" className="space-y-6 mt-6">
          <FiscalEducationHub 
            userRole={userRole}
            defaultUf={fiscalIssuer?.uf || 'MT'}
            fiscalIssuer={fiscalIssuer}
          />
        </TabsContent>

        {/* Configuração do Emissor */}
        <TabsContent value="issuer" className="space-y-6 mt-6">
          <FiscalIssuerSetup 
            fiscalIssuer={fiscalIssuer}
            userRole={userRole}
            onStartOnboarding={() => {
              setIsEditMode(!!fiscalIssuer); // Edit mode se já tem emissor
              setShowOnboarding(true);
            }}
          />
        </TabsContent>

        {/* Configurações Avançadas (apenas transportadoras) */}
        {permissions.canManageAllDocuments && (
          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Avançadas</CardTitle>
                <CardDescription>
                  Gerencie configurações fiscais da transportadora
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <h4 className="font-medium mb-2">Ambiente SEFAZ</h4>
                    <Badge variant={fiscalIssuer?.fiscal_environment === 'producao' ? 'default' : 'secondary'}>
                      {fiscalIssuer?.fiscal_environment === 'producao' ? 'Produção' : 'Homologação'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      {fiscalIssuer?.fiscal_environment === 'producao' 
                        ? 'Documentos com validade jurídica' 
                        : 'Ambiente de testes'}
                    </p>
                  </Card>
                  
                  <Card className="p-4">
                    <h4 className="font-medium mb-2">Status do Emissor</h4>
                    <Badge variant={fiscalIssuer?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {fiscalIssuer?.status || 'PENDING'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      Status atual do cadastro fiscal
                    </p>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal de Onboarding Fiscal */}
      <Dialog open={showOnboarding} onOpenChange={(open) => {
        if (!open) {
          setShowOnboarding(false);
          setIsEditMode(false);
        }
      }}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden">
          <FiscalOnboardingWizard
            editMode={isEditMode}
            onCancel={() => {
              setShowOnboarding(false);
              setIsEditMode(false);
            }}
            onComplete={() => {
              setShowOnboarding(false);
              setIsEditMode(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
