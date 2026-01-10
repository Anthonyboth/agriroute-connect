import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  FileQuestion,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LivestockComplianceStatus, RiskLevel } from '@/types/livestock-compliance';

// =====================================================
// STATUS BADGE
// =====================================================

interface GTAStatusBadgeProps {
  status: LivestockComplianceStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<LivestockComplianceStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  documents_required: {
    label: 'Documentos Obrigatórios',
    icon: FileQuestion,
    className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  validating: {
    label: 'Validando',
    icon: Loader2,
    className: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  approved: {
    label: 'Em Conformidade',
    icon: CheckCircle2,
    className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  },
  blocked: {
    label: 'Não Conforme',
    icon: XCircle,
    className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  },
  expired: {
    label: 'Expirado',
    icon: AlertTriangle,
    className: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30',
  },
  COMPLIANT: {
    label: 'Em Conformidade',
    icon: CheckCircle2,
    className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  },
  NON_COMPLIANT: {
    label: 'Não Conforme',
    icon: XCircle,
    className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  },
};

export const GTAStatusBadge: React.FC<GTAStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className = '',
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${sizeStyles[size]} font-medium flex items-center ${className}`}
    >
      {showIcon && (
        <Icon className={`${iconSizes[size]} ${status === 'validating' ? 'animate-spin' : ''}`} />
      )}
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
};

// =====================================================
// RISK BADGE
// =====================================================

interface RiskBadgeProps {
  score: number;
  level?: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
  className?: string;
}

const riskConfig: Record<RiskLevel, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  ok: {
    label: 'Baixo Risco',
    icon: CheckCircle2,
    className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  },
  alert: {
    label: 'Atenção',
    icon: AlertTriangle,
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  blocked: {
    label: 'Alto Risco',
    icon: ShieldAlert,
    className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  level,
  size = 'md',
  showScore = true,
  className = '',
}) => {
  const computedLevel: RiskLevel = level || (
    score >= 61 ? 'blocked' :
    score >= 31 ? 'alert' : 'ok'
  );

  const config = riskConfig[computedLevel];
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${sizeStyles[size]} font-medium flex items-center ${className}`}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
      {showScore && (
        <span className="ml-1 opacity-70">({score}%)</span>
      )}
    </Badge>
  );
};

// =====================================================
// GTA DOCUMENT STATUS BADGE
// =====================================================

type GTADocStatus = 'valid' | 'expired' | 'missing' | 'invalid' | 'pending';

interface GTADocStatusBadgeProps {
  status: GTADocStatus;
  expiresIn?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const docStatusConfig: Record<GTADocStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  valid: {
    label: 'GTA Válida',
    icon: CheckCircle2,
    className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  },
  expired: {
    label: 'GTA Vencida',
    icon: XCircle,
    className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  },
  missing: {
    label: 'GTA Não Anexada',
    icon: FileQuestion,
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  invalid: {
    label: 'GTA Inválida',
    icon: ShieldAlert,
    className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  },
  pending: {
    label: 'Aguardando GTA',
    icon: Clock,
    className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
};

export const GTADocStatusBadge: React.FC<GTADocStatusBadgeProps> = ({
  status,
  expiresIn,
  size = 'md',
  className = '',
}) => {
  const config = docStatusConfig[status];
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${sizeStyles[size]} font-medium flex items-center ${className}`}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
      {expiresIn && status === 'valid' && (
        <span className="ml-1 opacity-70 text-xs">({expiresIn})</span>
      )}
    </Badge>
  );
};

export default GTAStatusBadge;
