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

interface FiscalIssuerSetupProps {
  fiscalIssuer: any;
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

  const hasCertificate = !!fiscalIssuer.certificate_uploaded_at;
  const certificateExpiry = fiscalIssuer.certificate_expiry_date 
    ? new Date(fiscalIssuer.certificate_expiry_date) 
    : null;
  const isExpiringSoon = certificateExpiry && 
    (certificateExpiry.getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
  const isExpired = certificateExpiry && certificateExpiry < new Date();

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
            <Badge variant={fiscalIssuer.is_active ? 'default' : 'secondary'}>
              {fiscalIssuer.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Razão Social</p>
              <p className="font-medium">{fiscalIssuer.razao_social || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nome Fantasia</p>
              <p className="font-medium">{fiscalIssuer.nome_fantasia || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CNPJ</p>
              <p className="font-medium font-mono">
                {fiscalIssuer.cnpj?.replace(
                  /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                  '$1.$2.$3/$4-$5'
                ) || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inscrição Estadual</p>
              <p className="font-medium">{fiscalIssuer.inscricao_estadual || '-'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Endereço</p>
              <p className="font-medium">
                {[
                  fiscalIssuer.logradouro,
                  fiscalIssuer.numero,
                  fiscalIssuer.bairro,
                  fiscalIssuer.municipio,
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
      <Card className={
        isExpired 
          ? 'border-red-500/50 bg-red-500/5' 
          : isExpiringSoon 
            ? 'border-yellow-500/50 bg-yellow-500/5'
            : ''
      }>
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
              isExpired ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Expirado
                </Badge>
              ) : isExpiringSoon ? (
                <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                  <AlertTriangle className="h-3 w-3" />
                  Expirando
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1 bg-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Válido
                </Badge>
              )
            ) : (
              <Badge variant="secondary">Não configurado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasCertificate ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Enviado em</p>
                  <p className="font-medium">
                    {new Date(fiscalIssuer.certificate_uploaded_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {certificateExpiry && (
                  <div>
                    <p className="text-sm text-muted-foreground">Validade</p>
                    <p className={`font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : ''}`}>
                      {certificateExpiry.toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>

              <Button 
                variant="outline" 
                onClick={() => setShowCertUpload(true)}
                className={isExpired || isExpiringSoon ? 'border-yellow-500 text-yellow-600' : ''}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {isExpired ? 'Renovar Certificado' : 'Atualizar Certificado'}
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
      {showCertUpload && (
        <CertificateUploadDialog
          isOpen={showCertUpload}
          onClose={() => setShowCertUpload(false)}
          issuerId={fiscalIssuer.id}
        />
      )}
    </div>
  );
};
