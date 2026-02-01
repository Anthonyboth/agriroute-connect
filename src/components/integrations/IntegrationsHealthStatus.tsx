/**
 * Componente de Status de Saúde das Integrações
 * 
 * Exibe o status de todas as integrações da plataforma
 * e permite verificação manual da saúde das APIs
 */

import { useIntegrations, IntegrationStatus, IntegrationName } from "@/hooks/useIntegrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle,
  RefreshCw,
  Activity,
  Wifi,
  FileText,
  CreditCard,
  Bell,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface IntegrationsHealthStatusProps {
  variant?: "compact" | "detailed" | "card";
  showPaymentInfo?: boolean;
  className?: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatusIcon({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function IntegrationIcon({ name }: { name: IntegrationName }) {
  switch (name) {
    case "focus_nfe":
      return <FileText className="h-4 w-4" />;
    case "pagarme":
      return <CreditCard className="h-4 w-4" />;
    case "telegram":
      return <Bell className="h-4 w-4" />;
    case "sefaz":
      return <Activity className="h-4 w-4" />;
    case "geocoding":
      return <MapPin className="h-4 w-4" />;
    case "push":
      return <Bell className="h-4 w-4" />;
    default:
      return <Wifi className="h-4 w-4" />;
  }
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const variants: Record<IntegrationStatus, string> = {
    healthy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    degraded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    unknown: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };
  
  const labels: Record<IntegrationStatus, string> = {
    healthy: "Funcionando",
    degraded: "Degradado",
    error: "Erro",
    unknown: "Verificando",
  };
  
  return (
    <Badge variant="outline" className={cn("text-xs", variants[status])}>
      {labels[status]}
    </Badge>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function IntegrationsHealthStatus({
  variant = "card",
  showPaymentInfo = true,
  className,
}: IntegrationsHealthStatusProps) {
  const {
    health,
    payments,
    isCheckingHealth,
    lastHealthCheck,
    overallStatus,
    statusSummary,
    checkAllHealth,
    emissionPricing,
  } = useIntegrations();

  const healthEntries = Object.entries(health);

  // Compact variant - just a status indicator
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <StatusIcon status={overallStatus} />
        <span className="text-sm text-muted-foreground">{statusSummary}</span>
      </div>
    );
  }

  // Detailed variant - list of all integrations
  if (variant === "detailed") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Status das Integrações</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => checkAllHealth()}
            disabled={isCheckingHealth}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", isCheckingHealth && "animate-spin")} />
            Atualizar
          </Button>
        </div>
        
        <div className="grid gap-2">
          {healthEntries.map(([name, h]) => (
            <div
              key={name}
              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <IntegrationIcon name={name as IntegrationName} />
                <span className="text-sm">{h.displayName}</span>
                {h.isRequired && (
                  <span className="text-[10px] text-muted-foreground">(obrigatório)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={h.status} />
                {h.responseTimeMs && (
                  <span className="text-[10px] text-muted-foreground">
                    {h.responseTimeMs}ms
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {lastHealthCheck && (
          <p className="text-[10px] text-muted-foreground text-right">
            Última verificação: {new Date(lastHealthCheck).toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    );
  }

  // Card variant - full card with all info
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Integrações da Plataforma
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkAllHealth()}
            disabled={isCheckingHealth}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", isCheckingHealth && "animate-spin")} />
            Verificar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <StatusIcon status={overallStatus} />
          <div>
            <p className="text-sm font-medium">{statusSummary}</p>
            {lastHealthCheck && (
              <p className="text-xs text-muted-foreground">
                Verificado em {new Date(lastHealthCheck).toLocaleTimeString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        
        {/* Integration list */}
        <div className="space-y-2">
          {healthEntries.map(([name, h]) => (
            <div
              key={name}
              className={cn(
                "flex items-center justify-between p-2 rounded-md border",
                h.status === "error" && "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10",
                h.status === "degraded" && "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-900/10",
                h.status === "healthy" && "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/10",
              )}
            >
              <div className="flex items-center gap-2">
                <IntegrationIcon name={name as IntegrationName} />
                <div>
                  <p className="text-sm font-medium">{h.displayName}</p>
                  <p className="text-xs text-muted-foreground">{h.message}</p>
                </div>
              </div>
              <StatusBadge status={h.status} />
            </div>
          ))}
        </div>
        
        {/* Payment pricing info */}
        {showPaymentInfo && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Preços por Emissão
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {emissionPricing.map((tier) => (
                <div
                  key={tier.documentType}
                  className="p-2 rounded-md bg-muted/50 text-center"
                >
                  <p className="text-xs text-muted-foreground uppercase">
                    {tier.documentType}
                  </p>
                  <p className="text-sm font-medium">
                    R$ {tier.unitPrice.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            
            {!payments.isConfigured && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                💳 Pagamentos via Pagar.me em breve
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
