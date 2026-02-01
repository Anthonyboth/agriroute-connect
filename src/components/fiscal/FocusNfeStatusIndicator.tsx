/**
 * Indicador de status da integração Focus NFe
 * 
 * Mostra o status atual da integração de forma visual e amigável
 */

import { useFocusNfe, FocusNfeStatus } from "@/hooks/useFocusNfe";
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  XCircle, 
  Upload, 
  RefreshCw,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface FocusNfeStatusIndicatorProps {
  variant?: "compact" | "detailed" | "alert";
  onUploadCertificate?: () => void;
  onSync?: () => void;
  className?: string;
}

const statusConfig: Record<FocusNfeStatus, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: "success" | "warning" | "error" | "info" | "muted";
  description: string;
}> = {
  loading: {
    icon: Loader2,
    label: "Carregando",
    color: "muted",
    description: "Verificando status do emissor fiscal...",
  },
  not_configured: {
    icon: AlertCircle,
    label: "Não configurado",
    color: "warning",
    description: "Complete o cadastro do emissor fiscal para começar a emitir notas.",
  },
  certificate_missing: {
    icon: Upload,
    label: "Certificado pendente",
    color: "warning",
    description: "Envie seu certificado digital A1 para habilitar a emissão de notas.",
  },
  certificate_expired: {
    icon: XCircle,
    label: "Certificado vencido",
    color: "error",
    description: "Seu certificado digital expirou. Envie um novo certificado para continuar emitindo.",
  },
  pending_validation: {
    icon: Clock,
    label: "Em validação",
    color: "info",
    description: "Aguardando validação junto à SEFAZ. Isso pode levar alguns minutos.",
  },
  focus_sync_pending: {
    icon: RefreshCw,
    label: "Sincronizando",
    color: "info",
    description: "Sincronizando dados com a Focus NFe...",
  },
  ready: {
    icon: CheckCircle2,
    label: "Pronto",
    color: "success",
    description: "Tudo configurado! Você pode emitir notas fiscais.",
  },
  blocked: {
    icon: ShieldAlert,
    label: "Bloqueado",
    color: "error",
    description: "Emissor fiscal bloqueado. Entre em contato com o suporte.",
  },
  error: {
    icon: XCircle,
    label: "Erro",
    color: "error",
    description: "Ocorreu um erro. Tente novamente ou entre em contato com o suporte.",
  },
};

const colorClasses = {
  success: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "text-emerald-600",
    alert: "border-emerald-200 bg-emerald-50",
  },
  warning: {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "text-amber-600",
    alert: "border-amber-200 bg-amber-50",
  },
  error: {
    badge: "bg-red-100 text-red-800 border-red-200",
    icon: "text-red-600",
    alert: "border-red-200 bg-red-50",
  },
  info: {
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "text-blue-600",
    alert: "border-blue-200 bg-blue-50",
  },
  muted: {
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    icon: "text-gray-400",
    alert: "border-gray-200 bg-gray-50",
  },
};

export function FocusNfeStatusIndicator({
  variant = "compact",
  onUploadCertificate,
  onSync,
  className,
}: FocusNfeStatusIndicatorProps) {
  const { 
    loading, 
    status, 
    issuer, 
    certificate, 
    wallet,
    statusMessage,
    refresh,
    syncWithFocus,
  } = useFocusNfe();

  const config = statusConfig[status];
  const colors = colorClasses[config.color];
  const Icon = config.icon;

  const handleSync = async () => {
    if (onSync) {
      onSync();
    } else {
      await syncWithFocus();
    }
  };

  // Compact variant - just a badge
  if (variant === "compact") {
    return (
      <Badge 
        variant="outline" 
        className={cn(colors.badge, "gap-1.5", className)}
      >
        <Icon className={cn(
          "h-3.5 w-3.5", 
          colors.icon,
          status === "loading" && "animate-spin"
        )} />
        {config.label}
      </Badge>
    );
  }

  // Alert variant - full width alert box
  if (variant === "alert") {
    // Don't show alert if ready
    if (status === "ready" || status === "loading") {
      return null;
    }

    return (
      <Alert className={cn(colors.alert, className)}>
        <Icon className={cn("h-4 w-4", colors.icon)} />
        <AlertTitle>{config.label}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{config.description}</span>
          
          <div className="flex gap-2 mt-1">
            {(status === "certificate_missing" || status === "certificate_expired") && onUploadCertificate && (
              <Button size="sm" variant="outline" onClick={onUploadCertificate}>
                <Upload className="h-4 w-4 mr-1" />
                Enviar certificado
              </Button>
            )}
            
            {status === "focus_sync_pending" && (
              <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                Sincronizar
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Detailed variant - full card with all info
  return (
    <div className={cn("rounded-lg border p-4 space-y-4", colors.alert, className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            "h-5 w-5", 
            colors.icon,
            status === "loading" && "animate-spin"
          )} />
          <div>
            <p className="font-medium">{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Details */}
      {issuer && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Issuer Info */}
          <div>
            <p className="text-muted-foreground">Emissor</p>
            <p className="font-medium truncate">{issuer.legalName}</p>
            <p className="text-xs text-muted-foreground">{issuer.documentNumber}</p>
          </div>
          
          {/* Environment */}
          <div>
            <p className="text-muted-foreground">Ambiente</p>
            <Badge variant="outline" className={cn(
              issuer.fiscalEnvironment === "production" 
                ? "bg-red-50 text-red-700 border-red-200" 
                : "bg-blue-50 text-blue-700 border-blue-200"
            )}>
              {issuer.fiscalEnvironment === "production" ? "Produção" : "Homologação"}
            </Badge>
          </div>
          
          {/* Certificate Status */}
          <div>
            <p className="text-muted-foreground">Certificado</p>
            {certificate ? (
              <div className="flex items-center gap-1">
                {certificate.isValid && !certificate.isExpired ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                )}
                <span className={cn(
                  "font-medium",
                  certificate.isValid && !certificate.isExpired 
                    ? "text-emerald-700" 
                    : "text-red-700"
                )}>
                  {certificate.isExpired 
                    ? "Vencido" 
                    : certificate.isValid 
                      ? `Válido (${certificate.daysUntilExpiry}d)` 
                      : "Inválido"}
                </span>
              </div>
            ) : (
              <span className="text-amber-600">Não enviado</span>
            )}
          </div>
          
          {/* Wallet */}
          <div>
            <p className="text-muted-foreground">Créditos</p>
            {wallet ? (
              <div className="flex items-center gap-1">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className={cn(
                  "font-medium",
                  wallet.availableBalance > 0 ? "text-emerald-700" : "text-red-700"
                )}>
                  {wallet.availableBalance} disponíveis
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {(status === "certificate_missing" || status === "certificate_expired" || status === "focus_sync_pending") && (
        <div className="flex gap-2 pt-2 border-t">
          {(status === "certificate_missing" || status === "certificate_expired") && onUploadCertificate && (
            <Button size="sm" onClick={onUploadCertificate}>
              <Upload className="h-4 w-4 mr-1" />
              Enviar certificado
            </Button>
          )}
          
          {status === "focus_sync_pending" && (
            <Button size="sm" onClick={handleSync} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Sincronizar com Focus NFe
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
