import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  CheckCircle, 
  AlertTriangle,
  Upload,
  FileKey,
  Settings,
  RefreshCw
} from 'lucide-react';
import { CertificateUploadDialog } from '@/components/fiscal/CertificateUploadDialog';
import type { Database } from '@/integrations/supabase/types';

type FiscalIssuerRow = Database['public']['Tables']['fiscal_issuers']['Row'];

interface FiscalIssuerSetupProps {
  fiscalIssuer: FiscalIssuerRow | null;
  userRole: string;
  onStartOnboarding: () => void;
}

export const FiscalIssuerSetup: React.FC<FiscalIssuerSetupProps> = ({
  fiscalIssuer,
  userRole,
  onStartOnboarding,
}) => {
  const [showCertUpload, setShowCertUpload] = React.useState(false);

  if (!fiscalIssuer) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            Nenhum Emissor Configurado
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Configure os dados da sua empresa para começar a emitir documentos fiscais eletrônicos.
          </p>
          <Button onClick={onStartOnboarding} size="lg">
            <Building2 className="mr-2 h-5 w-5" />
            Configurar Emissor
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Check certificate status based on sefaz validation
  const hasCertificate = fiscalIssuer.sefaz_status === 'validated' || fiscalIssuer.status === 'active';
  const sefazValidatedAt = fiscalIssuer.sefaz_validated_at 
    ? new Date(fiscalIssuer.sefaz_validated_at) 
    : null;

  return (
    <div className="space-y-6">
      {/* Dados do Emissor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados do Emissor
              </CardTitle>
              <CardDescription>
                Informações cadastradas para emissão fiscal
              </CardDescription>
            </div>
            <Badge variant={fiscalIssuer.status === 'active' ? 'default' : 'secondary'}>
              {fiscalIssuer.status === 'active' ? 'Ativo' : fiscalIssuer.status || 'Pendente'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Razão Social</p>
              <p className="font-medium">{fiscalIssuer.legal_name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nome Fantasia</p>
              <p className="font-medium">{fiscalIssuer.trade_name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Documento</p>
              <p className="font-medium font-mono">
                {fiscalIssuer.document_number?.replace(
                  /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                  '$1.$2.$3/$4-$5'
                ) || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inscrição Estadual</p>
              <p className="font-medium">{fiscalIssuer.state_registration || '-'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Endereço</p>
              <p className="font-medium">
                {[
                  fiscalIssuer.address_street,
                  fiscalIssuer.address_number,
                  fiscalIssuer.address_neighborhood,
                  fiscalIssuer.city,
                  fiscalIssuer.uf,
                ].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <Button variant="outline" onClick={onStartOnboarding}>
              <Settings className="mr-2 h-4 w-4" />
              Editar Dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Certificado Digital */}
      <Card className={!hasCertificate ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileKey className="h-5 w-5" />
                Certificado Digital A1
              </CardTitle>
              <CardDescription>
                Necessário para CT-e e MDF-e
              </CardDescription>
            </div>
            {hasCertificate ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle className="h-3 w-3" />
                Válido
              </Badge>
            ) : (
              <Badge variant="secondary">Não configurado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasCertificate && sefazValidatedAt ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Validado em</p>
                  <p className="font-medium">
                    {sefazValidatedAt.toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status SEFAZ</p>
                  <p className="font-medium text-green-600">
                    {fiscalIssuer.sefaz_status || 'Validado'}
                  </p>
                </div>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setShowCertUpload(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Certificado
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <FileKey className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Faça upload do seu certificado digital A1 para emitir CT-e e MDF-e
              </p>
              <Button onClick={() => setShowCertUpload(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Fazer Upload
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Upload de Certificado */}
      <CertificateUploadDialog
        open={showCertUpload}
        onOpenChange={setShowCertUpload}
        onSuccess={() => setShowCertUpload(false)}
      />
    </div>
  );
};
