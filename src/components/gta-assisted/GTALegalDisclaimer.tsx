import React from 'react';
import { AlertTriangle, Info, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LEGAL_DISCLAIMERS } from '@/types/livestock-compliance';

type DisclaimerType = 
  | 'gta_not_issuer'
  | 'assisted_only'
  | 'fiscal_support'
  | 'user_responsibility'
  | 'ai_preventive';

interface GTALegalDisclaimerProps {
  type: DisclaimerType;
  variant?: 'default' | 'compact' | 'banner';
  className?: string;
}

const disclaimerConfig: Record<DisclaimerType, {
  text: string;
  icon: React.ElementType;
  severity: 'info' | 'warning' | 'neutral';
}> = {
  gta_not_issuer: {
    text: LEGAL_DISCLAIMERS.GTA_NOT_ISSUER,
    icon: AlertTriangle,
    severity: 'warning',
  },
  assisted_only: {
    text: LEGAL_DISCLAIMERS.ASSISTED_ONLY,
    icon: Info,
    severity: 'info',
  },
  fiscal_support: {
    text: LEGAL_DISCLAIMERS.FISCAL_SUPPORT,
    icon: Shield,
    severity: 'neutral',
  },
  user_responsibility: {
    text: LEGAL_DISCLAIMERS.USER_RESPONSIBILITY,
    icon: AlertTriangle,
    severity: 'warning',
  },
  ai_preventive: {
    text: LEGAL_DISCLAIMERS.AI_PREVENTIVE,
    icon: Info,
    severity: 'info',
  },
};

export const GTALegalDisclaimer: React.FC<GTALegalDisclaimerProps> = ({
  type,
  variant = 'default',
  className = '',
}) => {
  const config = disclaimerConfig[type];
  const Icon = config.icon;

  const severityStyles = {
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    neutral: 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-2 text-xs ${severityStyles[config.severity]} p-2 rounded-md ${className}`}>
        <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>{config.text}</span>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`w-full py-2 px-4 flex items-center justify-center gap-2 text-sm ${severityStyles[config.severity]} ${className}`}>
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-center">{config.text}</span>
      </div>
    );
  }

  return (
    <Alert className={`${severityStyles[config.severity]} ${className}`}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">Aviso Legal</AlertTitle>
      <AlertDescription className="text-sm">
        {config.text}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Componente que agrupa múltiplos disclaimers
 */
export const GTADisclaimersGroup: React.FC<{
  types: DisclaimerType[];
  variant?: 'default' | 'compact';
  className?: string;
}> = ({ types, variant = 'compact', className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {types.map((type) => (
        <GTALegalDisclaimer key={type} type={type} variant={variant} />
      ))}
    </div>
  );
};

export default GTALegalDisclaimer;
