/**
 * ServiceStatusBadge.tsx
 * 
 * Badge de status do serviço 100% PT-BR.
 * Nunca exibe código em inglês.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { SERVICE_REQUEST_STATUS_LABELS, type ServiceRequestStatus } from '@/security/serviceRequestWorkflowGuard';

interface ServiceStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
  ACCEPTED: 'bg-orange-100 text-orange-800 border-orange-200',
  ON_THE_WAY: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
};

export const ServiceStatusBadge: React.FC<ServiceStatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = status.toUpperCase().trim() as ServiceRequestStatus;
  const label = SERVICE_REQUEST_STATUS_LABELS[normalized] || 'Desconhecido';
  const style = STATUS_STYLES[normalized] || 'bg-gray-100 text-gray-800';

  return (
    <Badge variant="outline" className={`text-xs ${style} ${className}`}>
      {label}
    </Badge>
  );
};
