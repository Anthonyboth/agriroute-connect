import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Circle,
  FileText,
  Calendar,
  MapPin,
  Hash,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ComplianceChecklist, BlockingReason } from '@/types/livestock-compliance';

interface GTAComplianceChecklistProps {
  checklist: ComplianceChecklist;
  blockingReasons?: BlockingReason[];
  showProgress?: boolean;
  className?: string;
}

interface ChecklistItemProps {
  label: string;
  description?: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  icon?: React.ElementType;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({
  label,
  description,
  status,
  icon: CustomIcon,
}) => {
  const statusConfig = {
    ok: {
      icon: CheckCircle2,
      className: 'text-green-600 dark:text-green-400',
      bgClassName: 'bg-green-500/10',
    },
    warning: {
      icon: AlertTriangle,
      className: 'text-amber-600 dark:text-amber-400',
      bgClassName: 'bg-amber-500/10',
    },
    error: {
      icon: XCircle,
      className: 'text-red-600 dark:text-red-400',
      bgClassName: 'bg-red-500/10',
    },
    pending: {
      icon: Circle,
      className: 'text-muted-foreground',
      bgClassName: 'bg-muted/50',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const ItemIcon = CustomIcon || FileText;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${config.bgClassName}`}>
      <div className={`flex-shrink-0 ${config.className}`}>
        <StatusIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ItemIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{label}</span>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
};

export const GTAComplianceChecklist: React.FC<GTAComplianceChecklistProps> = ({
  checklist,
  blockingReasons = [],
  showProgress = true,
  className = '',
}) => {
  // Definir itens do checklist
  const items: Array<{
    key: keyof ComplianceChecklist;
    label: string;
    description: string;
    icon: React.ElementType;
    required: boolean;
  }> = [
    {
      key: 'gta_uploaded',
      label: 'GTA Anexada',
      description: 'Guia de Trânsito Animal emitida pelo órgão estadual',
      icon: FileText,
      required: true,
    },
    {
      key: 'gta_valid',
      label: 'GTA Válida',
      description: 'Documento verificado e sem inconsistências',
      icon: CheckCircle2,
      required: true,
    },
    {
      key: 'gta_not_expired',
      label: 'GTA Dentro da Validade',
      description: 'Documento dentro do prazo de validade',
      icon: Calendar,
      required: true,
    },
    {
      key: 'nfe_uploaded',
      label: 'NF-e Anexada',
      description: 'Nota Fiscal Eletrônica do transporte',
      icon: FileText,
      required: false,
    },
    {
      key: 'origin_uf_match',
      label: 'UF Origem Confere',
      description: 'Estado de origem corresponde ao frete',
      icon: MapPin,
      required: true,
    },
    {
      key: 'destination_uf_match',
      label: 'UF Destino Confere',
      description: 'Estado de destino corresponde ao frete',
      icon: Target,
      required: true,
    },
    {
      key: 'animal_count_match',
      label: 'Quantidade Confere',
      description: 'Número de animais corresponde à GTA',
      icon: Hash,
      required: true,
    },
  ];

  // Calcular progresso
  const completedItems = items.filter(item => checklist[item.key] === true).length;
  const totalItems = items.length;
  const progress = Math.round((completedItems / totalItems) * 100);

  // Determinar status de cada item
  const getItemStatus = (item: typeof items[0]): ChecklistItemProps['status'] => {
    const value = checklist[item.key];
    
    if (value === true) return 'ok';
    if (value === false) return item.required ? 'error' : 'warning';
    return 'pending';
  };

  // Verificar se há bloqueios
  const hasBlockingIssues = blockingReasons.some(r => r.severity === 'blocking');

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Checklist de Compliance
          </CardTitle>
          {showProgress && (
            <span className={`text-sm font-medium ${
              progress === 100 ? 'text-green-600' : 
              hasBlockingIssues ? 'text-red-600' : 'text-amber-600'
            }`}>
              {completedItems}/{totalItems}
            </span>
          )}
        </div>
        {showProgress && (
          <Progress 
            value={progress} 
            className={`h-2 mt-2 ${
              hasBlockingIssues ? '[&>div]:bg-red-500' : 
              progress === 100 ? '[&>div]:bg-green-500' : ''
            }`}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <ChecklistItem
            key={item.key}
            label={item.label}
            description={item.description}
            status={getItemStatus(item)}
            icon={item.icon}
          />
        ))}

        {/* Bloqueios */}
        {blockingReasons.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pendências Identificadas
            </h4>
            <ul className="space-y-1">
              {blockingReasons.map((reason, index) => (
                <li 
                  key={index}
                  className={`text-sm flex items-start gap-2 ${
                    reason.severity === 'blocking' 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{reason.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GTAComplianceChecklist;
