import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle,
  FileText,
  Key,
  Shield,
  Wallet,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useFiscalIssuer, IssuerStatus } from '@/hooks/useFiscalIssuer';
import { formatDocument } from '@/utils/document';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FiscalIssuerStatusCardProps {
  onStartOnboarding?: () => void;
  onContinueOnboarding?: () => void;
}

const STATUS_CONFIG: Record<IssuerStatus, {
  label: string;
  color: string;
  icon: React.ElementType;
  action?: string;
}> = {
  PENDING: {
    label: 'Pendente',
    color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
    icon: Clock,
    action: 'Continuar cadastro',
  },
  DOCUMENT_VALIDATED: {
    label: 'Documentos Validados',
    color: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
    icon: FileText,
    action: 'Enviar certificado',
  },
  CERTIFICATE_PENDING: {
    label: 'Aguardando Certificado',
    color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
    icon: Key,
    action: 'Enviar certificado',
  },
  CERTIFICATE_UPLOADED: {
    label: 'Certificado Enviado',
    color: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
    icon: Key,
    action: 'Validar com SEFAZ',
  },
  SEFAZ_VALIDATED: {
    label: 'Validado pela SEFAZ',
    color: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
    icon: Shield,
    action: 'Aceitar termo',
  },
  ACTIVE: {
    label: 'Ativo',
    color: 'bg-green-500/20 text-green-700 border-green-500/30',
    icon: CheckCircle2,
  },
  BLOCKED: {
    label: 'Bloqueado',
    color: 'bg-destructive/20 text-destructive border-destructive/30',
    icon: XCircle,
  },
};

export function FiscalIssuerStatusCard({ 
  onStartOnboarding, 
  onContinueOnboarding 
}: FiscalIssuerStatusCardProps) {
  const { 
    loading, 
    issuer, 
    certificate, 
    wallet,
    getOnboardingProgress,
    getCertificateDaysUntilExpiry,
    isCertificateValid,
    fetchIssuer
  } = useFiscalIssuer();

  const progress = getOnboardingProgress();
  const daysUntilExpiry = getCertificateDaysUntilExpiry();
  const certValid = isCertificateValid();

  // No issuer yet
  if (!issuer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cadastro Fiscal
          </CardTitle>
          <CardDescription>
            Configure seu emissor para emitir NF-e no AgriRoute
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-muted rounded-full">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Nenhum emissor cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Inicie o cadastro para emitir documentos fiscais
              </p>
            </div>
            <Button onClick={onStartOnboarding} className="mt-2">
              Iniciar Cadastro
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = STATUS_CONFIG[issuer.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Emissor Fiscal
          </CardTitle>
          <CardDescription>
            {issuer.razao_social}
          </CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => fetchIssuer()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={statusConfig.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {formatDocument(issuer.cpf_cnpj)}
          </span>
        </div>

        {/* Progress (if not active/blocked) */}
        {issuer.status !== 'ACTIVE' && issuer.status !== 'BLOCKED' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{progress.step}/{progress.total}</span>
            </div>
            <Progress value={(progress.step / progress.total) * 100} />
            {statusConfig.action && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={onContinueOnboarding}
              >
                {statusConfig.action}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        {/* Certificate info */}
        {certificate && (
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4" />
                Certificado Digital
              </div>
              {certValid ? (
                <Badge variant="outline" className="text-green-600 border-green-600/30">
                  Válido
                </Badge>
              ) : (
                <Badge variant="destructive">Vencido</Badge>
              )}
            </div>
            {certificate.valid_until && (
              <p className="text-xs text-muted-foreground">
                {certValid ? (
                  <>
                    Expira em {format(new Date(certificate.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                    {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
                      <span className="text-warning ml-1">
                        ({daysUntilExpiry} dias)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-destructive">
                    Vencido em {format(new Date(certificate.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Wallet info */}
        {wallet && issuer.status === 'ACTIVE' && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4" />
                Saldo Disponível
              </div>
              <span className="font-bold text-lg">
                {wallet.balance} emissões
              </span>
            </div>
            {wallet.total_emissions_used > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {wallet.total_emissions_used} emissões realizadas
              </p>
            )}
          </div>
        )}

        {/* Blocked reason */}
        {issuer.status === 'BLOCKED' && issuer.blocked_reason && (
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Emissor Bloqueado</p>
                <p className="text-xs text-destructive/80 mt-1">{issuer.blocked_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Certificate expiry warning */}
        {certValid && daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
          <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">Certificado expirando</p>
                <p className="text-xs text-warning/80 mt-1">
                  Seu certificado expira em {daysUntilExpiry} dias. Renove para continuar emitindo.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
