import { CheckCircle, XCircle, AlertTriangle, MinusCircle, FileText, Truck, PawPrint } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ComplianceResult, ChecklistItem, ComplianceStatus } from '@/types/compliance';
import { cn } from '@/lib/utils';

interface FreightComplianceChecklistProps {
  compliance: ComplianceResult;
  onAction?: (action: string) => void;
}

const statusConfig: Record<ComplianceStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  OK: { label: 'Regular', color: 'bg-success text-success-foreground', icon: CheckCircle },
  WARNING: { label: 'Atenção', color: 'bg-warning text-warning-foreground', icon: AlertTriangle },
  BLOCKED: { label: 'Irregular', color: 'bg-destructive text-destructive-foreground', icon: XCircle },
};

const itemStatusConfig: Record<ChecklistItem['status'], { icon: typeof CheckCircle; color: string }> = {
  ok: { icon: CheckCircle, color: 'text-success' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
  error: { icon: XCircle, color: 'text-destructive' },
  not_required: { icon: MinusCircle, color: 'text-muted-foreground' },
};

const itemIcons = {
  nfe: FileText,
  nfeManifestation: FileText,
  cte: Truck,
  gta: PawPrint,
};

export function FreightComplianceChecklist({ compliance, onAction }: FreightComplianceChecklistProps) {
  const { status, checklist, issues } = compliance;
  const StatusIcon = statusConfig[status].icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Checklist Fiscal
          </CardTitle>
          <Badge className={cn('flex items-center gap-1', statusConfig[status].color)}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig[status].label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(checklist).map(([key, item]) => {
          const ItemIcon = itemIcons[key as keyof typeof itemIcons];
          const StatusItemIcon = itemStatusConfig[item.status].icon;
          
          return (
            <div 
              key={key}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                item.status === 'error' && 'border-destructive/50 bg-destructive/5',
                item.status === 'warning' && 'border-warning/50 bg-warning/5',
                item.status === 'ok' && 'border-success/50 bg-success/5',
                item.status === 'not_required' && 'border-muted bg-muted/30',
              )}
            >
              <div className="flex items-center gap-3">
                <ItemIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              </div>
              <StatusItemIcon className={cn('h-5 w-5', itemStatusConfig[item.status].color)} />
            </div>
          );
        })}

        {/* Action buttons for issues */}
        {issues.length > 0 && (
          <div className="pt-3 border-t space-y-2">
            {issues
              .filter(issue => issue.action && issue.actionLabel)
              .map((issue) => (
                <Button
                  key={issue.id}
                  variant={issue.severity === 'error' ? 'destructive' : 'outline'}
                  size="sm"
                  className="w-full"
                  onClick={() => onAction?.(issue.action!)}
                >
                  {issue.actionLabel}
                </Button>
              ))}
          </div>
        )}

        {/* Legal basis footer */}
        {compliance.legalBasis.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Base legal:</strong> {compliance.legalBasis.join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
