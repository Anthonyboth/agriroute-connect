import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  MinusCircle, 
  FileText, 
  Truck, 
  PawPrint,
  Shield,
  ChevronRight,
  ExternalLink,
  Info,
  RefreshCw
} from 'lucide-react';
import { FreightComplianceChecklist } from './FreightComplianceChecklist';
import { ComplianceAlerts } from './ComplianceAlerts';
import { useFreightCompliance } from '@/hooks/useFreightCompliance';
import type { FreightComplianceData, ComplianceResult, ComplianceStatus } from '@/types/compliance';
import { cn } from '@/lib/utils';

interface ComplianceEngineProps {
  freightData: FreightComplianceData;
  onAction?: (action: string) => void;
  showDetails?: boolean;
  className?: string;
}

const statusConfig: Record<ComplianceStatus, { 
  label: string; 
  description: string;
  color: string; 
  bgColor: string;
  icon: typeof CheckCircle;
  progress: number;
}> = {
  OK: { 
    label: 'Documentação Regular', 
    description: 'Todos os documentos fiscais estão em conformidade',
    color: 'text-success', 
    bgColor: 'bg-success/10 border-success/30',
    icon: CheckCircle,
    progress: 100,
  },
  WARNING: { 
    label: 'Atenção Necessária', 
    description: 'Há pendências que precisam ser resolvidas',
    color: 'text-warning', 
    bgColor: 'bg-warning/10 border-warning/30',
    icon: AlertTriangle,
    progress: 50,
  },
  BLOCKED: { 
    label: 'Documentação Irregular', 
    description: 'Documentos obrigatórios ausentes ou inválidos',
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10 border-destructive/30',
    icon: XCircle,
    progress: 25,
  },
};

export function ComplianceEngine({ 
  freightData, 
  onAction, 
  showDetails = true,
  className 
}: ComplianceEngineProps) {
  const compliance = useFreightCompliance(freightData);
  const [isExpanded, setIsExpanded] = useState(false);

  const config = statusConfig[compliance.status];
  const StatusIcon = config.icon;

  // Calcular progresso real baseado nos itens do checklist
  const checklistItems = Object.values(compliance.checklist);
  const requiredItems = checklistItems.filter(item => item.required);
  const completedItems = requiredItems.filter(item => item.present);
  const progressPercent = requiredItems.length > 0 
    ? Math.round((completedItems.length / requiredItems.length) * 100)
    : 100;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status Card Principal */}
      <Card className={cn("border-2", config.bgColor)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-full", config.bgColor)}>
                <StatusIcon className={cn("h-6 w-6", config.color)} />
              </div>
              <div>
                <CardTitle className="text-lg">{config.label}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </div>
            </div>
            <Badge className={cn(
              "text-sm px-3 py-1",
              compliance.status === 'OK' && "bg-success text-success-foreground",
              compliance.status === 'WARNING' && "bg-warning text-warning-foreground",
              compliance.status === 'BLOCKED' && "bg-destructive text-destructive-foreground",
            )}>
              {compliance.status === 'OK' ? 'Aprovado' : 
               compliance.status === 'WARNING' ? 'Pendente' : 'Bloqueado'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso de Conformidade</span>
              <span className={cn("font-medium", config.color)}>{progressPercent}%</span>
            </div>
            <Progress 
              value={progressPercent} 
              className={cn(
                "h-2",
                compliance.status === 'OK' && "[&>div]:bg-success",
                compliance.status === 'WARNING' && "[&>div]:bg-warning",
                compliance.status === 'BLOCKED' && "[&>div]:bg-destructive",
              )}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 py-2">
            <QuickStat
              icon={FileText}
              label="NF-e"
              status={compliance.checklist.nfe.status}
              subLabel={compliance.checklist.nfe.present ? 'Vinculada' : 'Ausente'}
            />
            <QuickStat
              icon={Truck}
              label="CT-e"
              status={compliance.checklist.cte.status}
              subLabel={!compliance.checklist.cte.required ? 'N/A' : 
                compliance.checklist.cte.present ? 'Emitido' : 'Pendente'}
            />
            <QuickStat
              icon={PawPrint}
              label="GTA"
              status={compliance.checklist.gta.status}
              subLabel={!compliance.checklist.gta.required ? 'N/A' : 
                compliance.checklist.gta.present ? 'Válida' : 'Ausente'}
            />
          </div>

          {/* Alerts */}
          {compliance.issues.length > 0 && (
            <ComplianceAlerts issues={compliance.issues} className="mt-4" />
          )}

          {/* Toggle Details */}
          {showDetails && (
            <Button
              variant="ghost"
              className="w-full justify-between"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Ver Checklist Completo
              </span>
              <ChevronRight className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-90"
              )} />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Expanded Checklist */}
      {showDetails && isExpanded && (
        <FreightComplianceChecklist 
          compliance={compliance} 
          onAction={onAction}
        />
      )}

      {/* Legal Disclaimer */}
      <Alert variant="default" className="bg-muted/50">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Aviso:</strong> Este checklist é apenas informativo e não substitui 
          a verificação oficial junto aos órgãos competentes (SEFAZ, MAPA, ANTT).
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Quick Stat Component
interface QuickStatProps {
  icon: typeof FileText;
  label: string;
  status: 'ok' | 'warning' | 'error' | 'not_required';
  subLabel: string;
}

function QuickStat({ icon: Icon, label, status, subLabel }: QuickStatProps) {
  const statusColors = {
    ok: 'text-success',
    warning: 'text-warning',
    error: 'text-destructive',
    not_required: 'text-muted-foreground',
  };

  const StatusIcon = {
    ok: CheckCircle,
    warning: AlertTriangle,
    error: XCircle,
    not_required: MinusCircle,
  }[status];

  return (
    <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/30">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={cn("flex items-center gap-1", statusColors[status])}>
        <StatusIcon className="h-3 w-3" />
        <span className="text-xs">{subLabel}</span>
      </div>
    </div>
  );
}
