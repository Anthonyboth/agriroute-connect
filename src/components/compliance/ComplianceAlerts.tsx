import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, XCircle, Info, FileText, Truck, PawPrint } from 'lucide-react';
import type { ComplianceIssue } from '@/types/compliance';
import { cn } from '@/lib/utils';

interface ComplianceAlertsProps {
  issues: ComplianceIssue[];
  className?: string;
}

const severityConfig = {
  info: {
    icon: Info,
    variant: 'default' as const,
    className: 'border-primary/50 bg-primary/5',
  },
  warning: {
    icon: AlertTriangle,
    variant: 'default' as const,
    className: 'border-warning/50 bg-warning/5',
  },
  error: {
    icon: XCircle,
    variant: 'destructive' as const,
    className: 'border-destructive/50 bg-destructive/5',
  },
};

const typeIcons = {
  nfe: FileText,
  cte: Truck,
  gta: PawPrint,
};

export function ComplianceAlerts({ issues, className }: ComplianceAlertsProps) {
  if (issues.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {issues.map((issue) => {
        const config = severityConfig[issue.severity];
        const TypeIcon = typeIcons[issue.type];
        const SeverityIcon = config.icon;

        return (
          <Alert 
            key={issue.id} 
            variant={config.variant}
            className={cn(config.className)}
          >
            <div className="flex items-start gap-2">
              <SeverityIcon className="h-4 w-4 mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="flex items-center gap-2 text-sm">
                  <TypeIcon className="h-4 w-4" />
                  {issue.message}
                </AlertTitle>
                {issue.legalBasis && (
                  <AlertDescription className="text-xs mt-1">
                    Base legal: {issue.legalBasis}
                  </AlertDescription>
                )}
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
